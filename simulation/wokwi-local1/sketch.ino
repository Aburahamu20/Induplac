/*
 * ============================================================
 *  INDUPLAC IoT — Prototipo Wokwi  (Local 1)
 *  ESP32 DevKit v1
 *
 *  Variables monitoreadas:
 *    - energia_kw      → potenciómetro GPIO 34  (rango 0–250 kW)
 *    - agua_m3h        → potenciómetro GPIO 35  (rango 0–50 m³/h)
 *    - agua_m3_acum    → acumulado en software
 *    - uv_index        → potenciómetro GPIO 32  (rango 0.0–15.0)
 *    - produccion_acum → botón GPIO 25  (+1 por pulsación)
 *    - personal_activo → botón GPIO 26  (toggle ON/OFF cada pulsación)
 *
 *  Broker: EMQX Cloud (MQTTS, puerto 8883)
 *  Topic:  induplac/local1/telemetria
 *  Payload: JSON con device_id, seq, ts, y las 6 métricas
 *
 *  Ring Buffer: 50 registros en RAM
 *  Alertas:
 *    - UV ≥ 8      → alerta alto riesgo
 *    - energía > promedio×1.2 de las últimas lecturas → alerta consumo
 *
 *  LEDs:
 *    - GPIO 2 (verde) → MQTT conectado y publicando
 *    - GPIO 4 (rojo)  → modo offline / buffer activo
 *
 *  OLED SH1107 128×64 I2C
 *    SDA=GPIO21  SCL=GPIO22  Dirección=0x3C
 * ============================================================
 *
 *  Librerías necesarias (instalar en Wokwi vía libraries.txt):
 *    - PubSubClient          (Nick O'Leary)
 *    - ArduinoJson           (Benoit Blanchon)
 *    - Adafruit SH110X       (Adafruit)
 *    - Adafruit GFX Library  (Adafruit)
 *    - WiFiClientSecure      (incluida en ESP32 Arduino core)
 * ============================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>
#include <time.h>

// ─────────────────────────────────────────────
//  CONFIGURACIÓN — editar antes de usar
// ─────────────────────────────────────────────

// WiFi
const char* WIFI_SSID     = "Wokwi-GUEST";
const char* WIFI_PASSWORD = "";

// EMQX Cloud
const char* MQTT_HOST     = "gb12d98f.ala.us-east-1.emqxsl.com";
const char* MQTT_USER     = "esp32-local1";
const char* MQTT_PASSWORD = "CLAVE";
const int   MQTT_PORT     = 8883;
const char* MQTT_TOPIC    = "induplac/local1/telemetria";
const char* DEVICE_ID     = "esp32-local-01";

// NTP
const char* NTP_SERVER    = "pool.ntp.org";
const long  GMT_OFFSET    = -3 * 3600;   // América/Santiago UTC−3
const int   DST_OFFSET    = 0;           // ajustar en horario de verano

// ─────────────────────────────────────────────
//  PINES
// ─────────────────────────────────────────────
#define PIN_POT_ENERGIA   34
#define PIN_POT_AGUA      35
#define PIN_POT_UV        32
#define PIN_BTN_PROD      25
#define PIN_BTN_HH        26
#define PIN_LED_MQTT       2
#define PIN_LED_OFFLINE    4

// OLED SH1107 — I2C
#define OLED_SDA          21
#define OLED_SCL          22
#define OLED_I2C_ADDR     0x3C

// ─────────────────────────────────────────────
//  RING BUFFER
// ─────────────────────────────────────────────
#define BUFFER_SIZE 50

struct Registro {
  uint32_t seq;
  time_t   ts;
  float    energia_kw;
  float    agua_m3h;
  float    agua_m3_acum;
  float    uv_index;
  uint32_t produccion_acum;
  uint8_t  personal_activo;
  bool     is_synced;
};

Registro ringBuffer[BUFFER_SIZE];
uint8_t  bufHead    = 0;
uint8_t  bufTail    = 0;
uint8_t  bufCount   = 0;

// ─────────────────────────────────────────────
//  ESTADO GLOBAL
// ─────────────────────────────────────────────
uint32_t seqCounter       = 0;
float    agua_m3_acum     = 0.0;
uint32_t produccion_acum  = 0;
uint8_t  personal_activo  = 18;
bool     hhActivo         = true;

#define ENERGY_HIST 10
float energyHistory[ENERGY_HIST] = {0};
uint8_t energyIdx = 0;

unsigned long lastPublish   = 0;
unsigned long lastOLED      = 0;
const unsigned long PUBLISH_INTERVAL = 5000;
const unsigned long OLED_INTERVAL    = 1000;

// Debounce botones — detección por flanco
unsigned long lastPressProd = 0;
unsigned long lastPressHH   = 0;
const unsigned long DEBOUNCE_MS = 200;
bool lastStateProd = HIGH;
bool lastStateHH   = HIGH;

// ─────────────────────────────────────────────
//  OBJETOS
// ─────────────────────────────────────────────
WiFiClientSecure  wifiClient;
PubSubClient      mqttClient(wifiClient);

#define OLED_WIDTH  128
#define OLED_HEIGHT  64
Adafruit_SH1107 display(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);

// ─────────────────────────────────────────────
//  DECLARACIONES ADELANTADAS
// ─────────────────────────────────────────────
void connectWiFi();
void syncNTP();
void connectMQTT();
void leerSensores(float &energia, float &agua, float &uv);
void leerBotones();
void guardarEnBuffer(float energia, float agua, float uv);
bool publicarRegistro(const Registro &r);
void flushBuffer();
void checkAlertas(float energia, float uv);
float promedioEnergia();
void actualizarOLED(float energia, float agua, float uv, bool mqtt_ok);
void setLEDs(bool mqttOK);
String buildPayload(const Registro &r);

// ═════════════════════════════════════════════
//  SETUP
// ═════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  Serial.println("\n[INDUPLAC] Iniciando...");

  pinMode(PIN_LED_MQTT,    OUTPUT);
  pinMode(PIN_LED_OFFLINE, OUTPUT);
  digitalWrite(PIN_LED_MQTT,    LOW);
  digitalWrite(PIN_LED_OFFLINE, HIGH);

  // Botones con pull-up interno + forzar HIGH inicial
  pinMode(PIN_BTN_PROD, INPUT_PULLUP);
  pinMode(PIN_BTN_HH,   INPUT_PULLUP);
  digitalWrite(PIN_BTN_PROD, HIGH);
  digitalWrite(PIN_BTN_HH,   HIGH);

  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  Wire.begin(OLED_SDA, OLED_SCL);
  if (!display.begin(OLED_I2C_ADDR, true)) {
    Serial.println("[OLED] No encontrada — continuando sin pantalla");
  } else {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SH110X_WHITE);
    display.setCursor(0, 0);
    display.println("INDUPLAC IoT");
    display.println("Iniciando...");
    display.display();
  }

  connectWiFi();
  syncNTP();

  wifiClient.setInsecure();
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setBufferSize(512);
  connectMQTT();

  Serial.println("[INDUPLAC] Setup completo. Publicando cada 5 s.");
}

// ═════════════════════════════════════════════
//  LOOP PRINCIPAL
// ═════════════════════════════════════════════
void loop() {
  if (!mqttClient.connected()) {
    setLEDs(false);
    connectMQTT();
  }
  mqttClient.loop();

  leerBotones();

  unsigned long ahora = millis();

  if (ahora - lastPublish >= PUBLISH_INTERVAL) {
    lastPublish = ahora;

    float energia, agua, uv;
    leerSensores(energia, agua, uv);

    agua_m3_acum += agua * (PUBLISH_INTERVAL / 3600000.0);

    guardarEnBuffer(energia, agua, uv);
    checkAlertas(energia, uv);

    if (mqttClient.connected()) {
      flushBuffer();
      setLEDs(true);
    } else {
      setLEDs(false);
      Serial.printf("[OFFLINE] Buffer: %d/%d registros pendientes\n",
                    bufCount, BUFFER_SIZE);
    }
  }

  if (ahora - lastOLED >= OLED_INTERVAL) {
    lastOLED = ahora;
    float e, a, u;
    leerSensores(e, a, u);
    actualizarOLED(e, a, u, mqttClient.connected());
  }
}

// ═════════════════════════════════════════════
//  WIFI
// ═════════════════════════════════════════════
void connectWiFi() {
  Serial.printf("[WiFi] Conectando a %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\n[WiFi] Conectado — IP: %s\n",
                WiFi.localIP().toString().c_str());
}

// ═════════════════════════════════════════════
//  NTP
// ═════════════════════════════════════════════
void syncNTP() {
  Serial.print("[NTP] Sincronizando hora...");
  configTime(GMT_OFFSET, DST_OFFSET, NTP_SERVER);
  struct tm timeinfo;
  int intentos = 0;
  while (!getLocalTime(&timeinfo) && intentos < 20) {
    delay(500);
    Serial.print(".");
    intentos++;
  }
  if (intentos < 20) {
    Serial.printf("\n[NTP] Hora: %02d:%02d:%02d %02d/%02d/%04d\n",
                  timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec,
                  timeinfo.tm_mday, timeinfo.tm_mon + 1,
                  timeinfo.tm_year + 1900);
  } else {
    Serial.println("\n[NTP] FALLO — timestamps serán inválidos");
  }
}

// ═════════════════════════════════════════════
//  MQTT
// ═════════════════════════════════════════════
void connectMQTT() {
  int reintentos = 0;
  while (!mqttClient.connected() && reintentos < 5) {
    Serial.printf("[MQTT] Conectando a %s...", MQTT_HOST);
    String clientId = String(DEVICE_ID) + "-" + String(random(0xffff), HEX);
    if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASSWORD)) {
      Serial.println(" OK");
    } else {
      Serial.printf(" FALLO (rc=%d) — reintentando en 3 s\n",
                    mqttClient.state());
      delay(3000);
      reintentos++;
    }
  }
}

// ═════════════════════════════════════════════
//  SENSORES
// ═════════════════════════════════════════════
void leerSensores(float &energia, float &agua, float &uv) {
  int rawE = analogRead(PIN_POT_ENERGIA);
  int rawA = analogRead(PIN_POT_AGUA);
  int rawU = analogRead(PIN_POT_UV);

  energia = (rawE / 4095.0) * 250.0;
  agua    = (rawA / 4095.0) * 50.0;
  uv      = (rawU / 4095.0) * 15.0;

  energia = roundf(energia * 10) / 10.0;
  agua    = roundf(agua    * 10) / 10.0;
  uv      = roundf(uv      * 10) / 10.0;
}

// ═════════════════════════════════════════════
//  BOTONES — debounce por flanco HIGH→LOW
// ═════════════════════════════════════════════
void leerBotones() {
  unsigned long ahora = millis();

  bool stateProd = digitalRead(PIN_BTN_PROD);
  if (lastStateProd == HIGH && stateProd == LOW) {
    if (ahora - lastPressProd > DEBOUNCE_MS) {
      lastPressProd = ahora;
      produccion_acum++;
      Serial.printf("[BTN] Produccion: %u unidades\n", produccion_acum);
    }
  }
  lastStateProd = stateProd;

  bool stateHH = digitalRead(PIN_BTN_HH);
  if (lastStateHH == HIGH && stateHH == LOW) {
    if (ahora - lastPressHH > DEBOUNCE_MS) {
      lastPressHH = ahora;
      hhActivo = !hhActivo;
      personal_activo = hhActivo ? 18 : 0;
      Serial.printf("[BTN] Personal activo: %u\n", personal_activo);
    }
  }
  lastStateHH = stateHH;
}

// ═════════════════════════════════════════════
//  RING BUFFER
// ═════════════════════════════════════════════
void guardarEnBuffer(float energia, float agua, float uv) {
  time_t ahora;
  time(&ahora);

  Registro &r    = ringBuffer[bufHead];
  r.seq          = seqCounter++;
  r.ts           = ahora;
  r.energia_kw   = energia;
  r.agua_m3h     = agua;
  r.agua_m3_acum = agua_m3_acum;
  r.uv_index     = uv;
  r.produccion_acum = produccion_acum;
  r.personal_activo = personal_activo;
  r.is_synced    = false;

  bufHead = (bufHead + 1) % BUFFER_SIZE;
  if (bufCount < BUFFER_SIZE) {
    bufCount++;
  } else {
    bufTail = (bufTail + 1) % BUFFER_SIZE;
    Serial.println("[BUFFER] FULL — descartando registro más antiguo");
  }
}

// ═════════════════════════════════════════════
//  FLUSH
// ═════════════════════════════════════════════
void flushBuffer() {
  while (bufCount > 0) {
    Registro &r = ringBuffer[bufTail];
    if (!r.is_synced) {
      if (!publicarRegistro(r)) break;
      r.is_synced = true;
    }
    bufTail = (bufTail + 1) % BUFFER_SIZE;
    bufCount--;
  }
}

// ═════════════════════════════════════════════
//  PUBLICAR
// ═════════════════════════════════════════════
bool publicarRegistro(const Registro &r) {
  String payload = buildPayload(r);
  bool ok = mqttClient.publish(MQTT_TOPIC, payload.c_str(), false);
  if (ok) {
    Serial.printf("[MQTT] seq=%u ts=%lu energia=%.1f agua=%.1f uv=%.1f\n",
                  r.seq, r.ts, r.energia_kw, r.agua_m3h, r.uv_index);
  } else {
    Serial.printf("[MQTT] FALLO al publicar seq=%u\n", r.seq);
  }
  return ok;
}

// ═════════════════════════════════════════════
//  PAYLOAD JSON
// ═════════════════════════════════════════════
String buildPayload(const Registro &r) {
  StaticJsonDocument<256> doc;
  doc["device_id"]       = DEVICE_ID;
  doc["seq"]             = r.seq;
  doc["ts"]              = (long)r.ts;
  doc["energia_kw"]      = r.energia_kw;
  doc["agua_m3_acum"]    = roundf(r.agua_m3_acum * 1000) / 1000.0;
  doc["agua_m3h"]        = r.agua_m3h;
  doc["uv_index"]        = r.uv_index;
  doc["produccion_acum"] = r.produccion_acum;
  doc["personal_activo"] = r.personal_activo;

  String out;
  serializeJson(doc, out);
  return out;
}

// ═════════════════════════════════════════════
//  ALERTAS
// ═════════════════════════════════════════════
void checkAlertas(float energia, float uv) {
  energyHistory[energyIdx] = energia;
  energyIdx = (energyIdx + 1) % ENERGY_HIST;

  float promedio = promedioEnergia();

  if (promedio > 0 && energia > promedio * 1.2) {
    String msg = "ALERTA: energia=" + String(energia, 1) +
                 " kW supera 120% del promedio (" + String(promedio, 1) + " kW)";
    Serial.println("[ALERTA] " + msg);
    if (mqttClient.connected())
      mqttClient.publish("induplac/local1/alertas", msg.c_str());
  }

  if (uv >= 8.0) {
    String msg = "ALERTA UV: indice=" + String(uv, 1) + " — RIESGO ALTO";
    Serial.println("[ALERTA] " + msg);
    if (mqttClient.connected())
      mqttClient.publish("induplac/local1/alertas", msg.c_str());
  }
}

float promedioEnergia() {
  float suma = 0;
  int   cnt  = 0;
  for (int i = 0; i < ENERGY_HIST; i++) {
    if (energyHistory[i] > 0) { suma += energyHistory[i]; cnt++; }
  }
  return cnt > 0 ? suma / cnt : 0;
}

// ═════════════════════════════════════════════
//  LEDs
// ═════════════════════════════════════════════
void setLEDs(bool mqttOK) {
  digitalWrite(PIN_LED_MQTT,    mqttOK ? HIGH : LOW);
  digitalWrite(PIN_LED_OFFLINE, mqttOK ? LOW  : HIGH);
}

// ═════════════════════════════════════════════
//  OLED
// ═════════════════════════════════════════════
void actualizarOLED(float energia, float agua, float uv, bool mqtt_ok) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SH110X_WHITE);

  display.setCursor(0, 0);
  display.print("INDUPLAC L1 ");
  display.println(mqtt_ok ? "[ON]" : "[OFF]");

  display.setCursor(0, 12);
  display.printf("E: %.1f kW", energia);

  display.setCursor(0, 22);
  display.printf("A: %.1f m3/h", agua);

  display.setCursor(0, 32);
  display.printf("UV: %.1f %s", uv, uv >= 8.0 ? "!RIESGO" : "OK");

  display.setCursor(0, 42);
  display.printf("Prod:%u  HH:%u", produccion_acum, personal_activo);

  display.setCursor(0, 54);
  display.printf("seq:%u buf:%d", seqCounter > 0 ? seqCounter - 1 : 0, bufCount);

  display.display();
}
