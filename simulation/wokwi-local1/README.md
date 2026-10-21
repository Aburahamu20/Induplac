# 🔌 ESP32 en Wokwi — Local 1 (Planta)

Prototipo de Sebastián Fuentes (tarea 3). Simula los sensores de la planta y publica la telemetría al broker EMQX, de donde la lee el Edge (`edge/edge_gateway.py`).

```
Wokwi (ESP32) ──MQTTS 8883──► EMQX ──► Edge (SQLite, intervalos, alertas) ──HTTPS──► AWS
```

| Archivo | Qué es |
| :--- | :--- |
| `sketch.ino` | Firmware del ESP32 |
| `diagram.json` | Circuito |
| `libraries.txt` | Librerías que instala Wokwi |

## Circuito

| Componente | Pin | Variable |
| :--- | :--- | :--- |
| Potenciómetro Energía | D34 | `energia_kw` (0–250 kW) |
| Potenciómetro Agua | D35 | `agua_m3h` (0–50 m³/h) |
| Potenciómetro UV | D32 | `uv_index` (0–15) |
| Botón azul | D25 | `produccion_acum` (+1 por pulsación) |
| Botón verde | D26 | `personal_activo` (18 ↔ 0, inicio y fin de turno) |
| LED verde / rojo | D2 / D4 | MQTT conectado / offline |
| OLED SH1107 (I2C) | SDA D21, SCL D22 | Valores en pantalla |

## Cómo correrlo

1. Crear un proyecto ESP32 en [wokwi.com](https://wokwi.com) y pegar los tres archivos.
2. En `sketch.ino`, reemplazar `"CLAVE"` por la contraseña de `esp32-local1` (la tiene Abraham; **no subirla al repo**).
3. Play. En el *Serial Monitor* debe aparecer `[MQTT] Conectando... OK` y luego `[MQTT] seq=0 ...`.
4. En el Edge aparece `local1: lectura seq=... · kW · agua ... m³/h · UV ...`.

## Detalles del firmware

- **WiFi** `Wokwi-GUEST`, **NTP** `pool.ntp.org`. El `ts` del JSON es Unix en UTC (el desfase -3 h solo afecta la hora que se muestra).
- **MQTT** con TLS (`WiFiClientSecure` con `setInsecure()`: cifra pero no verifica el certificado del broker; mejora pendiente: cargar el CA de EMQX). Client ID `esp32-local-01-xxxx` (sufijo aleatorio para no chocar con otro cliente).
- **Ring buffer** de 50 lecturas: si se cae MQTT, guarda y reenvía al reconectar. El Edge descarta duplicados por `device_id + seq + ts`.
- **Botones** con debounce por flanco (HIGH → LOW) y `millis()`, **sin `delay()`**: un `delay()` bloqueaba `mqttClient.loop()` y desordenaba las lecturas de los botones con el broker conectado.
- **Alertas locales** (UV ≥ 8 y energía > 120 % del promedio reciente) en `induplac/local1/alertas`: son informativas para la pantalla y el Serial Monitor. Las alertas oficiales las calcula el Edge.

## Para la demo

- Con los rangos actuales (energía 0–250 kW, agua 0–50 m³/h), los umbrales quedan muy abajo en la perilla: **energía ~15 %** (≈ 38 kW) y **agua ~2 %** (≈ 1 m³/h) para valores normales.
- **Alerta UV:** subir la perilla de UV sobre ~55 % (≥ 8).
- **Alerta de fuga:** caudal > 0,3 m³/h entre 22:00 y 06:00 o fin de semana.
- Wokwi puede simular más lento que el tiempo real con WiFi + TLS + OLED (se vio ~1 lectura cada 25 s). El Edge funciona igual.
- **Plan B:** si Wokwi falla, detenerlo y correr `edge/simular_esp32.py` (nunca los dos a la vez: usan el mismo `device_id`).

### Mejora sugerida (pendiente)
Rangos más finos para la demo, en `leerSensores()`: energía `* 100.0` (0–100 kW) y agua `* 5.0` (0–5 m³/h). Siguen dentro de los rangos que valida el Edge.
