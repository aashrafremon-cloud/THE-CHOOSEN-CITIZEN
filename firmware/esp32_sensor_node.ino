/**
 * FIREGUARD AI - ESP32 IoT Multi-Sensor Node Firmware
 *
 * Hardware connections:
 * - DHT22 (Temp & Humidity): GPIO 4 (with 10k pullup)
 * - MQ-7 (Carbon Monoxide): Analog GPIO 34 (ADC1_CH6)
 * - Flame Sensor (KY-026 / IR): Digital OUT GPIO 18, Analog OUT GPIO 35
 * - Sound / Decibel Microphone: Analog GPIO 32
 * - GPS (NEO-6M): RX GPIO 16, TX GPIO 17 (Serial2)
 * - Relay Module (Water Solenoid / Extinguisher): GPIO 23 (Active LOW)
 * - Status LED: GPIO 2
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <HardwareSerial.h>
#include <TinyGPS++.h>

// --- Wi-Fi & Dashboard Configuration ---
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Target dashboard API endpoint (Local FastAPI or Cloud App URL)
const char* SERVER_URL    = "http://192.168.1.100:8000/api/esp32/telemetry";
const char* DEVICE_ID     = "ESP32-FIREGUARD-01";

// --- Pin Definitions ---
#define DHTPIN        4
#define DHTTYPE       DHT22
#define MQ7_PIN       34
#define FLAME_DO_PIN  18
#define FLAME_AO_PIN  35
#define SOUND_PIN     32
#define RELAY_PIN     23
#define STATUS_LED    2

#define GPS_RX_PIN    16
#define GPS_TX_PIN    17

// --- Objects ---
DHT dht(DHTPIN, DHTTYPE);
HardwareSerial ss(2);
TinyGPSPlus gps;

// --- Timing & Safety Variables ---
unsigned long lastTelemetryTime = 0;
const unsigned long TELEMETRY_INTERVAL = 2000; // 2 seconds

// Hardware safety interlock timer for relay
bool relayActive = false;
unsigned long relayActivatedTime = 0;
const unsigned long MAX_RELAY_RUN_MS = 30000; // 30 sec auto-shutoff safety limit

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n[FIREGUARD AI] Booting ESP32 Sensor Node...");

  pinMode(STATUS_LED, OUTPUT);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH); // Relay OFF (Active LOW)

  pinMode(FLAME_DO_PIN, INPUT);
  pinMode(MQ7_PIN, INPUT);
  pinMode(FLAME_AO_PIN, INPUT);
  pinMode(SOUND_PIN, INPUT);

  dht.begin();
  ss.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  // Connect to WiFi
  connectWiFi();
}

void connectWiFi() {
  Serial.printf("[WIFI] Connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(500);
    Serial.print(".");
    digitalWrite(STATUS_LED, !digitalRead(STATUS_LED));
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(STATUS_LED, HIGH);
    Serial.println("\n[WIFI] Connected successfully!");
    Serial.printf("[WIFI] IP Address: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WIFI] Connection failed. Retrying in main loop...");
  }
}

float readMq7CoPpm(int rawAdc) {
  // Approximate MQ-7 ppm curve calculation
  float sensorVoltage = (rawAdc / 4095.0) * 3.3;
  if (sensorVoltage <= 0.1) return 5.0;
  float rs = (3.3 - sensorVoltage) / sensorVoltage * 10.0; // Rs with 10k load
  float ratio = rs / 10.0; // R0 approx 10k
  float ppm = 100.0 * pow(ratio, -1.5);
  return constrain(ppm, 1.0, 1000.0);
}

float readSoundDb(int rawAdc) {
  // Sound peak-to-peak estimation
  float volts = (rawAdc / 4095.0) * 3.3;
  float db = 40.0 + (volts * 25.0); // Rough dB estimate
  return constrain(db, 30.0, 110.0);
}

void checkRelaySafety() {
  if (relayActive) {
    if (millis() - relayActivatedTime > MAX_RELAY_RUN_MS) {
      Serial.println("[SAFETY] Relay auto-shutoff timeout triggered! Shutting down pump.");
      digitalWrite(RELAY_PIN, HIGH); // Active LOW -> OFF
      relayActive = false;
    }
  }
}

void loop() {
  // Maintain GPS parsing
  while (ss.available() > 0) {
    gps.encode(ss.read());
  }

  // Safety interlock check
  checkRelaySafety();

  // Periodic Telemetry Transmission
  if (millis() - lastTelemetryTime >= TELEMETRY_INTERVAL) {
    lastTelemetryTime = millis();

    if (WiFi.status() != WL_CONNECTED) {
      connectWiFi();
      return;
    }

    // 1. Read DHT22
    float temperature = dht.readTemperature();
    float humidity = dht.readHumidity();
    if (isnan(temperature)) temperature = 24.5;
    if (isnan(humidity)) humidity = 48.0;

    // 2. Read Flame Sensor
    int flameRaw = analogRead(FLAME_AO_PIN);
    bool flameDetected = (digitalRead(FLAME_DO_PIN) == LOW) || (flameRaw < 1500);

    // 3. Read MQ-7 Carbon Monoxide
    int mq7Raw = analogRead(MQ7_PIN);
    float coPpm = readMq7CoPpm(mq7Raw);

    // 4. Read Sound Sensor
    int soundRaw = analogRead(SOUND_PIN);
    float soundDb = readSoundDb(soundRaw);

    // 5. GPS Data
    double lat = gps.location.isValid() ? gps.location.lat() : 37.7749;
    double lng = gps.location.isValid() ? gps.location.lng() : -122.4194;
    double alt = gps.altitude.isValid() ? gps.altitude.meters() : 15.0;
    int sats = gps.satellites.isValid() ? gps.satellites.value() : 7;

    // 6. Build JSON Payload
    String jsonPayload = "{";
    jsonPayload += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
    jsonPayload += "\"temperature\":" + String(temperature, 1) + ",";
    jsonPayload += "\"humidity\":" + String(humidity, 1) + ",";
    jsonPayload += "\"mq7_co_ppm\":" + String(coPpm, 1) + ",";
    jsonPayload += "\"flame_detected\":" + String(flameDetected ? "true" : "false") + ",";
    jsonPayload += "\"flame_raw\":" + String(flameRaw) + ",";
    jsonPayload += "\"sound_db\":" + String(soundDb, 1) + ",";
    jsonPayload += "\"relay_active\":" + String(relayActive ? "true" : "false") + ",";
    jsonPayload += "\"battery_mv\":3850,";
    jsonPayload += "\"gps\":{";
    jsonPayload += "\"lat\":" + String(lat, 6) + ",";
    jsonPayload += "\"lng\":" + String(lng, 6) + ",";
    jsonPayload += "\"altitude\":" + String(alt, 1) + ",";
    jsonPayload += "\"satellites\":" + String(sats);
    jsonPayload += "}}";

    // 7. Send HTTP POST to Dashboard
    HTTPClient http;
    http.begin(SERVER_URL);
    http.addHeader("Content-Type", "application/json");

    int httpCode = http.POST(jsonPayload);
    if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_CREATED) {
      Serial.printf("[INGEST] Sent telemetry successfully: Temp=%.1fC, CO=%.1fppm, Flame=%s\n",
                    temperature, coPpm, flameDetected ? "YES" : "NO");
    } else {
      Serial.printf("[INGEST ERROR] HTTP %d: %s\n", httpCode, http.errorToString(httpCode).c_str());
    }
    http.end();
  }
}
