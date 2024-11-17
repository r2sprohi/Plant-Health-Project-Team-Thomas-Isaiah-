#include <WiFi.h>               // ESP32 WiFi library
#include <DHT.h>                // Library for DHT11
#include <Wire.h>               // Library for I2C communication (for sensors)
#include <Adafruit_Sensor.h>
#include <HTTPClient.h>         // Library for HTTP POST

// WiFi credentials
const char* ssid = "WifiSsid";
const char* password = "Password";

// Backend server URL
const char* serverURL = "http://192.168.69.2/api/sensor";  // Replace with your Node.js server URL

// Pin assignments
#define MOISTURE_SENSOR_1_PIN 32
#define MOISTURE_SENSOR_2_PIN 33
#define RAIN_SENSOR_PIN 34
#define DHT11_PIN 4
#define ULTRASONIC_TRIGGER_PIN 18
#define ULTRASONIC_ECHO_PIN 19
#define LIGHT_SENSOR_PIN 13

// Relay pins
#define PUMP_1_RELAY_PIN 25
#define PUMP_2_RELAY_PIN 26
#define LED_LIGHTS_RELAY_PIN 22

#define DHTTYPE DHT11
DHT dht(DHT11_PIN, DHTTYPE);
// DHT Sensor setup

// Thresholds
int moistureThreshold = 2100;
int rainThreshold = 500;
float temperatureThreshold = 30;
float humidityThreshold = 40;
int waterLevelThreshold = 15;
int lightThreshold = 2500;

void setup() {
  Serial.begin(115200);

  // Connect to WiFi
  connectToWiFi();

  dht.begin();

  // Pin modes for sensors
  pinMode(MOISTURE_SENSOR_1_PIN, INPUT);
  pinMode(MOISTURE_SENSOR_2_PIN, INPUT);
  pinMode(RAIN_SENSOR_PIN, INPUT);
  pinMode(ULTRASONIC_TRIGGER_PIN, OUTPUT);
  pinMode(ULTRASONIC_ECHO_PIN, INPUT);
  pinMode(LIGHT_SENSOR_PIN, INPUT);

  // Pin modes for relays
  pinMode(PUMP_1_RELAY_PIN, OUTPUT);
  pinMode(PUMP_2_RELAY_PIN, OUTPUT);
  pinMode(LED_LIGHTS_RELAY_PIN, OUTPUT);

  digitalWrite(PUMP_1_RELAY_PIN, LOW);
  digitalWrite(PUMP_2_RELAY_PIN, LOW);
  digitalWrite(LED_LIGHTS_RELAY_PIN, LOW);
}

void loop() {
  // Reconnect WiFi if disconnected
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi();
  }

  // Read sensors
  int moisture1 = analogRead(MOISTURE_SENSOR_1_PIN);
  int moisture2 = analogRead(MOISTURE_SENSOR_2_PIN);
  int rainReading = analogRead(RAIN_SENSOR_PIN);
  float temp = dht.readTemperature();
  float humidity = dht.readHumidity();
  long distance = getWaterLevel();
  int lightReading = analogRead(LIGHT_SENSOR_PIN);
  // Control pumps based on moisture levels
  controlPumps(moisture1, moisture2);
  // Control LED lights based on light sensor
  controlLights(lightReading);

  // Send data to backend, retry if fails
  if (!sendSensorData(moisture1, moisture2, rainReading, temp, humidity, distance, lightReading)) {
    Serial.println("Retrying to send data in 5 seconds...");
    delay(5000);  // Retry after 5 seconds
    sendSensorData(moisture1, moisture2, rainReading, temp, humidity, distance, lightReading);
  }

  delay(10000); // Send data every 10 seconds
}

void connectToWiFi() {
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print(".");
  }

  Serial.println("\nWiFi connected.");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

long getWaterLevel() {
  long duration, distance;
  digitalWrite(ULTRASONIC_TRIGGER_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(ULTRASONIC_TRIGGER_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(ULTRASONIC_TRIGGER_PIN, LOW);
  duration = pulseIn(ULTRASONIC_ECHO_PIN, HIGH);
  distance = duration * 0.034 / 2;
  return distance;
}

void controlPumps(int moisture1, int moisture2) {
  if (moisture1 < moistureThreshold) {
    digitalWrite(PUMP_1_RELAY_PIN, HIGH);
    Serial.println("Pump 1 ON");
  } else {
    digitalWrite(PUMP_1_RELAY_PIN, LOW);
    Serial.println("Pump 1 OFF");
  }

  if (moisture2 < moistureThreshold) {
    digitalWrite(PUMP_2_RELAY_PIN, HIGH);
    Serial.println("Pump 2 ON");
  } else {
    digitalWrite(PUMP_2_RELAY_PIN, LOW);
    Serial.println("Pump 2 OFF");
  }
}

void controlLights(int lightReading) {
  if (lightReading < lightThreshold) {
    digitalWrite(LED_LIGHTS_RELAY_PIN, HIGH);
    Serial.println("LED Lights ON");
  } else {
    digitalWrite(LED_LIGHTS_RELAY_PIN, LOW);
    Serial.println("LED Lights OFF");
  }
}

bool sendSensorData(int moisture1, int moisture2, int rainReading, float temp, float humidity, long distance, int lightReading) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverURL);  // Specify destination for HTTP POST request
    http.addHeader("Content-Type", "application/json");  // Specify content type header

    // Create JSON data
    String jsonData = "{\"moisture1\": " + String(moisture1) +
                      ", \"moisture2\": " + String(moisture2) +
                      ", \"rainReading\": " + String(rainReading) +
                      ", \"temperature\": " + String(temp) +
                      ", \"humidity\": " + String(humidity) +
                      ", \"waterLevel\": " + String(distance) +
                      ", \"lightReading\": " + String(lightReading) + "}";

    // Send HTTP POST request
    int httpResponseCode = http.POST(jsonData);

    // Print response and return success/failure
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println(httpResponseCode);
      Serial.println(response);
      http.end();
      return true;
    } else {
      Serial.println("Error sending data. HTTP Response code: " + String(httpResponseCode));
      http.end();
      return false;
    }
  } else {
    Serial.println("WiFi Disconnected");
    return false;
  }
}
