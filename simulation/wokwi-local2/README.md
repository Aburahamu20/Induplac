# 🔌 ESP32 en Wokwi — Local 2 (Oficinas)

Prototipo de la sede de Oficinas, armado a partir del de la Planta ([`../wokwi-local1/`](../wokwi-local1/), de Sebastián Fuentes): mismo ESP32, mismo broker, mismo ring buffer, mismos LEDs y la misma pantalla. Cambia lo que se mide, porque Oficinas **no tiene UV ni producción** y su energía se separa en **climatización** e **iluminación**.

```
Wokwi (ESP32) ──MQTTS 8883──► EMQX ──► Edge (SQLite, intervalos, alertas) ──HTTPS──► AWS
```

| Archivo | Qué es |
| :--- | :--- |
| `sketch.ino` | Firmware del ESP32 |
| `diagram.json` | Circuito |
| `libraries.txt` | Librerías que instala Wokwi (las mismas de la Planta) |

## Circuito

| Componente | Pin | Variable |
| :--- | :--- | :--- |
| Potenciómetro Climatización | D34 | `energia_climatizacion_kw` (0–60 kW) |
| Potenciómetro Iluminación | D35 | `energia_iluminacion_kw` (0–20 kW) |
| — (calculado) | — | `energia_kw` = climatización + iluminación (0–80 kW) |
| Potenciómetro Agua | D32 | `agua_m3h` (0,00–1,00 m³/h) |
| Botón verde | D26 | `personal_activo` (20 ↔ 0, inicio y fin de turno) |
| LED verde / rojo | D2 / D4 | MQTT conectado / offline |
| OLED SH1107 (I2C) | SDA D21, SCL D22 | Valores en pantalla |

### Diferencias con la Planta

| | Planta (`local1`) | Oficinas (`local2`) |
| :--- | :--- | :--- |
| Usuario MQTT | `esp32-local1` | `esp32-local2` |
| Client ID | `esp32-local-01-xxxx` | `esp32-local-02-xxxx` |
| Topic | `induplac/local1/telemetria` | `induplac/local2/telemetria` |
| Energía | 1 perilla (0–250 kW) | 2 perillas: climatización (0–60) + iluminación (0–20), y el total es la suma |
| Agua | 0–50 m³/h | 0–1 m³/h, con 2 decimales (el umbral de fuga de Oficinas es 0,05 m³/h) |
| UV | Sí (D32) | No |
| Producción | Botón azul (D25) | No |
| Personal | 18 ↔ 0 | 20 ↔ 0 (dotación de Oficinas en el Edge) |
| Alertas locales | Energía +20 % y UV ≥ 8 | Energía +20 % y posible fuga (caudal > 0,05 m³/h de 22:00 a 06:00 o fin de semana) |

El JSON es el mismo que manda `edge/simular_esp32.py` para `local2`, así que el Edge lo recibe sin cambios. Se probó contra `edge/reglas.py` (`validar`): pasa, incluso con todas las perillas al máximo.

```json
{ "device_id": "esp32-local-02", "seq": 12, "ts": 1795000000,
  "energia_kw": 12.5, "energia_climatizacion_kw": 9.0, "energia_iluminacion_kw": 3.5,
  "agua_m3_acum": 0.0185, "agua_m3h": 0.13, "personal_activo": 20 }
```

## Cómo correrlo

1. Crear un proyecto **ESP32** nuevo en [wokwi.com](https://wokwi.com) (aparte del de la Planta).
2. Pegar los 3 archivos. Para `libraries.txt`: en Wokwi, pestaña **Library Manager** → agregar las 4 librerías, o crear el archivo con el botón **+**.
3. En `sketch.ino`, reemplazar `"CLAVE"` por la contraseña de **`esp32-local2`** (la tiene Abraham; **no subirla al repo**). Ojo: no es la misma de `esp32-local1`.
4. **Play.** En el *Serial Monitor* debe aparecer `[MQTT] Conectando... OK` y luego `[MQTT] seq=0 ... energia=...`.
5. En el Edge aparece `local2: lectura seq=... · kW · agua ... m³/h`, y en el dashboard, la sede **Oficinas** con los datos.

Las dos sedes pueden correr **a la vez** en dos pestañas de Wokwi, porque usan usuarios y Client ID distintos.

## Para la demo

- **Valores normales** (como el simulador en horario de oficina): climatización ~15 % (≈ 9 kW), iluminación ~17 % (≈ 3,5 kW), agua ~13 % (≈ 0,13 m³/h).
- **Alerta de energía:** subir las dos perillas para que el total pase de **55 kW** (por ejemplo, climatización al 80 % y iluminación al 60 %). Es el umbral fijo del Edge mientras no hay 4 semanas de historia.
- **Alerta de fuga:** agua sobre **5 %** (> 0,05 m³/h) entre 22:00 y 06:00 o un fin de semana. En horario de oficina no salta, a propósito.
- **Modo offline:** con el Edge apagado o sin internet, el ESP32 sigue guardando en su buffer (LED rojo y `buf:` sube en la pantalla) y reenvía todo al reconectar. El Edge descarta los duplicados por `device_id + seq`.
- **Plan B:** si Wokwi falla, detenerlo y correr `edge/simular_esp32.py`. **Nunca los dos a la vez**, porque usan el mismo `device_id`.

## Detalles del firmware

Iguales a los de la Planta (ver [`../wokwi-local1/README.md`](../wokwi-local1/README.md)): WiFi `Wokwi-GUEST`, NTP, TLS con `setInsecure()` (cifra pero no verifica el certificado; mejora pendiente), ring buffer de 50 lecturas, botón con debounce por flanco sin `delay()`. Las alertas del ESP32 son informativas; las oficiales las calcula el Edge.
