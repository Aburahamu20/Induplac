"""
Simulador de los ESP32 (solo para probar el Edge mientras el sketch de Wokwi no está listo).
Publica en el broker REAL, con los usuarios esp32-local1 / esp32-local2, el mismo JSON
que mandará Wokwi (docs/broker-mqtt.md). Cada sede con su propio Client ID.

Uso (desde edge/):
    py simular_esp32.py               # las dos sedes, una lectura cada 5 s
    py simular_esp32.py --uv 9.5      # fuerza UV alto en la planta (para ver la alerta)
"""

import argparse
import json
import math
import random
import time
from datetime import datetime

import paho.mqtt.client as mqtt

import config
from reglas import TZ

TOPIC = {"local1": "induplac/local1/telemetria", "local2": "induplac/local2/telemetria"}
CLIENT_ID = {"local1": "esp32-local-01", "local2": "esp32-local-02"}


def turno(ahora: datetime) -> str:
    h = ahora.hour + ahora.minute / 60
    if ahora.weekday() >= 5:
        return "noche"
    if 8 <= h < 18:
        return "dia"
    if 6 <= h < 8 or 18 <= h < 20:
        return "transicion"
    return "noche"


def r(base, pct=0.08):
    return base * (1 + random.uniform(-pct, pct))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--uv", type=float, default=None, help="forzar el UV de la planta")
    ap.add_argument("--cada", type=float, default=5)
    a = ap.parse_args()

    clientes = {}
    for local in ("local1", "local2"):
        clave = config.ESP32_CLAVES[local]
        if not clave:
            raise SystemExit(f"Falta ESP32_{local.upper()}_CLAVE en edge/.env")
        c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=CLIENT_ID[local],
                        protocol=mqtt.MQTTv5 if config.MQTT_VERSION == "5" else mqtt.MQTTv311)
        c.username_pw_set(f"esp32-{local}", clave)
        if config.MQTT_TLS:
            c.tls_set(ca_certs=config.MQTT_CA or None)
        # El broker responde la conexión después (CONNACK): hay que esperarlo para saber si aceptó
        resultado = {}
        c.on_connect = lambda _c, _u, _f, codigo, _p=None, r=resultado: r.setdefault("codigo", codigo)
        c.on_disconnect = lambda _c, _u, *args, loc=local: print(f"\n⚠️  {loc}: desconectado del broker ({args[-2] if len(args) >= 2 else ''})")
        c.connect(config.MQTT_HOST, config.MQTT_PORT, keepalive=60)
        c.loop_start()
        for _ in range(100):
            if "codigo" in resultado:
                break
            time.sleep(0.1)
        codigo = resultado.get("codigo")
        if codigo is None or (codigo != 0 and str(codigo) != "Success"):
            c.loop_stop()
            motivo = codigo if codigo is not None else "sin respuesta en 10 s"
            raise SystemExit(f"❌ esp32-{local}: el broker rechazó la conexión ({motivo}). "
                             f"Revisa ESP32_{local.upper()}_CLAVE en edge/.env")
        print(f"✅ esp32-{local} conectado como {CLIENT_ID[local]}")
        clientes[local] = c

    seq = {"local1": 0, "local2": 0}
    agua = {"local1": 1500.0, "local2": 300.0}
    prod = 215
    print(f"Publicando cada {a.cada} s en {config.MQTT_HOST}. Ctrl + C para detener.")
    try:
        while True:
            ahora = datetime.now(TZ)
            t = turno(ahora)
            h = ahora.hour + ahora.minute / 60
            for local, c in clientes.items():
                seq[local] += 1
                if local == "local1":
                    caudal = max(0.0, r({"dia": 1.0, "transicion": 0.3, "noche": 0.02}[t], 0.15))
                    uv = 9 * math.sin(math.pi * (h - 7) / 12) if 7 < h < 19 else 0.0
                    if t == "dia" and random.random() < a.cada / 120:
                        prod += 1
                    msg = {
                        "energia_kw": round(r({"dia": 38, "transicion": 20, "noche": 6}[t]), 2),
                        "agua_m3h": round(caudal, 3),
                        "uv_index": round(a.uv if a.uv is not None else max(0.0, r(uv, 0.05)), 1),
                        "produccion_acum": prod,
                        "personal_activo": {"dia": 40, "transicion": 10, "noche": 0}[t],
                    }
                else:
                    caudal = max(0.0, r({"dia": 0.13, "transicion": 0.05, "noche": 0.005}[t], 0.15))
                    clima = r({"dia": 9, "transicion": 5, "noche": 1.5}[t])
                    ilum = r({"dia": 3.5, "transicion": 2, "noche": 0.4}[t])
                    msg = {
                        "energia_kw": round(clima + ilum, 2),
                        "energia_climatizacion_kw": round(clima, 2),
                        "energia_iluminacion_kw": round(ilum, 2),
                        "agua_m3h": round(caudal, 3),
                        "personal_activo": {"dia": 20, "transicion": 5, "noche": 0}[t],
                    }
                agua[local] += caudal * a.cada / 3600
                msg = {"device_id": CLIENT_ID[local], "seq": seq[local], "ts": int(time.time()),
                       "agua_m3_acum": round(agua[local], 4), **msg}
                c.publish(TOPIC[local], json.dumps(msg), qos=1)
            print(f"  {ahora:%H:%M:%S} · lectura n.º {seq['local1']} publicada por sede", end="\r")
            time.sleep(a.cada)
    except KeyboardInterrupt:
        print("\nDetenido.")
    finally:
        for c in clientes.values():
            c.loop_stop()
            c.disconnect()


if __name__ == "__main__":
    main()
