/**
 * FIREGUARD AI - ESP32 SAFETY ROBOT (BLE NORDIC UART VERSION)
 * Web Bluetooth compatible for direct 1-click browser connection!
 */

#include <Arduino.h>
#include <DHT.h>
#include <TinyGPSPlus.h>
#include <AccelStepper.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// =================================================
//                  BLE UART CONFIG
// =================================================
#define SERVICE_UUID           "6e400001-b5a3-f393-e0a9-e50e24dcca9e" // Nordic UART Service
#define CHARACTERISTIC_UUID_RX "6e400002-b5a3-f393-e0a9-e50e24dcca9e"
#define CHARACTERISTIC_UUID_TX "6e400003-b5a3-f393-e0a9-e50e24dcca9e"

BLEServer *pServer = NULL;
BLECharacteristic *pTxCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;

// =================================================
//                  PIN CONFIGURATION
// =================================================
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

// =================================================
//                  SETTINGS
// =================================================
const int MQ7_THRESHOLD = 1900;
const bool FLAME_ACTIVE_LOW = true;
const bool SOUND_ACTIVE_LOW = true;
const bool SOUND_STOPS_MOTORS = false;
const bool ENABLE_MQ7_MOTOR_STOP = false;

// =================================================
//                  OBJECTS
// =================================================
DHT dht(DHT_PIN, DHT_TYPE);
TinyGPSPlus gps;
HardwareSerial GPSSerial(2);

AccelStepper motor1(AccelStepper::DRIVER, STEP1_PIN, DIR1_PIN);
AccelStepper motor2(AccelStepper::DRIVER, STEP2_PIN, DIR2_PIN);

// =================================================
//                  VARIABLES
// =================================================
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

// Forward declarations
void setMovement(char command);
void broadcastBleTelemetry();

// =================================================
//             BLE SERVER CALLBACKS
// =================================================
class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
      Serial.println("[BLE] Web Dashboard Connected!");
    };

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
      Serial.println("[BLE] Disconnected. Restarting Advertising...");
      // Auto stop motors on disconnect
      setMovement('S');
    }
};

class MyCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String rxValue = pCharacteristic->getValue();
      if (rxValue.length() > 0) {
        for (int i = 0; i < rxValue.length(); i++) {
          char c = rxValue[i];
          if (c != '\n' && c != '\r' && c != ' ') {
            setMovement(c);
          }
        }
      }
    }
};

void initBLE() {
  BLEDevice::init("FIREGUARD_ROBOT");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  pTxCharacteristic = pService->createCharacteristic(
                        CHARACTERISTIC_UUID_TX,
                        BLECharacteristic::PROPERTY_NOTIFY
                      );
  pTxCharacteristic->addDescriptor(new BLE2902());

  BLECharacteristic *pRxCharacteristic = pService->createCharacteristic(
                                           CHARACTERISTIC_UUID_RX,
                                           BLECharacteristic::PROPERTY_WRITE
                                         );
  pRxCharacteristic->setCallbacks(new MyCallbacks());

  pService->start();

  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  Serial.println("[BLE] Ready & Advertising as 'FIREGUARD_ROBOT'");
}

// =================================================
//                       SETUP
// =================================================
void setup() {
  Serial.begin(115200);

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

  initBLE();

  Serial.println("\n[ROBOT] Initialized with Stepper Motors, Sensors & Web Bluetooth!");
}

void readSensors() {
  mq7Value = analogRead(MQ7_PIN);
  int flameRaw = digitalRead(FLAME_PIN);
  int soundRaw = digitalRead(SOUND_PIN);

  temperature = dht.readTemperature();
  humidity = dht.readHumidity();

  fireDetected = FLAME_ACTIVE_LOW ? (flameRaw == LOW) : (flameRaw == HIGH);
  soundDetected = SOUND_ACTIVE_LOW ? (soundRaw == LOW) : (soundRaw == HIGH);
  coAnalogHigh = (mq7Value >= MQ7_THRESHOLD);

  Serial.printf("[SENSORS] MQ7: %d | Flame: %s | Sound: %s | Temp: %.1fC | Hum: %.1f%%\n",
                mq7Value, fireDetected ? "YES" : "NO", soundDetected ? "YES" : "NO",
                isnan(temperature) ? 0.0 : temperature, isnan(humidity) ? 0.0 : humidity);

  broadcastBleTelemetry();
}

void broadcastBleTelemetry() {
  if (!deviceConnected || pTxCharacteristic == NULL) return;

  double lat = gps.location.isValid() ? gps.location.lat() : 37.774900;
  double lng = gps.location.isValid() ? gps.location.lng() : -122.419400;
  float t = isnan(temperature) ? 24.5 : temperature;
  float h = isnan(humidity) ? 48.0 : humidity;

  String json = "{";
  json += "\"mq7Value\":" + String(mq7Value) + ",";
  json += "\"mq7_ppm\":" + String(mq7Value / 40.0, 1) + ",";
  json += "\"fireDetected\":" + String(fireDetected ? "true" : "false") + ",";
  json += "\"soundDetected\":" + String(soundDetected ? "true" : "false") + ",";
  json += "\"temperature\":" + String(t, 1) + ",";
  json += "\"humidity\":" + String(h, 1) + ",";
  json += "\"lat\":" + String(lat, 6) + ",";
  json += "\"lng\":" + String(lng, 6) + ",";
  json += "\"movement\":\"" + String(movementCommand) + "\"";
  json += "}\n";

  pTxCharacteristic->setValue((uint8_t*)json.c_str(), json.length());
  pTxCharacteristic->notify();
}

void readGPS() {
  while (GPSSerial.available() > 0) {
    gps.encode(GPSSerial.read());
  }
}

void setMovement(char command) {
  command = toupper(command);
  switch (command) {
    case 'F':
    case 'B':
    case 'L':
    case 'R':
    case 'S':
      movementCommand = command;
      Serial.printf("[CMD] Set Movement: %c\n", movementCommand);
      break;
  }
}

void updateMotors() {
  bool danger = fireDetected;
  if (ENABLE_MQ7_MOTOR_STOP && coAnalogHigh) danger = true;
  if (SOUND_STOPS_MOTORS && soundDetected) danger = true;

  if (danger || movementCommand == 'S') {
    motor1.setSpeed(0);
    motor2.setSpeed(0);
    digitalWrite(ENABLE_PIN, HIGH); // Disable
    return;
  }

  digitalWrite(ENABLE_PIN, LOW); // Enable
  switch (movementCommand) {
    case 'F': motor1.setSpeed(500);  motor2.setSpeed(500);  break;
    case 'B': motor1.setSpeed(-500); motor2.setSpeed(-500); break;
    case 'L': motor1.setSpeed(-350); motor2.setSpeed(350);  break;
    case 'R': motor1.setSpeed(350);  motor2.setSpeed(-350); break;
  }
  motor1.runSpeed();
  motor2.runSpeed();
}

void updateBuzzer() {
  bool alarm = fireDetected || (ENABLE_MQ7_MOTOR_STOP && coAnalogHigh);
  digitalWrite(BUZZER_PIN, alarm ? HIGH : LOW);
}

void loop() {
  // Serial command line
  while (Serial.available() > 0) {
    char c = Serial.read();
    if (c != '\n' && c != '\r' && c != ' ') setMovement(c);
  }

  // Periodic sensor read
  if (millis() - lastSensorRead >= SENSOR_INTERVAL) {
    lastSensorRead = millis();
    readSensors();
  }

  // GPS continuous parse
  readGPS();

  // Motors & Buzzer
  updateMotors();
  updateBuzzer();

  // Re-advertising if disconnected
  if (!deviceConnected && oldDeviceConnected) {
    delay(500);
    pServer->startAdvertising();
    oldDeviceConnected = deviceConnected;
  }
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }
}
