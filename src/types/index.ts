export type SeverityLevel = 'INFO' | 'WARNING' | 'CRITICAL';

export interface GpsLocation {
  lat: number;
  lng: number;
  altitude?: number;
  satellites?: number;
  speed?: number;
}

export interface TelemetryData {
  id: string;
  deviceId: string;
  timestamp: string;
  temperature: number; // °C
  humidity: number; // %
  mq7_co_ppm: number; // Carbon Monoxide in ppm
  flame_detected: boolean;
  flame_raw: number; // 0-4095
  sound_db: number; // dB estimate
  gps: GpsLocation;
  battery_mv?: number;
  relay_active: boolean;
  status: 'NORMAL' | 'WARNING' | 'CRITICAL';
  is_simulated?: boolean;
}

export interface DetectionBox {
  id: string;
  label: 'fire' | 'smoke';
  confidence: number; // 0.00 to 1.00
  // Normalized coordinates (0 to 1 relative to width and height)
  x: number;
  y: number;
  w: number;
  h: number;
  timestamp: string;
}

export interface DetectionResult {
  timestamp: string;
  detections: DetectionBox[];
  inferenceTimeMs: number;
  engine: string;
  hasFire: boolean;
  hasSmoke: boolean;
  overallThreat: 'NORMAL' | 'WARNING' | 'CRITICAL';
}

export type StreamMode = 
  | 'idle'
  | 'direct_mjpeg'
  | 'snapshot_polling'
  | 'backend_proxy_stream'
  | 'backend_proxy_snapshot'
  | 'error';

export interface CameraState {
  connected: boolean;
  mode: StreamMode;
  configuredIp: string;
  activeUrl: string;
  fps: number;
  latencyMs: number;
  lastFrameTime: number;
  error?: string;
  retrying: boolean;
  retryCount: number;
  fallbackStep: number;
  isBackendProxied: boolean;
}

export interface AlertEvent {
  id: string;
  timestamp: string;
  type: 
    | 'FIRE_DETECTED'
    | 'SMOKE_DETECTED'
    | 'GAS_LEAK'
    | 'OVERHEAT'
    | 'LOUD_SOUND'
    | 'DEVICE_OFFLINE'
    | 'DEVICE_ONLINE'
    | 'RELAY_ACTIVATED'
    | 'RELAY_DEACTIVATED';
  severity: SeverityLevel;
  title: string;
  description: string;
  source: 'AI_VISION' | 'MQ7' | 'DHT22' | 'FLAME_SENSOR' | 'SOUND_SENSOR' | 'MANUAL' | 'SYSTEM';
  value?: string | number;
  acknowledged?: boolean;
}

export interface AppSettings {
  // Device connection
  deviceId: string;
  apiKey: string;
  esp32Endpoint: string;
  
  // Camera & Stream
  cameraIp: string;
  cameraCustomUrl: string;
  cameraStreamPort: number;
  cameraStreamPath: string;
  cameraSnapshotPath: string;
  snapshotIntervalMs: number;
  streamTimeoutMs: number;
  autoFallback: boolean;

  // AI & Detection
  aiBackendUrl: string; // e.g. http://localhost:8000
  aiEngine: 'builtin_cv' | 'local_fastapi' | 'gemini_multimodal';
  fireConfidenceThreshold: number; // 0.1 - 0.99
  smokeConfidenceThreshold: number; // 0.1 - 0.99
  minDetectionFrames: number;

  // Sensor Thresholds
  coWarningPpm: number; // e.g. 50
  coCriticalPpm: number; // e.g. 150
  tempWarningC: number; // e.g. 45
  tempCriticalC: number; // e.g. 60
  soundAlertDb: number; // e.g. 80

  // Safety & Actuators
  relaySafetyArmed: boolean;
  relayAutoOffSeconds: number; // auto-timeout shutoff
  audioAlertsEnabled: boolean;

  // Demo / Simulation
  demoMode: boolean;
  demoScenario: 'normal' | 'gas_leak' | 'high_temp' | 'active_fire' | 'evac_alarm';
}
