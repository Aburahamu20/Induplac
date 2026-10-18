"""
Simulador del Edge para la demo: manda intervalos de 15 min a la API de AWS
(POST /intervalos), con el mismo formato que usará el Edge real.

Solo usa la biblioteca estándar de Python (no hay que instalar nada).

Uso (PowerShell, desde la carpeta backend/scripts):
    python simular_edge.py --url https://XXXX.execute-api.us-east-1.amazonaws.com --clave LA_CLAVE

Opciones:
    --historia-dias 29   días de historia a cargar la primera vez (0 = no cargar)
    --cada 20            segundos entre envíos del intervalo actual
    --uv 9.5             fuerza el UV de la planta (para mostrar una alerta)
    --sin-historia       no carga historia (útil si ya se cargó antes)
"""

import argparse
import json
import math
import random
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

try:
    from zoneinfo import ZoneInfo

    TZ = ZoneInfo("America/Santiago")
except Exception:
    TZ = timezone(timedelta(hours=-3))

LOTE = 50  # registros por petición (modo-offline.md §6.3)


def turno(t):
    local = t.astimezone(TZ)
    h = local.hour + local.minute / 60
    if local.weekday() >= 5:
        return "noche", h
    if 8 <= h < 18:
        return "dia", h
    if 6 <= h < 8 or 18 <= h < 20:
        return "transicion", h
    return "noche", h


def ruido(base, pct=0.08):
    return base * (1 + random.uniform(-pct, pct))


def intervalo(local_id, t, contadores, uv_forzado=None):
    """Un registro de 15 min con el formato de ingesta (backend/README.md)."""
    tr, h = turno(t)
    local = t.astimezone(TZ)
    # Contadores que dependen del calendario: tableros del mes y días sin incidentes
    if contadores.get("mes") != local.month:
        contadores["mes"], contadores["produccion_mes"] = local.month, 0
    if contadores.get("dia") != local.date():
        if contadores.get("dia") is not None:
            contadores["dias"] += 1
        contadores["dia"] = local.date()
    if local_id == "local1":
        kw = ruido({"dia": 38, "transicion": 20, "noche": 6}[tr])
        caudal = max(0.0, ruido({"dia": 1.0, "transicion": 0.3, "noche": 0.02}[tr], 0.15))
        uv = 9 * math.sin(math.pi * (h - 7) / 12) if 7 < h < 19 else 0.0
        personas = {"dia": 40, "transicion": 10, "noche": 0}[tr]
        if personas:
            n = random.choice([0, 0, 1])
            contadores["produccion_mes"] += n
            contadores["produccion"] += n
        reg = {
            "energia_kw": round(kw, 2),
            "energia_kw_max": round(kw * 1.1, 2),
            "uv_max": round(uv_forzado if uv_forzado is not None else max(0.0, ruido(uv, 0.05)), 1),
            "produccion_mes": contadores["produccion_mes"],
            "produccion_anual": 3100 + contadores["produccion"],
        }
    else:
        clima = ruido({"dia": 9, "transicion": 5, "noche": 1.5}[tr])
        ilum = ruido({"dia": 3.5, "transicion": 2, "noche": 0.4}[tr])
        caudal = max(0.0, ruido({"dia": 0.13, "transicion": 0.05, "noche": 0.005}[tr], 0.15))
        personas = {"dia": 20, "transicion": 5, "noche": 0}[tr]
        reg = {
            "energia_kw": round(clima + ilum, 2),
            "energia_kw_max": round((clima + ilum) * 1.1, 2),
            "energia_climatizacion_kw": round(clima, 2),
            "energia_iluminacion_kw": round(ilum, 2),
        }
    contadores["hh"] += personas * 0.25
    reg.update({
        "inicio_intervalo": t.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "agua_m3h": round(caudal, 3),
        "agua_m3": round(caudal * 0.25, 4),  # consumo dentro del intervalo
        "hh_sin_incidentes": round(contadores["hh"]),
        "dias_sin_incidentes": contadores["dias"],
    })
    return reg


def enviar(url, clave, local_id, registros, historico=False):
    cuerpo = json.dumps({
        "batch_id": f"{local_id}-{registros[0]['inicio_intervalo']}",
        "local_id": local_id,
        "historico": historico,
        "records": registros,
    }).encode()
    req = urllib.request.Request(
        f"{url.rstrip('/')}/intervalos",
        data=cuerpo,
        method="POST",
        headers={"Content-Type": "application/json", "x-induplac-key": clave},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise SystemExit(f"Error HTTP {e.code}: {e.read().decode()}")


def inicio_15(t):
    return t.replace(minute=(t.minute // 15) * 15, second=0, microsecond=0)


def main():
    ap = argparse.ArgumentParser(description="Simulador del Edge de Induplac")
    ap.add_argument("--url", required=True, help="URL base de la API Gateway")
    ap.add_argument("--clave", required=True, help="Clave de ingesta (CLAVE_INGESTA de la Lambda)")
    ap.add_argument("--historia-dias", type=int, default=29)
    ap.add_argument("--sin-historia", action="store_true")
    ap.add_argument("--cada", type=int, default=20)
    ap.add_argument("--uv", type=float, default=None)
    a = ap.parse_args()

    cont = {
        "local1": {"produccion": 0, "hh": 0, "dias": 24},
        "local2": {"produccion": 0, "hh": 0, "dias": 91},
    }
    ahora = inicio_15(datetime.now(timezone.utc))

    if a.historia_dias > 0 and not a.sin_historia:
        print(f"Cargando {a.historia_dias} días de historia (para la regla de energía de 4 semanas)...")
        for local in ("local1", "local2"):
            t = ahora - timedelta(days=a.historia_dias)
            lote = []
            while t < ahora:
                lote.append(intervalo(local, t, cont[local]))
                if len(lote) == LOTE:
                    enviar(a.url, a.clave, local, lote, historico=True)
                    lote = []
                t += timedelta(minutes=15)
            if lote:
                enviar(a.url, a.clave, local, lote, historico=True)
            print(f"  {local}: listo")

    print(f"Enviando el intervalo actual cada {a.cada} s. Ctrl + C para detener.")
    ultimo = None
    while True:
        t = inicio_15(datetime.now(timezone.utc))
        nuevo = t != ultimo  # los contadores solo avanzan cuando empieza un intervalo nuevo
        ultimo = t
        for local in ("local1", "local2"):
            c = cont[local] if nuevo else dict(cont[local])
            reg = intervalo(local, t, c, a.uv if local == "local1" else None)
            r = enviar(a.url, a.clave, local, [reg])
            hora = t.astimezone(TZ).strftime("%H:%M")
            print(f"  {hora} {local}: {reg['energia_kw']} kW · alertas nuevas/actualizadas: {r.get('alertas', 0)}")
        time.sleep(a.cada)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nDetenido.")
