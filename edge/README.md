# 🖥️ Edge Gateway — Induplac IoT

Tarea 4 de `docs/EN-CURSO.md` (Abraham). El puente entre el broker MQTT y AWS, y el "colchón" de la planta cuando no hay internet (`docs/modo-offline.md`).

```
ESP32 (Wokwi) --MQTT--> broker EMQX --MQTT--> edge_gateway.py --HTTPS--> AWS (API Gateway + Lambda + DynamoDB)
                                                    |
                                                    +--> SQLite: lecturas crudas, intervalos, alertas
```

## Qué hace (capas)

| Capa | Qué hace | Archivo |
| :--- | :--- | :--- |
| 1 | Se suscribe a `induplac/+/telemetria`, valida rangos y guarda cada lectura en SQLite. Descarta duplicados por `device_id + seq` | `edge_gateway.py`, `db.py` |
| 2 | Cierra intervalos de 15 min (promedios, máximos, consumo de agua) y evalúa **las mismas reglas de alerta que la Lambda** | `reglas.py` |
| 3 | Sincroniza con AWS: healthcheck cada 10 s, 3 fallos = **OFFLINE**; al volver, sube los pendientes en lotes de 50 y vuelve a **ONLINE** | `sincronizacion.py` |
| 4 | API local para el dashboard de planta | *pendiente* |

Detalles importantes:
- **Se vuelve a suscribir en cada conexión**: si el broker lo desconecta, recupera la suscripción solo (lección de la prueba del broker).
- **Nada se marca como sincronizado sin respuesta 200 de AWS.**
- El **intervalo en curso** también se sube cada 30 s (upsert): así gerencia ve datos casi en vivo, sin esperar 15 min.
- Las **alertas generadas offline** viajan en el mismo envío (`"alertas": [...]`) y llegan a la nube con `origen = edge`, sin duplicarse.
- Simplificación de la demo: **un solo Edge atiende las dos sedes**. En el diseño hay una Raspberry Pi por sede.

## Puesta en marcha (Windows)

Desde la carpeta `edge/`:

```powershell
py -m pip install -r requirements.txt
copy .env.example .env
```

Completa en `edge/.env` las claves: `MQTT_CLAVE` (de `edge-local1`), `CLAVE_INGESTA` y, para el simulador, `ESP32_LOCAL1_CLAVE` y `ESP32_LOCAL2_CLAVE`. **`.env` no se sube al repo.**

```powershell
py edge_gateway.py
```

## Probar sin Wokwi

`simular_esp32.py` publica en el broker real lo mismo que mandará el sketch de Wokwi, con los usuarios `esp32-local1/2` y Client IDs propios:

```powershell
py simular_esp32.py            # una lectura cada 5 s por sede
py simular_esp32.py --uv 9.5   # fuerza UV alto en la planta para ver la alerta
```

Cuando el ESP32 de Wokwi esté publicando, se detiene el simulador y el Edge sigue igual.

## Qué se ve en la consola

```
Conectado al broker y suscrito a induplac/+/telemetria
local1: lectura seq=12 · 38.2 kW · UV 6.1
local1: intervalo 2026-10-19T00:15:00Z cerrado (180 lecturas, 37.9 kW prom.)
🚨 ALERTA local1: UV mayor o igual a 8 (valor 9.5, umbral 8.0)
sync: Enlace: 🔴 OFFLINE -> 🟡 SINCRONIZANDO
sync: local1: 3 intervalos sincronizados
sync: Enlace: 🟡 SINCRONIZANDO -> 🟢 ONLINE
```

> Si el Learner Lab está apagado, la API de AWS no responde: el Edge queda en OFFLINE y acumula pendientes. Al hacer *Start Lab*, sincroniza solo.

## Base de datos (`edge.db`)

Se crea sola al arrancar. Tablas de `docs/modo-offline.md` §3.2: `lecturas_crudas` (30 días), `intervalos_15min` y `alertas_local` (con `is_synced`) y `contadores` (horas hombre). Para revisarla se puede usar *DB Browser for SQLite*.

## Días y HH sin incidentes

Siguen el **calendario real** (`reglas.py`):

- **Días sin incidentes** = hoy (hora de Chile) − `FECHA_INCIDENTE_LOCALn`. Avanzan solos cada día.
- **HH sin incidentes** = HH **estimadas** desde el incidente hasta que se instaló el Edge (días hábiles × `PERSONAL_TURNO_LOCALn` × `HORAS_TURNO`, se calcula una sola vez y queda en SQLite) + HH **medidas** por el Edge (`personal_activo` × tiempo, solo mientras recibe lecturas).
- **Registrar un incidente:** cambiar `FECHA_INCIDENTE_LOCALn` en `.env` y reiniciar el Edge. Días y HH vuelven a cero.
