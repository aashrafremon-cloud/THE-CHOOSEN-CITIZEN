#include <Arduino.h>
#include <DHT.h>
#include <TinyGPSPlus.h>
#include <AccelStepper.h>
#include <math.h>

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// =================================================
//                  PIN CONFIGURATION
// =================================================

// MQ-7 Gas Sensor
#define MQ7_PIN 34

// DHT22 Temperature & Humidity
#define DHT_PIN 4
#define DHT_TYPE DHT22

// Digital sensors
#define FLAME_PIN 27
#define SOUND_PIN 26

// Buzzer
#define BUZZER_PIN 13

// GPS NEO-7M
#define GPS_RX_PIN 16
#define GPS_TX_PIN 17

// A4988 Driver 1 (Left Motor)
#define STEP1_PIN 18
#define DIR1_PIN 19

// A4988 Driver 2 (Right Motor)
#define STEP2_PIN 25
#define DIR2_PIN 33

// Shared ENABLE (Active LOW)
#define ENABLE_PIN 23

// =================================================
//                    BLE CONFIG
// =================================================

#define BLE_DEVICE_NAME "ESP32_Safety_Robot"

#define SERVICE_UUID \
  "12345678-1234-1234-1234-1234567890ab"

#define TX_UUID \
  "12345678-1234-1234-1234-1234567890ac"

// =================================================
//                      SETTINGS
// =================================================

const int MQ7_THRESHOLD = 1900;

const bool FLAME_ACTIVE_LOW = true;
const bool SOUND_ACTIVE_LOW = true;

const bool SOUND_STOPS_MOTORS = false;

// Enable only after proper sensor calibration.
const bool ENABLE_MQ7_MOTOR_STOP = false;

// =================================================
//                      OBJECTS
// =================================================

DHT dht(DHT_PIN, DHT_TYPE);

TinyGPSPlus gps;
HardwareSerial GPSSerial(2);

AccelStepper motor1(
  AccelStepper::DRIVER,
  STEP1_PIN,
  DIR1_PIN
);

AccelStepper motor2(
  AccelStepper::DRIVER,
  STEP2_PIN,
  DIR2_PIN
);

BLECharacteristic *txCharacteristic = nullptr;

volatile bool bleConnected = false;

// =================================================
//                     VARIABLES
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
unsigned long lastBLEReport = 0;

const unsigned long SENSOR_INTERVAL = 2000;
const unsigned long GPS_INTERVAL = 5000;
const unsigned long BLE_INTERVAL = 2000;

// =================================================
//                   BLE CALLBACKS
// =================================================

class RobotServerCallbacks : public BLEServerCallbacks {

  void onConnect(BLEServer *server) override {
    bleConnected = true;

    Serial.println("BLE: Website connected");
  }

  void onDisconnect(BLEServer *server) override {
    bleConnected = false;

    // Stop motors as a safety precaution.
    movementCommand = 'S';

    motor1.setSpeed(0);
    motor2.setSpeed(0);

    digitalWrite(ENABLE_PIN, HIGH);

    Serial.println("BLE: Website disconnected");

    // Allow the website to reconnect.
    BLEDevice::startAdvertising();
  }
};

// =================================================
//                     BLE SETUP
// =================================================

void setupBLE() {

  BLEDevice::init(BLE_DEVICE_NAME);

  BLEServer *server = BLEDevice::createServer();

  server->setCallbacks(new RobotServerCallbacks());

  BLEService *service =
    server->createService(SERVICE_UUID);

  // ESP32 -> Website: sensor notifications only
  txCharacteristic = service->createCharacteristic(
    TX_UUID,
    BLECharacteristic::PROPERTY_NOTIFY
  );

  txCharacteristic->addDescriptor(new BLE2902());

  service->start();

  BLEAdvertising *advertising =
    BLEDevice::getAdvertising();

  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setScanResponse(true);

  BLEDevice::startAdvertising();

  Serial.println();
  Serial.println("==================================");
  Serial.println("BLE SERVER STARTED");
  Serial.print("Device Name: ");
  Serial.println(BLE_DEVICE_NAME);
  Serial.println("Waiting for website connection...");
  Serial.println("==================================");
}

// =================================================
//                    READ SENSORS
// =================================================

void readSensors() {

  mq7Value = analogRead(MQ7_PIN);

  int flameRaw = digitalRead(FLAME_PIN);
  int soundRaw = digitalRead(SOUND_PIN);

  temperature = dht.readTemperature();
  humidity = dht.readHumidity();

  fireDetected = FLAME_ACTIVE_LOW
    ? (flameRaw == LOW)
    : (flameRaw == HIGH);

  soundDetected = SOUND_ACTIVE_LOW
    ? (soundRaw == LOW)
    : (soundRaw == HIGH);

  // Raw ADC threshold only; not calibrated CO ppm.
  coAnalogHigh = (mq7Value >= MQ7_THRESHOLD);

  Serial.println();
  Serial.println("========== SENSOR DATA ==========");

  Serial.print("MQ-7 ADC: ");
  Serial.println(mq7Value);

  Serial.print("MQ-7 Threshold: ");
  Serial.println(coAnalogHigh ? "HIGH" : "NORMAL");

  Serial.print("Flame: ");
  Serial.println(fireDetected ? "DETECTED" : "NOT DETECTED");

  Serial.print("Sound: ");
  Serial.println(soundDetected ? "DETECTED" : "NONE");

  if (isnan(temperature) || isnan(humidity)) {

    Serial.println("DHT22: READ ERROR");

  } else {

    Serial.print("Temperature: ");
    Serial.print(temperature);
    Serial.println(" C");

    Serial.print("Humidity: ");
    Serial.print(humidity);
    Serial.println(" %");
  }

  Serial.println("=================================");
}

// =================================================
//                         GPS
// =================================================

void readGPS() {

  // Always process GPS input.
  while (GPSSerial.available() > 0) {
    gps.encode(GPSSerial.read());
  }

  if (millis() - lastGPSReport >= GPS_INTERVAL) {

    lastGPSReport = millis();

    Serial.println();
    Serial.println("============ GPS DATA ============");

    if (gps.location.isValid()) {

      Serial.print("Latitude: ");
      Serial.println(gps.location.lat(), 6);

      Serial.print("Longitude: ");
      Serial.println(gps.location.lng(), 6);

    } else {

      Serial.println("GPS location unavailable");
    }

    if (gps.satellites.isValid()) {

      Serial.print("Satellites: ");
      Serial.println(gps.satellites.value());
    }

    if (gps.hdop.isValid()) {

      Serial.print("HDOP: ");
      Serial.println(gps.hdop.hdop());
    }

    Serial.println("==================================");
  }
}

// =================================================
//                  JSON DATA BUILDER
// =================================================

String createSensorJSON() {

  String json;
  json.reserve(240);

  json = "{";

  json += "\"mq7_adc\":";
  json += String(mq7Value);

  json += ",\"mq7_high\":";
  json += coAnalogHigh ? "true" : "false";

  json += ",\"temperature\":";
  if (isnan(temperature)) {
    json += "null";
  } else {
    json += String(temperature, 1);
  }

  json += ",\"humidity\":";
  if (isnan(humidity)) {
    json += "null";
  } else {
    json += String(humidity, 1);
  }

  json += ",\"flame\":";
  json += fireDetected ? "true" : "false";

  json += ",\"sound\":";
  json += soundDetected ? "true" : "false";

  json += ",\"latitude\":";
  if (gps.location.isValid()) {
    json += String(gps.location.lat(), 6);
  } else {
    json += "null";
  }

  json += ",\"longitude\":";
  if (gps.location.isValid()) {
    json += String(gps.location.lng(), 6);
  } else {
    json += "null";
  }

  json += ",\"satellites\":";
  if (gps.satellites.isValid()) {
    json += String(gps.satellites.value());
  } else {
    json += "null";
  }

  json += "}";

  return json;
}

// =================================================
//                SEND DATA OVER BLE
// =================================================

// BLE's default MTU may allow only 20 data bytes
// per notification. Send chunks ending in newline.

void sendBLEData() {

  if (!bleConnected || txCharacteristic == nullptr) {
    return;
  }

  String message = createSensorJSON();
  message += '\n';

  const size_t CHUNK_SIZE = 20;
  const size_t totalLength = message.length();

  for (size_t i = 0; i < totalLength; i += CHUNK_SIZE) {

    if (!bleConnected) {
      return;
    }

    size_t end = i + CHUNK_SIZE;

    if (end > totalLength) {
      end = totalLength;
    }

    String chunk = message.substring(i, end);

    txCharacteristic->setValue(
      (uint8_t *)chunk.c_str(),
      chunk.length()
    );

    txCharacteristic->notify();

    // Allow BLE notifications time to transmit.
    delay(10);
  }

  Serial.println("BLE: Sensor data sent");
}

// =================================================
//                  MOTOR CONTROL
// =================================================

void stopMotors() {

  movementCommand = 'S';

  motor1.setSpeed(0);
  motor2.setSpeed(0);

  digitalWrite(ENABLE_PIN, HIGH);
}

void setMovement(char command) {

  command = toupper((unsigned char)command);

  switch (command) {

    case 'F':
    case 'B':
    case 'L':
    case 'R':
    case 'S':

      movementCommand = command;

      Serial.print("Movement: ");
      Serial.println(movementCommand);

      break;

    default:

      Serial.println("Invalid command");

      break;
  }
}

void updateMotors() {

  bool danger = fireDetected;

  if (ENABLE_MQ7_MOTOR_STOP && coAnalogHigh) {
    danger = true;
  }

  if (SOUND_STOPS_MOTORS && soundDetected) {
    danger = true;
  }

  if (danger || movementCommand == 'S') {

    motor1.setSpeed(0);
    motor2.setSpeed(0);

    digitalWrite(ENABLE_PIN, HIGH);

    return;
  }

  digitalWrite(ENABLE_PIN, LOW);

  switch (movementCommand) {

    case 'F':
      motor1.setSpeed(500);
      motor2.setSpeed(500);
      break;

    case 'B':
      motor1.setSpeed(-500);
      motor2.setSpeed(-500);
      break;

    case 'L':
      motor1.setSpeed(-350);
      motor2.setSpeed(350);
      break;

    case 'R':
      motor1.setSpeed(350);
      motor2.setSpeed(-350);
      break;
  }

  motor1.runSpeed();
  motor2.runSpeed();
}

// =================================================
//                       BUZZER
// =================================================

void updateBuzzer() {

  bool alarm = fireDetected;

  if (ENABLE_MQ7_MOTOR_STOP && coAnalogHigh) {
    alarm = true;
  }

  digitalWrite(BUZZER_PIN, alarm ? HIGH : LOW);
}

// =================================================
//                        SETUP
// =================================================

void setup() {

  Serial.begin(115200);

  pinMode(MQ7_PIN, INPUT);
  pinMode(FLAME_PIN, INPUT);
  pinMode(SOUND_PIN, INPUT);

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(ENABLE_PIN, OUTPUT);

  // A4988 ENABLE is active LOW.
  digitalWrite(ENABLE_PIN, HIGH);
  digitalWrite(BUZZER_PIN, LOW);

  analogReadResolution(12);

  dht.begin();

  // GPS NEO-7M
  GPSSerial.begin(
    9600,
    SERIAL_8N1,
    GPS_RX_PIN,
    GPS_TX_PIN
  );

  motor1.setMaxSpeed(800);
  motor2.setMaxSpeed(800);

  motor1.setSpeed(0);
  motor2.setSpeed(0);

  setupBLE();

  Serial.println();
  Serial.println("==================================");
  Serial.println(" ESP32 SAFETY ROBOT");
  Serial.println(" Sensors + GPS + BLE Dashboard");
  Serial.println("==================================");

  Serial.println("BLE is for sensor monitoring only.");
  Serial.println("MQ-7 value is raw ADC, not CO ppm.");
}

// =================================================
//                         LOOP
// =================================================

void loop() {

  // Keep GPS parsing continuous.
  readGPS();

  // Read sensors periodically.
  if (millis() - lastSensorRead >= SENSOR_INTERVAL) {

    lastSensorRead = millis();

    readSensors();
  }

  // Send sensor readings to the website every 2 seconds.
  if (bleConnected &&
      millis() - lastBLEReport >= BLE_INTERVAL) {

    lastBLEReport = millis();

    sendBLEData();
  }

  // Original local motor and alarm logic is retained.
  updateMotors();
  updateBuzzer();
}
