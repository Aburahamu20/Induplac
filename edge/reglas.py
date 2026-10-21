"""
Validación de lecturas, cálculo de intervalos de 15 min y reglas de alerta.
Las reglas son las mismas que usa la Lambda (CONTEXTO §8.2, ADR-06): así la planta
tiene alertas también sin internet, y al sincronizar no se duplican.
"""

from datetime import date, datetime, timedelta, timezone

import config
import db

try:
    from zoneinfo import ZoneInfo

    TZ = ZoneInfo("America/Santiago")
except Exception:  # sin base de zonas horarias (Windows sin tzdata): horario de verano de Chile
    TZ = timezone(timedelta(hours=-3))

# Rangos físicos aceptados (notas-de-avance 2026-10-07 §2). Fuera de rango -> se descarta.
RANGOS = {
    "energia_kw": (0, 250),
    "energia_climatizacion_kw": (0, 250),
    "energia_iluminacion_kw": (0, 250),
    "agua_m3h": (0, 50),
    "uv_index": (0, 15),
    "personal_activo": (0, 500),
}

AGUA = {
    "local1": {"normal": 10, "advertencia": 12, "critico": 14, "fuga": 0.3},
    "local2": {"normal": 1.5, "advertencia": 2, "critico": 2.5, "fuga": 0.05},
}
ENERGIA_FIJA_CRITICO = 55


def iso(ts: int | float) -> str:
    return datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def inicio_de(ts: int) -> int:
    return (ts // config.INTERVALO_SEG) * config.INTERVALO_SEG


def validar(datos: dict) -> str | None:
    """Devuelve el motivo del rechazo, o None si la lectura es válida."""
    if not datos.get("device_id") or not isinstance(datos.get("seq"), int):
        return "falta device_id o seq"
    for campo, (minimo, maximo) in RANGOS.items():
        v = datos.get(campo)
        if v is None:
            continue
        if not isinstance(v, (int, float)) or not (minimo <= v <= maximo):
            return f"{campo}={v} fuera de rango [{minimo}, {maximo}]"
    return None


def hora_lectura(datos: dict, recibido: int) -> int:
    """Usa el ts del ESP32 si es creíble; si no (sin NTP), la hora de llegada."""
    ts = datos.get("ts")
    if isinstance(ts, (int, float)) and recibido - 365 * 86400 < ts <= recibido + 3600:
        return int(ts)
    return recibido


# ---------- Seguridad: días y HH sin incidentes (calendario real) ----------

def fecha_chile(ts: int) -> date:
    return datetime.fromtimestamp(ts, timezone.utc).astimezone(TZ).date()


def _fecha_incidente(local_id: str) -> date:
    return date.fromisoformat(config.FECHA_INCIDENTE[local_id])


def dias_sin_incidentes(local_id: str, ts: int) -> int:
    """Días desde el último incidente: avanza solo con el calendario."""
    return max(0, (fecha_chile(ts) - _fecha_incidente(local_id)).days)


def dias_habiles(desde: date, hasta: date) -> int:
    """Días de lunes a viernes entre el día siguiente a `desde` y el anterior a `hasta`."""
    n, d = 0, desde + timedelta(days=1)
    while d < hasta:
        if d.weekday() < 5:
            n += 1
        d += timedelta(days=1)
    return n


def hh_sin_incidentes(local_id: str, ts: int) -> float:
    """HH estimadas antes de instalar el Edge + HH medidas por el Edge con los sensores.

    La parte estimada se calcula una sola vez (al primer uso) y queda guardada. Si cambia la
    fecha del incidente (se registró uno nuevo), se recalcula y las HH medidas vuelven a cero.
    """
    fecha = config.FECHA_INCIDENTE[local_id]
    guardado = db.hh_historicas(local_id)
    if not guardado or guardado["fecha_inicio"] != fecha:
        if guardado:  # incidente nuevo
            db.reiniciar_hh_medidas(local_id)
        estimado = dias_habiles(_fecha_incidente(local_id), fecha_chile(ts)) * config.PERSONAL_TURNO[local_id] * config.HORAS_TURNO
        db.guardar_hh_historicas(local_id, fecha, estimado, ts)
        guardado = {"hh": estimado}
    return guardado["hh"] + db.hh_actual(local_id)


# ---------- Intervalo de 15 minutos ----------

def _prom(xs):
    xs = [x for x in xs if isinstance(x, (int, float))]
    return round(sum(xs) / len(xs), 3) if xs else None


def calcular_intervalo(local_id: str, inicio: int) -> dict | None:
    """Arma el registro de ingesta (backend/README.md) con las lecturas del intervalo."""
    lecturas = db.lecturas_entre(local_id, inicio, inicio + config.INTERVALO_SEG)
    if not lecturas:
        return None

    kw = [l.get("energia_kw") for l in lecturas]
    caudal = _prom([l.get("agua_m3h") for l in lecturas])
    acum = [l["agua_m3_acum"] for l in lecturas if isinstance(l.get("agua_m3_acum"), (int, float))]
    # Consumo del intervalo: diferencia del contador; si el contador se reinició, se estima con el caudal
    if len(acum) >= 2 and acum[-1] >= acum[0]:
        agua_m3 = round(acum[-1] - acum[0], 4)
    else:
        agua_m3 = round((caudal or 0) * len(lecturas) * 5 / 3600, 4)

    r = {
        "inicio_intervalo": iso(inicio),
        "energia_kw": _prom(kw),
        "energia_kw_max": max((x for x in kw if isinstance(x, (int, float))), default=None),
        "agua_m3h": caudal,
        "agua_m3": agua_m3,
        "hh_sin_incidentes": round(hh_sin_incidentes(local_id, inicio + config.INTERVALO_SEG)),
        "dias_sin_incidentes": dias_sin_incidentes(local_id, inicio + config.INTERVALO_SEG),
        "lecturas": len(lecturas),
    }
    if local_id == "local1":
        uv = [l.get("uv_index") for l in lecturas if isinstance(l.get("uv_index"), (int, float))]
        prod = [l["produccion_acum"] for l in lecturas if isinstance(l.get("produccion_acum"), (int, float))]
        r["uv_max"] = max(uv) if uv else None
        if prod:
            r["produccion_mes"] = int(prod[-1])
            r["produccion_anual"] = config.PRODUCCION_ANUAL_BASE + int(prod[-1])
    else:
        r["energia_climatizacion_kw"] = _prom([l.get("energia_climatizacion_kw") for l in lecturas])
        r["energia_iluminacion_kw"] = _prom([l.get("energia_iluminacion_kw") for l in lecturas])
    return {k: v for k, v in r.items() if v is not None}


# ---------- Reglas de alerta ----------

def _alerta(local_id, variable, valor, umbral, regla, inicio):
    return {
        "id": f"{local_id}:{variable}:{inicio}",
        "local_id": local_id,
        "variable": variable,
        "valor": round(float(valor), 3),
        "umbral": round(float(umbral), 3),
        "regla": regla,
        "inicio_intervalo": inicio,
    }


def _promedio_4_semanas(local_id: str, inicio: str) -> float | None:
    t = datetime.fromisoformat(inicio.replace("Z", "+00:00"))
    vals = []
    for s in range(1, 5):
        i = db.intervalo(local_id, (t - timedelta(weeks=s)).strftime("%Y-%m-%dT%H:%M:%SZ"))
        if i and "energia_kw" in i:
            vals.append(i["energia_kw"])
    return sum(vals) / len(vals) if len(vals) == 4 else None


def _fuera_de_horario(inicio: str) -> bool:
    local = datetime.fromisoformat(inicio.replace("Z", "+00:00")).astimezone(TZ)
    return local.weekday() >= 5 or local.hour >= 22 or local.hour < 6


def inicio_dia_chile(ts: int) -> int:
    local = datetime.fromtimestamp(ts, timezone.utc).astimezone(TZ)
    return int(local.replace(hour=0, minute=0, second=0, microsecond=0).timestamp())


def agua_del_dia(local_id: str, hasta_ts: int, intervalo_abierto: dict | None = None) -> float:
    desde = iso(inicio_dia_chile(hasta_ts))
    total = sum(i.get("agua_m3", 0) for i in db.intervalos_desde(local_id, desde) if i["inicio_intervalo"] <= iso(hasta_ts))
    if intervalo_abierto and not db.intervalo_existe(local_id, intervalo_abierto["inicio_intervalo"]):
        total += intervalo_abierto.get("agua_m3", 0)
    return total


def evaluar(local_id: str, r: dict) -> list[dict]:
    """Reglas de CONTEXTO §8.2 sobre un intervalo (cerrado o en curso)."""
    inicio, salida = r["inicio_intervalo"], []

    kw = r.get("energia_kw")
    if kw is not None:
        ref = _promedio_4_semanas(local_id, inicio)
        if ref and kw > ref * 1.2:
            salida.append(_alerta(local_id, "energia_kw", kw, ref * 1.2, "20 % sobre el promedio de 4 semanas a la misma hora", inicio))
        elif not ref and kw > ENERGIA_FIJA_CRITICO:
            salida.append(_alerta(local_id, "energia_kw", kw, ENERGIA_FIJA_CRITICO, f"Energía sobre {ENERGIA_FIJA_CRITICO} kW", inicio))

    uv = r.get("uv_max")
    if uv is not None and uv >= 8:
        salida.append(_alerta(local_id, "uv_index", uv, 8, "UV mayor o igual a 8", inicio))

    caudal = r.get("agua_m3h")
    fuga = AGUA[local_id]["fuga"]
    if caudal is not None and caudal > fuga and _fuera_de_horario(inicio):
        salida.append(_alerta(local_id, "agua_m3h", caudal, fuga, f"Posible fuga: caudal sobre {fuga} m³/h fuera de horario", inicio))

    ts = int(datetime.fromisoformat(inicio.replace("Z", "+00:00")).timestamp())
    dia = agua_del_dia(local_id, ts, r)
    if dia > AGUA[local_id]["critico"]:
        salida.append(_alerta(local_id, "agua_m3_dia", dia, AGUA[local_id]["critico"],
                              f"Agua diaria sobre {AGUA[local_id]['critico']} m³", iso(inicio_dia_chile(ts))))
    return salida
