// ==================================================
// ESP32 SMART WATERING SYSTEM (FIXED + FIREBASE READY)
// DS18B20 + CAPACITIVE MOISTURE + RELAY + FIREBASE
// ==================================================

#include <WiFi.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Firebase_ESP_Client.h>
#include <time.h>

/* ================= WIFI ================= */
const char* WIFI_SSID = "Biru";
const char* WIFI_PASSWORD = "1234567890";

/* ================= FIREBASE ================= */
#define API_KEY "AIzaSyAwM2mZMtBPhsGYlvabfmCzLLhZZdLrpuE"
#define DATABASE_URL "https://smartagrimart-20670-default-rtdb.asia-southeast1.firebasedatabase.app"

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

/* ================= PIN ================= */
#define ONE_WIRE_BUS 15
#define MOISTURE_PIN 34
#define RELAY_PIN 25

/* ================= KALIBRASI ================= */
float TEMP_OFFSET = 1.0;
int ADC_KERING = 3200;
int ADC_BASAH  = 1500;

/* ================= THRESHOLD ================= */
#define MOISTURE_ON   32.0
#define MOISTURE_OFF  80.0
#define TEMP_LIMIT    32.0

/* ================= OBJECT ================= */
LiquidCrystal_I2C lcd(0x27, 16, 2);
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

/* ================= VARIABLE ================= */
float temperature = NAN;
int moistureADC = 0;
float moisturePercent = 0;
bool pump = false;

/* ================= STATUS ================= */
bool wifiConnected = false;
bool firebaseReady = false;

/* ================= TIMER ================= */
unsigned long lastSensorRead = 0;
unsigned long lastFirebase = 0;
unsigned long lastReconnect = 0;

/* ================================================== */
void setup() {
  Serial.begin(115200);

  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);

  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  Wire.begin();
  lcd.init();
  lcd.backlight();

  sensors.begin();

  lcd.setCursor(0, 0);
  lcd.print("SMART WATERING");
  lcd.setCursor(0, 1);
  lcd.print("SYSTEM READY");
  delay(2000);
  lcd.clear();

  connectWiFi();
  if (wifiConnected) {
    syncTime();          // 🔥 STEP 2: NTP TIME
    connectFirebase();   // 🔥 STEP 3: AUTH + FIREBASE
  }
}

/* ================= NTP TIME ================= */
void syncTime() {
  Serial.print("Sync Time");
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");

  time_t now = time(nullptr);
  while (now < 100000) {
    Serial.print(".");
    delay(500);
    now = time(nullptr);
  }
  Serial.println("\nTime SYNCED");
}

/* ================= WIFI ================= */
void connectWiFi() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Connecting WiFi");
  
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  unsigned long startAttemptTime = millis();
  int dots = 0;
  
  while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < 15000) {
    delay(500);
    Serial.print(".");
    lcd.setCursor(dots % 16, 1);
    lcd.print(".");
    dots++;
  }
  
  wifiConnected = (WiFi.status() == WL_CONNECTED);
  
  lcd.clear();
  if (wifiConnected) {
    lcd.setCursor(0, 0);
    lcd.print("WiFi Connected!");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP());
    Serial.println("\nWiFi Connected");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    lcd.print("WiFi Failed!");
    Serial.println("\nWiFi connection failed");
  }
  delay(2000);
  lcd.clear();
}

/* ================= FIREBASE ================= */
void connectFirebase() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Firebase Init...");

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  config.timeout.serverResponse = 15000;
  Firebase.reconnectWiFi(true);

  // Anonymous sign-in (email & password kosong)
  Serial.println("Signing in anonymously...");
  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("Anonymous sign-in SUCCESS");
  } else {
    Serial.println("Anonymous sign-in FAILED");
    Serial.print("Reason: ");
    Serial.println(fbdo.errorReason());  // Error dari fbdo, bukan auth
  }

  Firebase.begin(&config, &auth);

  unsigned long startTime = millis();
  int dots = 0;
  
  while (!Firebase.ready() && millis() - startTime < 20000) {
    delay(500);
    lcd.setCursor(dots % 16, 1);
    lcd.print(".");
    dots++;
  }

  firebaseReady = Firebase.ready();

  lcd.clear();
  if (firebaseReady) {
    lcd.setCursor(0, 0);
    lcd.print("Firebase Ready!");
    Serial.println("Firebase connected successfully");
  } else {
    lcd.setCursor(0, 0);
    lcd.print("Firebase Error!");
    Serial.println("Firebase connection failed");
    Serial.print("Error: ");
    Serial.println(fbdo.errorReason());
  }
  delay(2000);
  lcd.clear();
}


/* ================= SENSOR ================= */
void readSensors() {
  sensors.requestTemperatures();
  float rawTemp = sensors.getTempCByIndex(0);

  if (rawTemp == DEVICE_DISCONNECTED_C || rawTemp < -100) {
    temperature = NAN;
  } else {
    temperature = rawTemp + TEMP_OFFSET;
  }

  moistureADC = analogRead(MOISTURE_PIN);
  moisturePercent = map(moistureADC, ADC_KERING, ADC_BASAH, 0, 100);
  moisturePercent = constrain(moisturePercent, 0, 100);

  Serial.print("Temp: ");
  Serial.print(temperature);
  Serial.print(" C | Moisture: ");
  Serial.print(moisturePercent);
  Serial.println(" %");
}

/* ================= RELAY ================= */
void controlPump() {
  // Prioritas 1: Sensor suhu rusak atau tidak valid → matikan pompa (keamanan)
  if (isnan(temperature)) {
    pump = false;
    digitalWrite(RELAY_PIN, HIGH);  // Pastikan langsung OFF
    return;
  }

  // Prioritas 2: Suhu terlalu panas → matikan pompa (hindari penguapan berlebih)
  if (temperature >= TEMP_LIMIT) {
    pump = false;
    digitalWrite(RELAY_PIN, HIGH);  // Pastikan langsung OFF
    return;
  }

  // Logika utama dengan histeresis
  if (pump) {
    // Pompa sedang ON → matikan hanya jika tanah sudah cukup basah
    if (moisturePercent >= MOISTURE_OFF) {
      pump = false;
    }
    // Jika belum cukup basah, tetap ON
  } else {
    // Pompa sedang OFF → nyalakan hanya jika tanah terlalu kering
    if (moisturePercent <= MOISTURE_ON) {
      pump = true;
    }
    // Jika di tengah-tengah, tetap OFF
  }

  // Terapkan ke relay (LOW = ON, HIGH = OFF pada kebanyakan modul relay)
  digitalWrite(RELAY_PIN, pump ? LOW : HIGH);
}

/* ================= LCD ================= */
void updateLCD() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("T:");
  lcd.print(isnan(temperature) ? 0 : temperature, 1);
  lcd.print("C M:");
  lcd.print((int)moisturePercent);
  lcd.print("%");

  lcd.setCursor(0, 1);
  lcd.print("Pump:");
  lcd.print(pump ? "ON " : "OFF");
}

/* ================= FIREBASE SEND ================= */
void sendFirebase() {
  if (!firebaseReady || !wifiConnected) return;

  if (millis() - lastFirebase >= 5000) {
    FirebaseJson json;
    json.set("temperature", temperature);
    json.set("moisture", moisturePercent);
    json.set("pump", pump);

    if (Firebase.RTDB.setJSON(&fbdo, "/ESP32/data", &json)) {
      Serial.println("Data sent to Firebase");
    } else {
      Serial.print("Firebase send failed: ");
      Serial.println(fbdo.errorReason());
    }
    lastFirebase = millis();
  }
}

/* ================= RECONNET ================= */
void checkReconnect() {
  if (millis() - lastReconnect >= 15000) {
    if (WiFi.status() != WL_CONNECTED) {
      wifiConnected = false;
      firebaseReady = false;
      lcd.clear();
      lcd.print("WiFi Lost...");
      delay(1000);
      connectWiFi();
      if (wifiConnected) {
        connectFirebase();
      }
    }
    lastReconnect = millis();
  }
}

/* ================= LOOP ================= */
void loop() {
  if (millis() - lastSensorRead >= 2000) {
    readSensors();
    controlPump();
    lastSensorRead = millis();
  }

  updateLCD();
  sendFirebase();
  delay(1000);
}