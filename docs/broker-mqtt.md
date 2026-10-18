# 📡 Broker MQTT de la simulación — EMQX Serverless

> Tarea 2 de `docs/EN-CURSO.md`. Creado y probado el 2026-10-18 (Abraham).
> Decisión: `docs/CONTEXTO.md` §5.1 (EMQX Serverless en vez de HiveMQ).

En el diseño real el broker vive **dentro de la planta** (Mosquitto en la Raspberry Pi). En la simulación va en la nube porque el ESP32 de Wokwi sale a internet por `Wokwi-GUEST` y no alcanza una red local.

## Conexión

| Dato | Valor |
| :--- | :--- |
| Dirección | `gb12d98f.ala.us-east-1.emqxsl.com` |
| MQTT sobre TLS (ESP32, Edge) | puerto **8883** |
| WebSocket sobre TLS (pruebas en navegador) | puerto **8084**, path `/mqtt` |
| Versión | MQTT 5 (acepta 3.1.1) |
| Plan | Serverless, **spend limit 0**: si se acaba la cuota gratis se suspende, nunca cobra |
| Certificado CA | Se descarga en la consola de EMQX (*Deployment Overview → CA Certificate*). Es público; lo necesita el ESP32 para verificar TLS |

> Solo TLS: el plan Serverless no abre 1883 sin cifrar. Coincide con la capa 1 de `docs/ciberseguridad.md` (MQTTS 8883).

## Usuarios (uno por dispositivo)

| Usuario | Dispositivo | Client ID sugerido |
| :--- | :--- | :--- |
| `esp32-local1` | ESP32 de la planta (Wokwi) | `esp32-local-01` |
| `esp32-local2` | ESP32 de oficinas (Wokwi) | `esp32-local-02` |
| `edge-local1` | Edge de la planta | `edge-local-01` |
| `edge-local2` | Edge de oficinas | `edge-local-02` |

- **Las contraseñas NO van en el repo.** Las tiene Abraham y se entregan por interno; en el código se leen desde `.env` o desde `secrets` de Wokwi.
- **Cada cliente con su propio Client ID.** Si dos clientes usan el mismo, el broker desconecta al primero y este pierde sus suscripciones sin aviso (lo vivimos en la prueba).

## Topics

| Topic | Publica | Suscribe |
| :--- | :--- | :--- |
| `induplac/local1/telemetria` | `esp32-local1` | Edge (`induplac/#` o `induplac/local1/#`) |
| `induplac/local2/telemetria` | `esp32-local2` | Edge |

- **QoS 1** para la telemetría (al menos una vez). Los duplicados se descartan en el Edge con `device_id + seq` (tarea 8).
- Formato del JSON: propuesta en `docs/notas-de-avance.md` (2026-10-07, §2). Ejemplo Local 1:
  ```json
  { "device_id": "esp32-local-01", "seq": 10452, "ts": 1759874400,
    "energia_kw": 42.7, "agua_m3_acum": 1532.418, "agua_m3h": 3.2,
    "uv_index": 5.4, "produccion_acum": 312, "personal_activo": 18 }
  ```
  Local 2: sin UV ni producción; energía separada en climatización e iluminación.

## Cómo probarlo sin código (MQTTX Web)

1. Abrir `mqttx.app/web-client`.
2. Conexión `edge-local1`: host `wss://gb12d98f.ala.us-east-1.emqxsl.com`, puerto `8084`, path `/mqtt`, usuario y clave, SSL activado. Suscribirse a `induplac/#` con QoS 1.
3. Conexión `esp32-local1` (**Client ID distinto**): publicar en `induplac/local1/telemetria`.
4. El mensaje aparece recibido en `edge-local1`.

Probado el 2026-10-18: ESP32 → broker → Edge OK.

> **Ojo con los espacios en el topic:** en la prueba, el topic copiado y pegado tenía espacios. El broker recibía el mensaje, pero no calzaba con `induplac/#` y nadie lo recibía (sin error visible). En el código, definir los topics como constantes y no armarlos a mano.

> Nota: un cliente no recibe sus propios mensajes si se suscribe con *No Local* (MQTT 5). Por eso la prueba válida es entre dos clientes distintos.

## Pendientes
- [ ] Pasar la autorización de *blacklist* (todo permitido) a *whitelist*: cada ESP32 solo publica en su topic y cada Edge solo lee el suyo.
- [ ] Subir el certificado CA al repo para el sketch de Wokwi (tarea 3).
