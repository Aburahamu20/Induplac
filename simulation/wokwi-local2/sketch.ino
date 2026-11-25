/*
 * ============================================================
 *  INDUPLAC IoT — Prototipo Wokwi  (Local 2 · Oficinas)
 *  ESP32 DevKit v1
 *
 *  Basado en el prototipo de la Planta (simulation/wokwi-local1, de Sebastián Fuentes).
 *  Oficinas no tiene UV ni producción: la energía se mide separada en
 *  climatización e iluminación, y el total es la suma de las dos.
 *
 *  Variables monitoreadas:
 *    - energia_climatizacion_kw → potenciómetro GPIO 34  (rango 0–60 kW)
 *    - energia_iluminacion_kw   → potenciómetro GPIO 35  (rango 0–20 kW)
 *    - energia_kw               → suma de las dos (0–80 kW)
 *    - agua_m3h                 → potenciómetro GPIO 32  (rango 0.00–1.00 m³/h)
 *    - agua_m3_acum             → acumulado en software
 *    - personal_activo          → botón GPIO 26  (20 ↔ 0: inicio y fin de turno)
 *
 *  Broker: EMQX Cloud (MQTTS, puerto 8883)
 *  Usuario: esp32-local2 · Client ID: esp32-local-02-xxxx
 *  Topic:  induplac/local2/telemetria
 *  Payload: JSON con device_id, seq, ts y las métricas (mismo formato que
 *           edge/simular_esp32.py para local2)
 *
 *  Ring Buffer: 50 registros en RAM
 *  Alertas locales (informativas; las oficiales las calcula el Edge):
 *    - energía > promedio×1.2 de las últimas lecturas → alerta consumo
 *    - caudal > 0.05 m³/h fuera de horario (22:00–06:00 o fin de semana) → posible fuga
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
#include <esp_sntp.h>   // resincroniza la hora seguido: si Wokwi corre lento, el reloj simulado se atrasa

// ─────────────────────────────────────────────
//  CONFIGURACIÓN — editar antes de usar
// ─────────────────────────────────────────────

// WiFi
const char* WIFI_SSID     = "Wokwi-GUEST";
const char* WIFI_PASSWORD = "";

// EMQX Cloud
const char* MQTT_HOST     = "gb12d98f.ala.us-east-1.emqxsl.com";
const char* MQTT_USER     = "esp32-local2";
const char* MQTT_PASSWORD = "CLAVE";   // la de esp32-local2: la tiene Abraham, NO subirla al repo
const int   MQTT_PORT     = 8883;
const char* MQTT_TOPIC    = "induplac/local2/telemetria";
const char* MQTT_TOPIC_ALERTAS = "induplac/local2/alertas";
const char* DEVICE_ID     = "esp32-local-02";

// NTP
const char* NTP_SERVER    = "pool.ntp.org";
const long  GMT_OFFSET    = -3 * 3600;   // América/Santiago UTC−3
const int   DST_OFFSET    = 0;           // ajustar en horario de verano

// Rangos de los potenciómetros (dentro de lo que valida el Edge: 0–250 kW y 0–50 m³/h)
const float CLIMA_MAX_KW  = 60.0;
const float ILUM_MAX_KW   = 20.0;
const float AGUA_MAX_M3H  = 1.0;
const float FUGA_M3H      = 0.05;        // mismo umbral de fuga que el Edge para local2
const uint8_t PERSONAL_TURNO = 20;       // dotación de Oficinas (PERSONAL_TURNO_LOCAL2)

// ─────────────────────────────────────────────
//  PINES
// ─────────────────────────────────────────────
#define PIN_POT_CLIMA     34
#define PIN_POT_ILUM      35
#define PIN_POT_AGUA      32
#define PIN_BTN_PERSONAL  26
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
  float    clima_kw;
  float    ilum_kw;
  float    agua_m3h;
  float    agua_m3_acum;
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
uint8_t  personal_activo  = PERSONAL_TURNO;
bool     turnoActivo      = true;

#define ENERGY_HIST 10
float energyHistory[ENERGY_HIST] = {0};
uint8_t energyIdx = 0;

unsigned long lastPublish   = 0;
unsigned long lastOLED      = 0;
const unsigned long PUBLISH_INTERVAL = 5000;
const unsigned long OLED_INTERVAL    = 3000;   // pantalla cada 3 s: alivia la simulación

// Debounce del botón — detección por flanco, sin delay()
unsigned long lastPressPersonal = 0;
const unsigned long DEBOUNCE_MS = 200;
bool lastStatePersonal = HIGH;

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
void leerSensores(float &clima, float &ilum, float &agua);
void leerBoton();
void guardarEnBuffer(float clima, float ilum, float agua);
bool publicarRegistro(const Registro &r);
void flushBuffer();
void checkAlertas(float energia, float agua);
float promedioEnergia();
bool fueraDeHorario();
void actualizarOLED(float clima, float ilum, float agua, bool mqtt_ok);
void setLEDs(bool mqttOK);
String buildPayload(const Registro &r);

// ═════════════════════════════════════════════
//  SETUP
// ═════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  Serial.println("\n[INDUPLAC L2] Iniciando...");

  pinMode(PIN_LED_MQTT,    OUTPUT);
  pinMode(PIN_LED_OFFLINE, OUTPUT);
  digitalWrite(PIN_LED_MQTT,    LOW);
  digitalWrite(PIN_LED_OFFLINE, HIGH);

  // Botón con pull-up interno
  pinMode(PIN_BTN_PERSONAL, INPUT_PULLUP);

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
    display.println("Oficinas");
    display.println("Iniciando...");
    display.display();
  }

  connectWiFi();
  syncNTP();

  wifiClient.setInsecure();
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setKeepAlive(90);   // Wokwi lento: con 15 s el broker cortaba la conexión entre envíos
  mqttClient.setBufferSize(512);
  connectMQTT();

  Serial.println("[INDUPLAC L2] Setup completo. Publicando cada 5 s.");
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

  leerBoton();

  unsigned long ahora = millis();

  if (ahora - lastPublish >= PUBLISH_INTERVAL) {
    lastPublish = ahora;

    float clima, ilum, agua;
    leerSensores(clima, ilum, agua);

    agua_m3_acum += agua * (PUBLISH_INTERVAL / 3600000.0);

    guardarEnBuffer(clima, ilum, agua);
    checkAlertas(clima + ilum, agua);

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
    float c, i, a;
    leerSensores(c, i, a);
    actualizarOLED(c, i, a, mqttClient.connected());
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
  sntp_set_sync_interval(15000);   // cada 15 s (mínimo permitido): la hora de cada lectura no se atrasa
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
void leerSensores(float &clima, float &ilum, float &agua) {
  int rawC = analogRead(PIN_POT_CLIMA);
  int rawI = analogRead(PIN_POT_ILUM);
  int rawA = analogRead(PIN_POT_AGUA);

  clima = (rawC / 4095.0) * CLIMA_MAX_KW;
  ilum  = (rawI / 4095.0) * ILUM_MAX_KW;
  agua  = (rawA / 4095.0) * AGUA_MAX_M3H;

  clima = roundf(clima * 10) / 10.0;
  ilum  = roundf(ilum  * 10) / 10.0;
  agua  = roundf(agua  * 100) / 100.0;   // 2 decimales: el umbral de fuga es 0.05
}

// ═════════════════════════════════════════════
//  BOTÓN — debounce por flanco HIGH→LOW
// ═════════════════════════════════════════════
void leerBoton() {
  unsigned long ahora = millis();

  bool state = digitalRead(PIN_BTN_PERSONAL);
  if (lastStatePersonal == HIGH && state == LOW) {
    if (ahora - lastPressPersonal > DEBOUNCE_MS) {
      lastPressPersonal = ahora;
      turnoActivo = !turnoActivo;
      personal_activo = turnoActivo ? PERSONAL_TURNO : 0;
      Serial.printf("[BTN] Personal activo: %u\n", personal_activo);
    }
  }
  lastStatePersonal = state;
}

// ═════════════════════════════════════════════
//  RING BUFFER
// ═════════════════════════════════════════════
void guardarEnBuffer(float clima, float ilum, float agua) {
  time_t ahora;
  time(&ahora);

  Registro &r    = ringBuffer[bufHead];
  r.seq          = seqCounter++;
  r.ts           = ahora;
  r.clima_kw     = clima;
  r.ilum_kw      = ilum;
  r.energia_kw   = roundf((clima + ilum) * 10) / 10.0;
  r.agua_m3h     = agua;
  r.agua_m3_acum = agua_m3_acum;
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
    Serial.printf("[MQTT] seq=%u ts=%ld energia=%.1f (clima=%.1f ilum=%.1f) agua=%.2f\n",
                  r.seq, (long)r.ts, r.energia_kw, r.clima_kw, r.ilum_kw, r.agua_m3h);
  } else {
    Serial.printf("[MQTT] FALLO al publicar seq=%u\n", r.seq);
  }
  return ok;
}

// ═════════════════════════════════════════════
//  PAYLOAD JSON
// ═════════════════════════════════════════════
String buildPayload(const Registro &r) {
  StaticJsonDocument<320> doc;
  doc["device_id"]                = DEVICE_ID;
  doc["seq"]                      = r.seq;
  doc["ts"]                       = (long)r.ts;
  doc["energia_kw"]               = r.energia_kw;
  doc["energia_climatizacion_kw"] = r.clima_kw;
  doc["energia_iluminacion_kw"]   = r.ilum_kw;
  doc["agua_m3_acum"]             = roundf(r.agua_m3_acum * 10000) / 10000.0;
  doc["agua_m3h"]                 = r.agua_m3h;
  doc["personal_activo"]          = r.personal_activo;

  String out;
  serializeJson(doc, out);
  return out;
}

// ═════════════════════════════════════════════
//  ALERTAS (informativas)
// ═════════════════════════════════════════════
bool fueraDeHorario() {
  struct tm t;
  if (!getLocalTime(&t, 10)) return false;         // sin hora, no se acusa fuga
  bool finDeSemana = (t.tm_wday == 0 || t.tm_wday == 6);
  return finDeSemana || t.tm_hour >= 22 || t.tm_hour < 6;
}

void checkAlertas(float energia, float agua) {
  energyHistory[energyIdx] = energia;
  energyIdx = (energyIdx + 1) % ENERGY_HIST;

  float promedio = promedioEnergia();

  if (promedio > 0 && energia > promedio * 1.2) {
    String msg = "ALERTA: energia=" + String(energia, 1) +
                 " kW supera 120% del promedio (" + String(promedio, 1) + " kW)";
    Serial.println("[ALERTA] " + msg);
    if (mqttClient.connected())
      mqttClient.publish(MQTT_TOPIC_ALERTAS, msg.c_str());
  }

  if (agua > FUGA_M3H && fueraDeHorario()) {
    String msg = "ALERTA AGUA: caudal=" + String(agua, 2) +
                 " m3/h fuera de horario — POSIBLE FUGA";
    Serial.println("[ALERTA] " + msg);
    if (mqttClient.connected())
      mqttClient.publish(MQTT_TOPIC_ALERTAS, msg.c_str());
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
void actualizarOLED(float clima, float ilum, float agua, bool mqtt_ok) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SH110X_WHITE);

  display.setCursor(0, 0);
  display.print("INDUPLAC L2 ");
  display.println(mqtt_ok ? "[ON]" : "[OFF]");

  display.setCursor(0, 12);
  display.printf("Total: %.1f kW", clima + ilum);

  display.setCursor(0, 22);
  display.printf("Clim:%.1f Ilu:%.1f", clima, ilum);

  display.setCursor(0, 32);
  display.printf("A: %.2f m3/h %s", agua,
                 (agua > FUGA_M3H && fueraDeHorario()) ? "!FUGA" : "");

  display.setCursor(0, 42);
  display.printf("Personal: %u", personal_activo);

  display.setCursor(0, 54);
  display.printf("seq:%u buf:%d", seqCounter > 0 ? seqCounter - 1 : 0, bufCount);

  display.display();
}
