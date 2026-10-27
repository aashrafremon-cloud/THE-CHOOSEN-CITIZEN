#include <Arduino.h>
#include <DHT.h>
#include <TinyGPSPlus.h>
#include <AccelStepper.h>
#include "BluetoothSerial.h"

// Check if Bluetooth is properly enabled in ESP32 SDK
#if !defined(CONFIG_BT_ENABLED) || !defined(CONFIG_BLUEDROID_ENABLED)
#error Bluetooth is not enabled! Please enable it in the Arduino Tools menu.
#endif

// =================================================
//                  BLUETOOTH OBJECT
// =================================================
BluetoothSerial SerialBT;
const char* BT_DEVICE_NAME = "FIREGUARD_ROBOT";

// =================================================
//                  PIN CONFIGURATION
// =================================================

// MQ-7
#define MQ7_PIN 34

// DHT22
#define DHT_PIN 4
#define DHT_TYPE DHT22

// Digital sensors
#define FLAME_PIN 27
#define SOUND_PIN 26

// Optional buzzer
#define BUZZER_PIN 13

// GPS NEO-7M
#define GPS_RX_PIN 16
#define GPS_TX_PIN 17

// A4988 Driver 1
#define STEP1_PIN 18
#define DIR1_PIN 19

// A4988 Driver 2
#define STEP2_PIN 25
#define DIR2_PIN 33

// Shared ENABLE
#define ENABLE_PIN 23

// =================================================
//                  SETTINGS
// =================================================

// Initial analog threshold only.
// Must be calibrated; it is NOT a CO ppm threshold.
const int MQ7_THRESHOLD = 1900;

// Many modules are active LOW.
// Change these values if your modules are active HIGH.
const bool FLAME_ACTIVE_LOW = true;
const bool SOUND_ACTIVE_LOW = true;

// Sound detection does not stop motors by default.
const bool SOUND_STOPS_MOTORS = false;

// Set true only after calibrating the MQ-7 module
// and confirming the intended response.
const bool ENABLE_MQ7_MOTOR_STOP = false;

// =================================================
//                  OBJECTS
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

// =================================================
//           FORWARD DECLARATIONS
// =================================================
void readSensors();
void readGPS();
void stopMotors();
void setMovement(char command);
void updateMotors();
void updateBuzzer();
void broadcastTelemetryJSON();

// =================================================
//                       SETUP
// =================================================

void setup() {

  Serial.begin(115200);

  // Initialize ESP32 Classic Bluetooth Serial
  SerialBT.begin(BT_DEVICE_NAME);

  pinMode(MQ7_PIN, INPUT);
  pinMode(FLAME_PIN, INPUT);
  pinMode(SOUND_PIN, INPUT);

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(ENABLE_PIN, OUTPUT);

  // A4988 ENABLE is active LOW.
  // HIGH disables both drivers.
  digitalWrite(ENABLE_PIN, HIGH);
  digitalWrite(BUZZER_PIN, LOW);

  analogReadResolution(12);

  dht.begin();

  // GPS NEO-7M commonly uses 9600 baud.
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

  Serial.println();
  Serial.println("==================================");
  Serial.println(" ESP32 SAFETY ROBOT + BLUETOOTH");
  Serial.println(" MQ-7 + DHT22 + FLAME + SOUND");
  Serial.println(" GPS NEO-7M + 2 STEPPER MOTORS");
  Serial.print(" Bluetooth Device Name: ");
  Serial.println(BT_DEVICE_NAME);
  Serial.println("==================================");

  Serial.println("Commands:");
  Serial.println("F = Forward");
  Serial.println("B = Backward");
  Serial.println("L = Left");
  Serial.println("R = Right");
  Serial.println("S = Stop");

  Serial.println("WARNING: MQ-7 reading is raw ADC.");
  Serial.println("It is NOT a calibrated CO ppm value.");

  // Also send ready banner over Bluetooth
  SerialBT.println("CONNECTED TO FIREGUARD ROBOT OVER BLUETOOTH");
}

// =================================================
//                  READ SENSORS
// =================================================

void readSensors() {

  // Read MQ-7 analog output
  mq7Value = analogRead(MQ7_PIN);

  // Read digital sensors
  int flameRaw = digitalRead(FLAME_PIN);
  int soundRaw = digitalRead(SOUND_PIN);

  // Read DHT22
  temperature = dht.readTemperature();
  humidity = dht.readHumidity();

  // Flame detection
  fireDetected = FLAME_ACTIVE_LOW
                 ? (flameRaw == LOW)
                 : (flameRaw == HIGH);

  // Sound event detection
  soundDetected = SOUND_ACTIVE_LOW
                  ? (soundRaw == LOW)
                  : (soundRaw == HIGH);

  // Raw analog threshold, not CO concentration.
  coAnalogHigh = (mq7Value >= MQ7_THRESHOLD);

  Serial.println();
  Serial.println("========== SENSOR DATA ==========");

  Serial.print("MQ-7 ADC: ");
  Serial.println(mq7Value);

  Serial.print("MQ-7 analog threshold: ");
  Serial.println(coAnalogHigh ? "HIGH" : "NORMAL");

  Serial.print("Flame: ");
  Serial.println(fireDetected ? "DETECTED" : "NOT DETECTED");

  Serial.print("Sound event: ");
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

  if (fireDetected) {
    Serial.println("!!! FLAME WARNING !!!");
  }

  if (coAnalogHigh) {
    Serial.println("!!! MQ-7 ANALOG THRESHOLD EXCEEDED !!!");
  }

  Serial.println("=================================");

  // Send formatted JSON packet over Bluetooth for the FIREGUARD AI Dashboard
  broadcastTelemetryJSON();
}

// =================================================
//           SEND BLUETOOTH TELEMETRY
// =================================================

void broadcastTelemetryJSON() {
  if (!SerialBT.hasClient()) {
    // Bluetooth client not connected; still available via Serial
    return;
  }

  double lat = gps.location.isValid() ? gps.location.lat() : 37.774900;
  double lng = gps.location.isValid() ? gps.location.lng() : -122.419400;
  int sats = gps.satellites.isValid() ? gps.satellites.value() : 0;

  float temp = isnan(temperature) ? 24.5 : temperature;
  float hum = isnan(humidity) ? 48.0 : humidity;

  String json = "{";
  json += "\"deviceId\":\"" + String(BT_DEVICE_NAME) + "\",";
  json += "\"mq7Value\":" + String(mq7Value) + ",";
  json += "\"mq7_ppm\":" + String(mq7Value / 40.0, 1) + ",";
  json += "\"fireDetected\":" + String(fireDetected ? "true" : "false") + ",";
  json += "\"soundDetected\":" + String(soundDetected ? "true" : "false") + ",";
  json += "\"temperature\":" + String(temp, 1) + ",";
  json += "\"humidity\":" + String(hum, 1) + ",";
  json += "\"lat\":" + String(lat, 6) + ",";
  json += "\"lng\":" + String(lng, 6) + ",";
  json += "\"sats\":" + String(sats) + ",";
  json += "\"movement\":\"" + String(movementCommand) + "\"";
  json += "}";

  SerialBT.println(json);
}

// =================================================
//                    GPS
// =================================================

void readGPS() {

  // Process all available GPS characters.
  while (GPSSerial.available() > 0) {

    char c = GPSSerial.read();

    gps.encode(c);
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

      if (gps.location.isUpdated()) {
        Serial.println("GPS location updated.");
      }

    } else {

      Serial.println("GPS location unavailable.");
      Serial.println("Move GPS antenna to an open area.");
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
//                  MOTOR CONTROL
// =================================================

void stopMotors() {

  movementCommand = 'S';

  motor1.setSpeed(0);
  motor2.setSpeed(0);

  digitalWrite(ENABLE_PIN, HIGH);
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

      Serial.print("Movement: ");
      Serial.println(movementCommand);

      if (SerialBT.hasClient()) {
        SerialBT.print("ACK: ");
        SerialBT.println(movementCommand);
      }

      break;

    default:

      Serial.println("Invalid command.");

      break;
  }
}

void updateMotors() {

  // Flame detection always stops movement.
  bool danger = fireDetected;

  // Optional MQ-7 analog threshold stop.
  // Disabled by default until the sensor is calibrated.
  if (ENABLE_MQ7_MOTOR_STOP && coAnalogHigh) {
    danger = true;
  }

  // Optional sound-based stop.
  if (SOUND_STOPS_MOTORS && soundDetected) {
    danger = true;
  }

  if (danger || movementCommand == 'S') {

    motor1.setSpeed(0);
    motor2.setSpeed(0);

    digitalWrite(ENABLE_PIN, HIGH);

    return;
  }

  // Enable both drivers.
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

  // Generate steps without blocking the main loop.
  motor1.runSpeed();
  motor2.runSpeed();
}

// =================================================
//                     BUZZER
// =================================================

void updateBuzzer() {

  bool alarm = fireDetected;

  // Only include MQ-7 in the alarm after calibration.
  if (ENABLE_MQ7_MOTOR_STOP && coAnalogHigh) {
    alarm = true;
  }

  digitalWrite(BUZZER_PIN, alarm ? HIGH : LOW);
}

// =================================================
//                       LOOP
// =================================================

void loop() {

  // 1. Read commands from USB Serial
  while (Serial.available() > 0) {

    char command = Serial.read();

    if (command != '\n' &&
        command != '\r' &&
        command != ' ') {

      setMovement(command);
    }
  }

  // 2. Read commands from Bluetooth Serial
  while (SerialBT.available() > 0) {

    char command = SerialBT.read();

    if (command != '\n' &&
        command != '\r' &&
        command != ' ') {

      setMovement(command);
    }
  }

  // 3. Periodic sensor readings & Bluetooth JSON broadcast
  if (millis() - lastSensorRead >= SENSOR_INTERVAL) {

    lastSensorRead = millis();

    readSensors();
  }

  // 4. Keep GPS parsing continuous
  readGPS();

  // 5. Update stepper motors & safety stop interlock
  updateMotors();

  // 6. Update buzzer alarm
  updateBuzzer();
}
