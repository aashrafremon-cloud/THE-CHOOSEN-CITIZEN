"""
FIREGUARD AI - Python FastAPI Backend
Real-time ESP32 IoT telemetry ingest, YOLO Fire & Smoke inference,
camera proxy with automatic stream fallback, and SQLite persistence.
"""

import os
import io
import time
import json
import asyncio
import logging
from typing import Optional, List, Dict, Any
from urllib.parse import urlparse
import ipaddress

from fastapi import FastAPI, Request, Response, HTTPException, Query, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, PlainTextResponse, JSONResponse
from pydantic import BaseModel, Field
import requests

from database import (
    init_db,
    save_telemetry,
    get_latest_telemetry,
    get_telemetry_history,
    log_event,
    get_events
)
from yolo_detector import FireSmokeDetector

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fireguard.api")

# Initialize DB on boot
init_db()

# Initialize Detector
detector = FireSmokeDetector(confidence_thresh=0.40)

app = FastAPI(
    title="FIREGUARD AI - ESP32 IoT & Fire Detection Engine",
    description="FastAPI service for ESP32 telemetry, YOLO vision inference, camera streaming proxy, and relay safety.",
    version="1.0.0"
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active connected SSE clients
sse_clients: List[asyncio.Queue] = []

# Global in-memory cache for fast lookups
last_frame_bytes: Optional[bytes] = None
last_frame_timestamp: float = 0.0

# Relay state with hardware safety interlock
relay_state = {
    "active": False,
    "armed": False,
    "started_at": 0,
    "auto_off_seconds": 30,
    "last_source": "system"
}

# ----------------- Models -----------------
class GpsData(BaseModel):
    lat: float = 37.7749
    lng: float = -122.4194
    altitude: Optional[float] = 15.0
    satellites: Optional[int] = 6

class TelemetryPayload(BaseModel):
    deviceId: str = Field(default="ESP32-NODE-01")
    temperature: float = Field(..., description="DHT22 Temperature in Celsius")
    humidity: float = Field(..., description="DHT22 Relative Humidity %")
    mq7_co_ppm: float = Field(..., description="MQ-7 Carbon Monoxide in ppm")
    flame_detected: bool = Field(default=False, description="Digital flame sensor status")
    flame_raw: int = Field(default=4095, description="Analog flame sensor ADC value 0-4095")
    sound_db: float = Field(default=45.0, description="Sound sensor dB level")
    gps: Optional[GpsData] = None
    battery_mv: Optional[int] = 3700
    relay_active: Optional[bool] = False
    timestamp: Optional[str] = None

class RelayControlPayload(BaseModel):
    activate: bool
    armed: bool
    source: str = "manual_dashboard"
    auto_off_seconds: Optional[int] = 30

# ----------------- SSRF Guard -----------------
BLOCKED_IP_RANGES = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"), # Cloud metadata
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("224.0.0.0/4"), # Multicast
]

def is_safe_target_url(url: str) -> bool:
    """Verifies camera target URL is not pointing to restricted cloud metadata."""
    try:
        parsed = urlparse(url)
        hostname = parsed.hostname
        if not hostname:
            return False
        
        # Check IP
        try:
            ip = ipaddress.ip_address(hostname)
            for blocked in BLOCKED_IP_RANGES:
                if ip in blocked:
                    return False
        except ValueError:
            # Domain name (e.g. DDNS or ngrok/local tunnel)
            if "169.254" in hostname or "metadata.google" in hostname:
                return False
        return True
    except Exception:
        return False

# ----------------- SSE Broadcast Helper -----------------
async def broadcast_sse(event_type: str, data: Dict[str, Any]):
    message = f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
    for queue in list(sse_clients):
        try:
            await queue.put(message)
        except Exception:
            sse_clients.remove(queue)

# ----------------- Telemetry Endpoints -----------------
@app.post("/api/esp32/telemetry")
async def receive_telemetry(payload: TelemetryPayload):
    """
    Receives real IoT telemetry directly from physical ESP32 via HTTP POST.
    Analyzes thresholds, generates alerts, saves to SQLite, and pushes to UI.
    """
    data = payload.dict()
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ")
    data["timestamp"] = data["timestamp"] or now_iso

    # Threshold analysis
    status = "NORMAL"
    if data["flame_detected"] or data["temperature"] > 60.0 or data["mq7_co_ppm"] > 150.0:
        status = "CRITICAL"
    elif data["temperature"] > 45.0 or data["mq7_co_ppm"] > 50.0 or data["sound_db"] > 80.0:
        status = "WARNING"
    data["status"] = status
    data["relay_active"] = relay_state["active"]

    # Save to SQLite
    rec_id = save_telemetry(data)
    data["id"] = str(rec_id)

    # Check alert events
    if data["flame_detected"]:
        log_event("FIRE_DETECTED", "CRITICAL", "Flame Sensor Triggered!", 
                  f"Optical flame sensor detected fire signature (Raw: {data['flame_raw']})", 
                  "FLAME_SENSOR", data["flame_raw"])
        await broadcast_sse("alert", {
            "type": "FIRE_DETECTED", "severity": "CRITICAL", 
            "title": "Flame Sensor Triggered!", "value": data["flame_raw"]
        })

    if data["mq7_co_ppm"] > 150.0:
        log_event("GAS_LEAK", "CRITICAL", "Dangerous CO Level Detected", 
                  f"MQ-7 reported hazardous Carbon Monoxide level: {data['mq7_co_ppm']:.1f} ppm", 
                  "MQ7", data["mq7_co_ppm"])
    elif data["mq7_co_ppm"] > 50.0:
        log_event("GAS_LEAK", "WARNING", "Elevated CO Level", 
                  f"MQ-7 reported elevated Carbon Monoxide: {data['mq7_co_ppm']:.1f} ppm", 
                  "MQ7", data["mq7_co_ppm"])

    if data["temperature"] > 60.0:
        log_event("OVERHEAT", "CRITICAL", "Extreme High Temperature", 
                  f"DHT22 recorded {data['temperature']:.1f}°C ambient temperature", 
                  "DHT22", data["temperature"])

    # Push to live dashboard
    await broadcast_sse("telemetry", data)

    return {"status": "ok", "id": rec_id, "processed_status": status}

@app.get("/api/esp32/telemetry/latest")
async def get_latest():
    res = get_latest_telemetry()
    if not res:
        return {"status": "no_data"}
    return res

@app.get("/api/esp32/telemetry/history")
async def get_history(limit: int = Query(default=60, le=500)):
    records = get_telemetry_history(limit=limit)
    return {"records": records, "count": len(records)}

# ----------------- AI Fire & Smoke Detection -----------------
@app.post("/api/detect")
async def run_detection(file: UploadFile = File(...)):
    """
    Runs YOLO Fire & Smoke inference on uploaded frame.
    Returns detected bounding boxes, classes, confidence scores, and latency.
    """
    image_bytes = await file.read()
    results = detector.detect(image_bytes)

    # Log critical AI vision detection if fire is found
    if results.get("has_fire"):
        log_event(
            "FIRE_DETECTED", "CRITICAL", 
            "AI Vision: Fire Detected!", 
            f"YOLO vision confirmed fire with {max([d['confidence'] for d in results['detections'] if d['label']=='fire'], default=0.8):.0%} confidence",
            "AI_VISION", 
            results["inference_time_ms"]
        )
        await broadcast_sse("alert", {
            "type": "FIRE_DETECTED",
            "severity": "CRITICAL",
            "title": "AI Vision: Fire Detected!",
            "source": "AI_VISION"
        })
    elif results.get("has_smoke"):
        log_event(
            "SMOKE_DETECTED", "WARNING",
            "AI Vision: Smoke Detected",
            "YOLO vision detected smoke plume pattern",
            "AI_VISION",
            results["inference_time_ms"]
        )

    return results

# ----------------- Camera Fallback & Proxy Endpoints -----------------
@app.get("/api/camera/test-endpoints")
async def probe_camera_endpoints(ip: str = Query(...)):
    """
    Probes common ESP32-CAM endpoints:
    - /stream (port 80 and 81)
    - /capture (port 80 and 81)
    - /status
    - /jpg
    Returns response status and latency for automatic stream fallback configuration.
    """
    endpoints_to_test = [
        f"http://{ip}/stream",
        f"http://{ip}:81/stream",
        f"http://{ip}/capture",
        f"http://{ip}:81/capture",
        f"http://{ip}/status",
        f"http://{ip}/jpg"
    ]
    
    results = []
    recommended_mode = "error"
    recommended_url = ""

    for target in endpoints_to_test:
        if not is_safe_target_url(target):
            results.append({"url": target, "alive": False, "error": "Blocked target IP"})
            continue
        try:
            t0 = time.time()
            # Fast probe with short timeout
            resp = requests.head(target, timeout=1.8, allow_redirects=True)
            latency = round((time.time() - t0) * 1000, 1)
            content_type = resp.headers.get("content-type", "")
            
            alive = resp.status_code in (200, 206)
            results.append({
                "url": target,
                "alive": alive,
                "statusCode": resp.status_code,
                "contentType": content_type,
                "latencyMs": latency
            })
            
            if alive and not recommended_url:
                if "multipart/x-mixed-replace" in content_type or "stream" in target:
                    recommended_mode = "direct_mjpeg"
                    recommended_url = target
                elif "image" in content_type or "capture" in target:
                    recommended_mode = "snapshot_polling"
                    recommended_url = target
        except Exception as e:
            results.append({
                "url": target,
                "alive": False,
                "error": str(e)
            })

    return {
        "ip": ip,
        "results": results,
        "recommendedMode": recommended_mode,
        "recommendedUrl": recommended_url
    }

@app.get("/api/camera/snapshot")
async def proxy_camera_snapshot(url: str = Query(...)):
    """
    Proxies a JPEG frame from ESP32-CAM to bypass browser CORS / mixed-content blocks.
    Enforces SSRF protection.
    """
    if not is_safe_target_url(url):
        raise HTTPException(status_code=400, detail="Disallowed camera target address")

    try:
        resp = requests.get(url, timeout=3.5)
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="Camera returned non-200")
        
        global last_frame_bytes, last_frame_timestamp
        last_frame_bytes = resp.content
        last_frame_timestamp = time.time()

        return Response(content=resp.content, media_type="image/jpeg")
    except Exception as e:
        logger.warning(f"Error fetching camera snapshot from {url}: {e}")
        raise HTTPException(status_code=502, detail=f"Failed to fetch snapshot from camera: {e}")

@app.get("/api/camera/stream")
def proxy_camera_stream(url: str = Query(...)):
    """
    Proxies an MJPEG stream from ESP32-CAM to browser.
    """
    if not is_safe_target_url(url):
        raise HTTPException(status_code=400, detail="Disallowed stream target address")

    try:
        upstream = requests.get(url, stream=True, timeout=5.0)
        
        def stream_generator():
            try:
                for chunk in upstream.iter_content(chunk_size=4096):
                    if chunk:
                        yield chunk
            except Exception as ex:
                logger.warning(f"Stream interrupted: {ex}")

        content_type = upstream.headers.get("content-type", "multipart/x-mixed-replace; boundary=123456789000000000000987654321")
        return StreamingResponse(stream_generator(), media_type=content_type)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Cannot reach MJPEG stream: {e}")

# ----------------- Hardware Relay & Solenoid Control -----------------
@app.post("/api/relay/control")
async def control_relay(payload: RelayControlPayload):
    """
    Controls water solenoid pump or fire suppression relay with safety check.
    Auto-off timer protects pumps from dry-run motor burnout.
    """
    if payload.activate and not payload.armed:
        raise HTTPException(
            status_code=400, 
            detail="Safety interlock armed switch must be engaged before manual pump activation."
        )

    relay_state["active"] = payload.activate
    relay_state["armed"] = payload.armed
    relay_state["last_source"] = payload.source
    relay_state["started_at"] = time.time() if payload.activate else 0
    relay_state["auto_off_seconds"] = payload.auto_off_seconds or 30

    action = "ACTIVATED" if payload.activate else "DEACTIVATED"
    log_event(
        f"RELAY_{action}", 
        "WARNING" if payload.activate else "INFO",
        f"Suppression Pump Relay {action}",
        f"Relay triggered by {payload.source}. Armed: {payload.armed}. Auto-off: {relay_state['auto_off_seconds']}s",
        "SYSTEM",
        payload.activate
    )

    await broadcast_sse("relay", relay_state)
    return {
        "status": "ok",
        "relay_active": relay_state["active"],
        "auto_off_seconds": relay_state["auto_off_seconds"],
        "armed": relay_state["armed"]
    }

# ----------------- Events, CSV Export & SSE -----------------
@app.get("/api/events")
async def fetch_events(limit: int = 50, severity: Optional[str] = None):
    return {"events": get_events(limit=limit, severity=severity)}

@app.get("/api/export/csv")
async def export_telemetry_csv():
    records = get_telemetry_history(limit=5000)
    output = io.StringIO()
    output.write("Timestamp,DeviceID,Temperature_C,Humidity_Pct,MQ7_CO_PPM,Flame_Detected,Flame_Raw,Sound_dB,Lat,Lng,Status\n")
    for r in records:
        output.write(f"{r.get('created_at')},{r.get('device_id')},{r.get('temperature')},{r.get('humidity')},{r.get('mq7_co_ppm')},{r.get('flame_detected')},{r.get('flame_raw')},{r.get('sound_db')},{r.get('gps_lat')},{r.get('gps_lng')},{r.get('status')}\n")
    
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=fireguard_telemetry.csv"}
    )

@app.get("/api/stream/events")
async def sse_event_stream(request: Request):
    """
    Server-Sent Events endpoint pushing real-time sensor updates to frontend.
    """
    queue = asyncio.Queue()
    sse_clients.append(queue)

    async def event_generator():
        try:
            # Send initial handshake
            yield f"event: connected\ndata: {json.dumps({'time': time.time(), 'status': 'connected'})}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    # Wait for message with keep-alive timeout
                    msg = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield msg
                except asyncio.TimeoutError:
                    # Ping keep-alive
                    yield ": ping\n\n"
        finally:
            if queue in sse_clients:
                sse_clients.remove(queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
