# FIREGUARD AI - Python Backend & Hardware Architecture

This directory contains the Python FastAPI backend with YOLO Fire & Smoke detection, SQLite data persistence, ESP32 IoT sensor telemetry ingest, and smart ESP32-CAM stream proxying with 5-stage automatic fallback.

---

## 1. Local Quick Start

### Installation
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Run the FastAPI Server
```bash
python3 main.py
# Or via uvicorn directly:
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
Server is now accessible on `http://localhost:8000` (or your LAN IP `http://192.168.x.x:8000`).
Interactive Swagger API documentation is available at `http://localhost:8000/docs`.

---

## 2. Connecting Public Frontend to Local Backend & Private Camera

When this dashboard is deployed on a public HTTPS URL (like Google Cloud Run / AI Studio preview) while your ESP32 and ESP32-CAM are located on a private local Wi-Fi network (e.g. `192.168.1.x`), browsers enforce **Mixed Content** and **CORS / Private Network Access** policies:

### Option A: Cloudflare Tunnel (Recommended, 100% Free & Fast)
Exposes your local backend to a secure public HTTPS endpoint without port forwarding:
```bash
# Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/
cloudflared tunnel --url http://localhost:8000
```
Copy the generated `https://xxxx.trycloudflare.com` URL into **Settings -> AI & Backend URL** in the dashboard.

### Option B: ngrok
```bash
ngrok http 8000
```
Copy the `https://xxxx.ngrok-free.app` into **Settings -> AI & Backend URL**.

### Option C: Tailscale Funnel
```bash
tailscale funnel 8000
```

### Option D: Local LAN Execution (Same Network)
If opening the frontend locally (e.g., `http://localhost:3000`), no tunnels are needed. The browser can communicate directly with `http://192.168.1.50` or via the built-in Node/Express proxy.

---

## 3. Camera Stream 5-Stage Fallback Architecture

ESP32-CAM firmware varieties and network topologies can be finicky. FIREGUARD AI implements an automatic 5-stage stream fallback:

1. **Configured Stream URL**: Tries custom URL specified by user (e.g., `http://192.168.1.80:81/stream`).
2. **Standard MJPEG Stream**: Tries `http://<IP>:81/stream` and `http://<IP>/stream` with continuous frame streaming.
3. **JPEG Snapshot Polling**: If continuous MJPEG fails or is interrupted, the system automatically falls back to polling `/capture` or `/jpg` at a configurable interval (e.g., every 250ms).
4. **Backend-Proxied Stream / Snapshots**: If direct browser connection fails due to CORS, mixed-content (HTTPS vs HTTP), or private network security, requests route through the backend proxy (`/api/camera/snapshot` or `/api/camera/stream`).
5. **Clear Diagnostic Error**: If all stages fail, the UI displays explicit diagnostic status (ping latency, HTTP error codes, retry count) without ever displaying mock video feeds.

---

## 4. Hardware Relay & Pump Safety Interlock

**Safety Principle: Keep automatic pump/relay control separate from the frontend, with appropriate safety checks.**

1. **Independent Microcontroller Safeguards**: The ESP32 firmware includes an internal watchdog timer. If WiFi disconnects or the server stops communicating, the relay will never remain stuck in the ON position.
2. **Dual-Condition Armed Switch**: In the frontend and API, the relay cannot be engaged unless the **Safety Interlock Armed** toggle is physically activated by the operator.
3. **Hardware Auto-Off Timeout**: Every activation command specifies a maximum duration (default 30 seconds). After this duration, the relay automatically cuts off to prevent water damage or dry pump motor burnout.
4. **Audit Logging**: Every activation, deactivation, and manual override is recorded in the SQLite `events` database with timestamps and operator credentials.
