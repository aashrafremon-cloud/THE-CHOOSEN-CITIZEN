import React, { useState } from 'react';
import { 
  BookOpen, 
  Cpu, 
  Video, 
  Terminal, 
  Network, 
  Copy, 
  Check, 
  Play, 
  ShieldAlert,
  ArrowRight,
  ExternalLink
} from 'lucide-react';

interface DocsViewProps {
  onSendTestPacket: () => void;
}

export const DocsView: React.FC<DocsViewProps> = ({ onSendTestPacket }) => {
  const [activeCodeTab, setActiveCodeTab] = useState<'esp32' | 'cam' | 'python' | 'curl'>('esp32');
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  const copyCode = (text: string, tabId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(tabId);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  const curlExample = `curl -X POST http://localhost:3000/api/esp32/telemetry \\
  -H "Content-Type: application/json" \\
  -d '{
    "deviceId": "ESP32-NODE-01",
    "temperature": 28.4,
    "humidity": 45.2,
    "mq7_co_ppm": 22.0,
    "flame_detected": false,
    "flame_raw": 3950,
    "sound_db": 44.5,
    "gps": { "lat": 37.7749, "lng": -122.4194 }
  }'`;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Banner */}
      <div className="bg-[#0e1422] border border-zinc-800 rounded-xl p-5 shadow-xl">
        <h2 className="font-mono text-sm font-bold text-zinc-100 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-red-400" />
          HARDWARE INTEGRATION & ARCHITECTURE MANUAL
        </h2>
        <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
          Step-by-step schematics, pinout tables, firmware source code, and remote networking bridging guide
        </p>
      </div>

      {/* Network Bridging Guide (Public Frontend -> Local Private LAN) */}
      <div className="bg-[#0e1422] border border-zinc-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-zinc-800/80">
          <Network className="w-4 h-4 text-cyan-400" />
          <h3 className="font-mono text-sm font-bold text-zinc-100">
            CONNECTING CLOUD FRONTEND TO PRIVATE CAMERA & ESP32 NETWORK
          </h3>
        </div>

        <p className="text-xs text-zinc-300 font-mono leading-relaxed">
          When this dashboard is hosted in the cloud (HTTPS), browsers enforce security policies preventing web pages from making plain HTTP calls to private LAN subnets (<code className="text-zinc-200">192.168.x.x</code>). Choose one of the following methods:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
          <div className="p-3.5 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2">
            <div className="font-bold text-amber-400 flex items-center gap-1.5">
              <span>METHOD A (Recommended)</span>
            </div>
            <div className="text-zinc-200 font-semibold">Cloudflare Tunnel</div>
            <p className="text-[11px] text-zinc-400">
              100% free, zero port forwarding required. Exposes your local Python backend to secure HTTPS.
            </p>
            <pre className="p-2 rounded bg-black/60 border border-zinc-800 text-[10px] text-emerald-400 overflow-x-auto">
              cloudflared tunnel --url http://localhost:8000
            </pre>
            <p className="text-[10px] text-zinc-400">
              Paste the resulting https URL into <strong>Settings → AI & Backend URL</strong>.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2">
            <div className="font-bold text-cyan-400 flex items-center gap-1.5">
              <span>METHOD B</span>
            </div>
            <div className="text-zinc-200 font-semibold">ngrok Tunnel</div>
            <p className="text-[11px] text-zinc-400">
              Instant public HTTPS tunnel for local FastAPI YOLO server & camera proxy.
            </p>
            <pre className="p-2 rounded bg-black/60 border border-zinc-800 text-[10px] text-emerald-400 overflow-x-auto">
              ngrok http 8000
            </pre>
            <p className="text-[10px] text-zinc-400">
              Copy the https://xxxx.ngrok-free.app address into Settings.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2">
            <div className="font-bold text-emerald-400 flex items-center gap-1.5">
              <span>METHOD C</span>
            </div>
            <div className="text-zinc-200 font-semibold">Local LAN Execution</div>
            <p className="text-[11px] text-zinc-400">
              Run both frontend and backend on the same local network (e.g. Raspberry Pi or laptop).
            </p>
            <pre className="p-2 rounded bg-black/60 border border-zinc-800 text-[10px] text-emerald-400 overflow-x-auto">
              npm run dev  # Port 3000
            </pre>
            <p className="text-[10px] text-zinc-400">
              All direct HTTP camera streams (:81/stream) connect immediately.
            </p>
          </div>
        </div>
      </div>

      {/* Hardware Wiring Pinout Table */}
      <div className="bg-[#0e1422] border border-zinc-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-zinc-800/80">
          <Cpu className="w-4 h-4 text-emerald-400" />
          <h3 className="font-mono text-sm font-bold text-zinc-100">
            ESP32 HARDWARE PIN CONNECTIONS & SCHEMATIC
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-[10px] text-zinc-400 uppercase">
                <th className="py-2 px-3">Component</th>
                <th className="py-2 px-3">Sensor / Driver Pin</th>
                <th className="py-2 px-3">ESP32 Pin</th>
                <th className="py-2 px-3">Voltage</th>
                <th className="py-2 px-3">Function / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              <tr>
                <td className="py-2 px-3 font-bold text-zinc-200">MQ-7 CO Sensor</td>
                <td className="py-2 px-3 text-zinc-400">AOUT</td>
                <td className="py-2 px-3 text-emerald-400 font-bold">GPIO 34 (ADC1_6)</td>
                <td className="py-2 px-3 text-zinc-300">5V VCC / 3.3V ADC</td>
                <td className="py-2 px-3 text-zinc-400">Carbon Monoxide detection (Threshold: 1900 ADC)</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-bold text-zinc-200">DHT22</td>
                <td className="py-2 px-3 text-zinc-400">DATA</td>
                <td className="py-2 px-3 text-emerald-400 font-bold">GPIO 4</td>
                <td className="py-2 px-3 text-zinc-300">3.3V</td>
                <td className="py-2 px-3 text-zinc-400">Ambient Temperature & Humidity (requires 10k pullup)</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-bold text-zinc-200">Flame Sensor</td>
                <td className="py-2 px-3 text-zinc-400">DOUT</td>
                <td className="py-2 px-3 text-emerald-400 font-bold">GPIO 27</td>
                <td className="py-2 px-3 text-zinc-300">3.3V</td>
                <td className="py-2 px-3 text-zinc-400">Active LOW optical flame detector (Halts motors on trigger)</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-bold text-zinc-200">Sound Sensor</td>
                <td className="py-2 px-3 text-zinc-400">DOUT</td>
                <td className="py-2 px-3 text-emerald-400 font-bold">GPIO 26</td>
                <td className="py-2 px-3 text-zinc-300">3.3V</td>
                <td className="py-2 px-3 text-zinc-400">Active LOW acoustic event detection</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-bold text-zinc-200">Alarm Buzzer</td>
                <td className="py-2 px-3 text-zinc-400">POS (+)</td>
                <td className="py-2 px-3 text-emerald-400 font-bold">GPIO 13</td>
                <td className="py-2 px-3 text-zinc-300">3.3V / 5V</td>
                <td className="py-2 px-3 text-zinc-400">Sounds alarm when flame or critical gas is detected</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-bold text-zinc-200">GPS NEO-7M</td>
                <td className="py-2 px-3 text-zinc-400">TX / RX</td>
                <td className="py-2 px-3 text-emerald-400 font-bold">GPIO 16 / GPIO 17</td>
                <td className="py-2 px-3 text-zinc-300">3.3V</td>
                <td className="py-2 px-3 text-zinc-400">Hardware Serial2 @ 9600 baud for coordinates</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-bold text-zinc-200">A4988 Driver 1 (Left)</td>
                <td className="py-2 px-3 text-zinc-400">STEP / DIR</td>
                <td className="py-2 px-3 text-emerald-400 font-bold">GPIO 18 / GPIO 19</td>
                <td className="py-2 px-3 text-zinc-300">Logic 3.3V / Motor 12V</td>
                <td className="py-2 px-3 text-zinc-400">Left Stepper Motor controller (max speed 800)</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-bold text-zinc-200">A4988 Driver 2 (Right)</td>
                <td className="py-2 px-3 text-zinc-400">STEP / DIR</td>
                <td className="py-2 px-3 text-emerald-400 font-bold">GPIO 25 / GPIO 33</td>
                <td className="py-2 px-3 text-zinc-300">Logic 3.3V / Motor 12V</td>
                <td className="py-2 px-3 text-zinc-400">Right Stepper Motor controller (max speed 800)</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-bold text-zinc-200">Shared Drivers ENABLE</td>
                <td className="py-2 px-3 text-zinc-400">ENABLE</td>
                <td className="py-2 px-3 text-emerald-400 font-bold">GPIO 23</td>
                <td className="py-2 px-3 text-zinc-300">Logic 3.3V</td>
                <td className="py-2 px-3 text-zinc-400">Active LOW: LOW = Drivers Enabled; HIGH = Motors Disabled & Safe</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Firmware & Code Viewer */}
      <div className="bg-[#0e1422] border border-zinc-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-zinc-800/80 gap-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-red-400" />
            <h3 className="font-mono text-sm font-bold text-zinc-100">FIRMWARE & BLUETOOTH CODE SAMPLES</h3>
          </div>

          <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-xs font-mono">
            <button
              onClick={() => setActiveCodeTab('bt_classic' as any)}
              className={`px-3 py-1 rounded transition-colors ${
                (activeCodeTab as any) === 'bt_classic' ? 'bg-blue-600 text-white font-bold' : 'text-zinc-400'
              }`}
            >
              ROBOT BT CLASSIC
            </button>
            <button
              onClick={() => setActiveCodeTab('bt_ble' as any)}
              className={`px-3 py-1 rounded transition-colors ${
                (activeCodeTab as any) === 'bt_ble' ? 'bg-blue-600 text-white font-bold' : 'text-zinc-400'
              }`}
            >
              ROBOT WEB BLE
            </button>
            <button
              onClick={() => setActiveCodeTab('cam')}
              className={`px-3 py-1 rounded transition-colors ${
                activeCodeTab === 'cam' ? 'bg-zinc-700 text-white font-bold' : 'text-zinc-400'
              }`}
            >
              ESP32-CAM INO
            </button>
            <button
              onClick={() => setActiveCodeTab('python')}
              className={`px-3 py-1 rounded transition-colors ${
                activeCodeTab === 'python' ? 'bg-zinc-700 text-white font-bold' : 'text-zinc-400'
              }`}
            >
              FASTAPI MAIN.PY
            </button>
            <button
              onClick={() => setActiveCodeTab('curl')}
              className={`px-3 py-1 rounded transition-colors ${
                activeCodeTab === 'curl' ? 'bg-zinc-700 text-white font-bold' : 'text-zinc-400'
              }`}
            >
              CURL TEST
            </button>
          </div>
        </div>

        {/* Code Content Box */}
        <div className="relative">
          <pre className="p-4 rounded-lg bg-black border border-zinc-800 text-xs font-mono text-zinc-300 overflow-x-auto max-h-[460px]">
            {(activeCodeTab as any) === 'bt_classic' && `#include <Arduino.h>
#include <DHT.h>
#include <TinyGPSPlus.h>
#include <AccelStepper.h>
#include "BluetoothSerial.h"

// Bluetooth Serial object
BluetoothSerial SerialBT;
const char* BT_DEVICE_NAME = "FIREGUARD_ROBOT";

// Pin Configuration
#define MQ7_PIN 34
#define DHT_PIN 4
#define DHT_TYPE DHT22
#define FLAME_PIN 27
#define SOUND_PIN 26
#define BUZZER_PIN 13
#define GPS_RX_PIN 16
#define GPS_TX_PIN 17
#define STEP1_PIN 18
#define DIR1_PIN 19
#define STEP2_PIN 25
#define DIR2_PIN 33
#define ENABLE_PIN 23

const int MQ7_THRESHOLD = 1900;
const bool FLAME_ACTIVE_LOW = true;
const bool SOUND_ACTIVE_LOW = true;
const bool SOUND_STOPS_MOTORS = false;
const bool ENABLE_MQ7_MOTOR_STOP = false;

DHT dht(DHT_PIN, DHT_TYPE);
TinyGPSPlus gps;
HardwareSerial GPSSerial(2);

AccelStepper motor1(AccelStepper::DRIVER, STEP1_PIN, DIR1_PIN);
AccelStepper motor2(AccelStepper::DRIVER, STEP2_PIN, DIR2_PIN);

int mq7Value = 0;
float temperature = NAN;
float humidity = NAN;
bool fireDetected = false;
bool soundDetected = false;
bool coAnalogHigh = false;
char movementCommand = 'S';

unsigned long lastSensorRead = 0;
unsigned long lastGPSReport = 0;
const unsigned long SENSOR_INTERVAL = 2000;
const unsigned long GPS_INTERVAL = 5000;

void setup() {
  Serial.begin(115200);
  SerialBT.begin(BT_DEVICE_NAME); // Starts Bluetooth Serial as "FIREGUARD_ROBOT"

  pinMode(MQ7_PIN, INPUT);
  pinMode(FLAME_PIN, INPUT);
  pinMode(SOUND_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(ENABLE_PIN, OUTPUT);

  digitalWrite(ENABLE_PIN, HIGH); // Disabled by default
  digitalWrite(BUZZER_PIN, LOW);

  analogReadResolution(12);
  dht.begin();
  GPSSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  motor1.setMaxSpeed(800);
  motor2.setMaxSpeed(800);
  motor1.setSpeed(0);
  motor2.setSpeed(0);

  Serial.println("ESP32 SAFETY ROBOT INITIALIZED WITH BLUETOOTH!");
  SerialBT.println("ROBOT ONLINE & READY OVER BLUETOOTH");
}

void setMovement(char command) {
  command = toupper(command);
  switch (command) {
    case 'F': case 'B': case 'L': case 'R': case 'S':
      movementCommand = command;
      Serial.print("Movement: "); Serial.println(movementCommand);
      if (SerialBT.hasClient()) {
        SerialBT.print("ACK: "); SerialBT.println(movementCommand);
      }
      break;
  }
}

void broadcastTelemetry() {
  if (!SerialBT.hasClient()) return;
  double lat = gps.location.isValid() ? gps.location.lat() : 37.774900;
  double lng = gps.location.isValid() ? gps.location.lng() : -122.419400;
  float t = isnan(temperature) ? 24.5 : temperature;
  float h = isnan(humidity) ? 48.0 : humidity;

  String json = "{";
  json += "\\"deviceId\\":\\"" + String(BT_DEVICE_NAME) + "\\",";
  json += "\\"mq7Value\\":" + String(mq7Value) + ",";
  json += "\\"mq7_ppm\\":" + String(mq7Value / 40.0, 1) + ",";
  json += "\\"fireDetected\\":" + String(fireDetected ? "true" : "false") + ",";
  json += "\\"soundDetected\\":" + String(soundDetected ? "true" : "false") + ",";
  json += "\\"temperature\\":" + String(t, 1) + ",";
  json += "\\"humidity\\":" + String(h, 1) + ",";
  json += "\\"lat\\":" + String(lat, 6) + ",";
  json += "\\"lng\\":" + String(lng, 6) + ",";
  json += "\\"movement\\":\\"" + String(movementCommand) + "\\"";
  json += "}";
  SerialBT.println(json);
}

void loop() {
  // Read Serial commands (USB)
  while (Serial.available() > 0) {
    char c = Serial.read();
    if (c != '\\n' && c != '\\r' && c != ' ') setMovement(c);
  }

  // Read Bluetooth commands (Wireless)
  while (SerialBT.available() > 0) {
    char c = SerialBT.read();
    if (c != '\\n' && c != '\\r' && c != ' ') setMovement(c);
  }

  // Periodic sensor readings
  if (millis() - lastSensorRead >= SENSOR_INTERVAL) {
    lastSensorRead = millis();
    readSensors();
    broadcastTelemetry();
  }

  readGPS();
  updateMotors();
  updateBuzzer();
}`}
            {(activeCodeTab as any) === 'bt_ble' && `// Full Web Bluetooth BLE code located in /firmware/esp32_safety_robot_ble.ino\n// Uses Nordic UART Service UUID 6e400001-b5a3-f393-e0a9-e50e24dcca9e for 1-click browser connection!`}
            {activeCodeTab === 'curl' && curlExample}
            {activeCodeTab === 'cam' && `// Full camera firmware located in /firmware/esp32_cam_streamer.ino\n// Provides :81/stream MJPEG and /capture snapshot endpoints`}
            {activeCodeTab === 'python' && `// Python FastAPI YOLO backend located in /backend/main.py\n// Run with: uvicorn main:app --host 0.0.0.0 --port 8000`}
          </pre>

          <button
            onClick={() => copyCode(
              (activeCodeTab as any) === 'bt_classic' 
                ? document.querySelector('pre')?.innerText || ''
                : 'See file in workspace', 
              activeCodeTab
            )}
            className="absolute top-3 right-3 p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors text-xs font-mono flex items-center gap-1 shadow-md"
          >
            {copiedTab === activeCodeTab ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedTab === activeCodeTab ? 'COPIED CODE' : 'COPY ARDUINO CODE'}</span>
          </button>
        </div>

        {/* Interactive Test Packet Sender */}
        <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-between">
          <div>
            <div className="font-mono text-xs font-bold text-zinc-200">Test Telemetry Ingestion API</div>
            <p className="font-mono text-[11px] text-zinc-400 mt-0.5">
              Simulate an incoming HTTP POST from an ESP32 to verify end-to-end ingestion and chart updates.
            </p>
          </div>
          <button
            onClick={onSendTestPacket}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>SEND SAMPLE POST</span>
          </button>
        </div>
      </div>
    </div>
  );
};
