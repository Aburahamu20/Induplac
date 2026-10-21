"""
Lambda única de la API de Induplac IoT (MVP de la demo).

Detrás de una API Gateway HTTP API. Implementa:
  - Ingesta desde el Edge:  POST /intervalos              (requiere cabecera x-induplac-key)
  - Consulta del dashboard: GET  /api/estado
                            GET  /api/locales
                            GET  /api/locales/{local_id}/actual
                            GET  /api/alertas
                            POST /api/alertas/{id}/reconocer
                            GET  /api/historico
                            GET  /health

Formato de la consulta: docs/api-dashboard.md. Formato de la ingesta: backend/README.md.

Variables de entorno:
  TABLA_INTERVALOS  (por defecto induplac-intervalos)
  TABLA_ALERTAS     (por defecto induplac-alertas)
  CLAVE_INGESTA     clave compartida con el Edge (nunca en el repo)

Simplificaciones del MVP (documentadas en backend/README.md):
  - Las alertas se guardan en DynamoDB, no en RDS.
  - El login de la nube (Cognito) todavía no está: la API de consulta no valida el token.
"""

import json
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key

try:
    from zoneinfo import ZoneInfo

    TZ_CHILE = ZoneInfo("America/Santiago")
except Exception:  # sin base de zonas horarias: Chile en horario de verano (UTC-3)
    TZ_CHILE = timezone(timedelta(hours=-3))

dynamo = boto3.resource("dynamodb")
T_INT = dynamo.Table(os.environ.get("TABLA_INTERVALOS", "induplac-intervalos"))
T_ALE = dynamo.Table(os.environ.get("TABLA_ALERTAS", "induplac-alertas"))
CLAVE_INGESTA = os.environ.get("CLAVE_INGESTA", "")

LOCALES = [
    {
        "local_id": "local1",
        "nombre": "Local 1 · Planta",
        "variables": ["energia_kw", "agua_m3h", "agua_m3_dia", "uv_index", "produccion_mes",
                      "produccion_anual", "hh_sin_incidentes", "dias_sin_incidentes"],
    },
    {
        "local_id": "local2",
        "nombre": "Local 2 · Oficinas",
        "variables": ["energia_kw", "energia_climatizacion_kw", "energia_iluminacion_kw", "agua_m3h",
                      "agua_m3_dia", "hh_sin_incidentes", "dias_sin_incidentes"],
    },
]
IDS_LOCALES = {l["local_id"] for l in LOCALES}

# Umbrales (CONTEXTO §8.2). En el diseño final viven en RDS (umbrales_alerta).
AGUA = {
    "local1": {"normal": 10, "advertencia": 12, "critico": 14, "fuga": 0.3},
    "local2": {"normal": 1.5, "advertencia": 2, "critico": 2.5, "fuga": 0.05},
}
ENERGIA_FIJA = {"advertencia": 45, "critico": 55}  # respaldo sin 4 semanas de historia
META_MES, META_ANIO = 400, 5000
MINUTOS_DESCONECTADO = 30

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type,authorization,x-induplac-key",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
}


# ---------------- utilidades ----------------

def respuesta(codigo, cuerpo):
    return {
        "statusCode": codigo,
        "headers": {"Content-Type": "application/json", **CORS},
        "body": json.dumps(cuerpo, default=_json),
    }


def error(codigo, cod, mensaje):
    return respuesta(codigo, {"error": {"codigo": cod, "mensaje": mensaje}})


def _json(o):
    if isinstance(o, Decimal):
        return int(o) if o == o.to_integral_value() else float(o)
    raise TypeError(type(o))


def a_decimal(v):
    if isinstance(v, float):
        return Decimal(str(round(v, 4)))
    if isinstance(v, dict):
        return {k: a_decimal(x) for k, x in v.items()}
    if isinstance(v, list):
        return [a_decimal(x) for x in v]
    return v


def num(v):
    return None if v is None else float(v)


def iso(dt):
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def leer_iso(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def inicio_dia_chile(dt):
    local = dt.astimezone(TZ_CHILE)
    return local.replace(hour=0, minute=0, second=0, microsecond=0)


def intervalos(local_id, desde, hasta):
    """Intervalos de un local entre dos fechas ISO (orden cronológico)."""
    items, kwargs = [], {
        "KeyConditionExpression": Key("local_id").eq(local_id) & Key("inicio_intervalo").between(desde, hasta)
    }
    while True:
        r = T_INT.query(**kwargs)
        items += r["Items"]
        if "LastEvaluatedKey" not in r:
            return items
        kwargs["ExclusiveStartKey"] = r["LastEvaluatedKey"]


def ultimo_intervalo(local_id):
    r = T_INT.query(KeyConditionExpression=Key("local_id").eq(local_id), ScanIndexForward=False, Limit=1)
    return r["Items"][0] if r["Items"] else None


def promedio_4_semanas(local_id, inicio):
    """Promedio de energía en el mismo horario de las 4 semanas anteriores (regla +20 %)."""
    t = leer_iso(inicio)
    claves = [{"local_id": local_id, "inicio_intervalo": iso(t - timedelta(weeks=s))} for s in range(1, 5)]
    r = dynamo.batch_get_item(RequestItems={T_INT.name: {"Keys": claves, "ProjectionExpression": "energia_kw"}})
    vals = [num(i["energia_kw"]) for i in r["Responses"].get(T_INT.name, []) if "energia_kw" in i]
    return sum(vals) / len(vals) if len(vals) == 4 else None


# ---------------- reglas de nivel (CONTEXTO §8.2) ----------------

def nivel_energia(valor, referencia):
    if referencia:
        return "critico" if valor > referencia * 1.2 else "advertencia" if valor > referencia * 1.1 else "normal"
    return "critico" if valor > ENERGIA_FIJA["critico"] else "advertencia" if valor > ENERGIA_FIJA["advertencia"] else "normal"


def nivel_uv(uv):
    return "critico" if uv >= 8 else "advertencia" if uv >= 6 else "normal"


def nivel_agua_dia(local_id, m3):
    a = AGUA[local_id]
    return "critico" if m3 > a["critico"] else "advertencia" if m3 > a["advertencia"] else "normal"


def es_horario_fuga(dt):
    local = dt.astimezone(TZ_CHILE)
    return local.weekday() >= 5 or local.hour >= 22 or local.hour < 6


def agua_del_dia(local_id, hasta):
    desde = iso(inicio_dia_chile(leer_iso(hasta)))
    return sum(num(i.get("agua_m3")) or 0 for i in intervalos(local_id, desde, hasta))


# ---------------- ingesta (Edge -> AWS) ----------------

def ingesta(evento):
    cab = {k.lower(): v for k, v in (evento.get("headers") or {}).items()}
    if not CLAVE_INGESTA or cab.get("x-induplac-key") != CLAVE_INGESTA:
        return error(401, "NO_AUTORIZADO", "Clave de ingesta inválida.")
    cuerpo = json.loads(evento.get("body") or "{}")
    local_id = cuerpo.get("local_id")
    registros = cuerpo.get("records") or []
    if local_id not in IDS_LOCALES or not registros:
        return error(400, "LOTE_INVALIDO", "Falta local_id válido o records.")

    # Upsert por local_id + inicio_intervalo: reenviar el mismo intervalo no lo duplica (ADR-05)
    recibido = iso(datetime.now(timezone.utc))
    with T_INT.batch_writer(overwrite_by_pkeys=["local_id", "inicio_intervalo"]) as w:
        for r in registros:
            w.put_item(Item=a_decimal({**r, "local_id": local_id, "recibido_en": recibido}))

    # Alertas generadas por el Edge (también sin internet): mismo id que usa la Lambda,
    # así se actualiza la misma alerta en vez de duplicarla (ADR-06)
    for a in cuerpo.get("alertas") or []:
        guardar_alerta_edge(local_id, a)

    alertas = 0
    if not cuerpo.get("historico"):  # la carga histórica inicial no genera alertas
        for r in registros:
            alertas += evaluar_alertas(local_id, r)
    return respuesta(200, {"recibidos": len(registros), "alertas": alertas})


def guardar_alerta(local_id, variable, valor, umbral, regla, inicio):
    """Upsert por local + variable + inicio_intervalo: la misma alerta nunca se duplica (ADR-06)."""
    T_ALE.update_item(
        Key={"local_id": local_id, "id": f"{local_id}:{variable}:{inicio}"},
        # Nombres con # porque varios (variable, estado, valor...) son palabras reservadas de DynamoDB
        UpdateExpression="SET #v=:v, #n=:n, #x=:x, #u=:u, #r=:r, #i=:i, "
                         "#e=if_not_exists(#e, :e), #o=if_not_exists(#o, :o)",
        ExpressionAttributeNames={"#v": "variable", "#n": "nivel", "#x": "valor", "#u": "umbral", "#r": "regla",
                                  "#i": "inicio_intervalo", "#e": "estado", "#o": "origen"},
        ExpressionAttributeValues=a_decimal({
            ":v": variable, ":n": "critico", ":x": float(valor), ":u": float(umbral), ":r": regla,
            ":i": inicio, ":e": "activa", ":o": "lambda",
        }),
    )


def guardar_alerta_edge(local_id, a):
    """Upsert de una alerta que viene del Edge. origen=edge y, si se reconoció en planta, se respeta."""
    if not str(a.get("id", "")).startswith(f"{local_id}:"):
        return
    valores = {
        ":v": a.get("variable"), ":n": "critico", ":x": float(a.get("valor", 0)), ":u": float(a.get("umbral", 0)),
        ":r": a.get("regla", ""), ":i": a.get("inicio_intervalo"), ":o": "edge",
    }
    expr = "SET #v=:v, #n=:n, #x=:x, #u=:u, #r=:r, #i=:i, #o=:o, #e=if_not_exists(#e, :e)"
    valores[":e"] = "activa"
    if a.get("estado") == "reconocida":
        expr = expr.replace("#e=if_not_exists(#e, :e)", "#e=:e, reconocida_en=:t")
        valores[":e"], valores[":t"] = "reconocida", a.get("reconocida_en")
    T_ALE.update_item(
        Key={"local_id": local_id, "id": a["id"]},
        UpdateExpression=expr,
        ExpressionAttributeNames={"#v": "variable", "#n": "nivel", "#x": "valor", "#u": "umbral", "#r": "regla",
                                  "#i": "inicio_intervalo", "#e": "estado", "#o": "origen"},
        ExpressionAttributeValues=a_decimal(valores),
    )


def evaluar_alertas(local_id, r):
    inicio, n = r["inicio_intervalo"], 0
    kw = num(r.get("energia_kw"))
    if kw is not None:
        ref = promedio_4_semanas(local_id, inicio)
        if nivel_energia(kw, ref) == "critico":
            umbral = ref * 1.2 if ref else ENERGIA_FIJA["critico"]
            regla = "20 % sobre el promedio de 4 semanas a la misma hora" if ref else f"Energía sobre {ENERGIA_FIJA['critico']} kW"
            guardar_alerta(local_id, "energia_kw", kw, umbral, regla, inicio)
            n += 1
    uv = num(r.get("uv_max"))
    if uv is not None and uv >= 8:
        guardar_alerta(local_id, "uv_index", uv, 8, "UV mayor o igual a 8", inicio)
        n += 1
    caudal = num(r.get("agua_m3h"))
    if caudal is not None and caudal > AGUA[local_id]["fuga"] and es_horario_fuga(leer_iso(inicio)):
        guardar_alerta(local_id, "agua_m3h", caudal, AGUA[local_id]["fuga"],
                       f"Posible fuga: caudal sobre {AGUA[local_id]['fuga']} m³/h fuera de horario", inicio)
        n += 1
    dia = agua_del_dia(local_id, inicio)
    if dia > AGUA[local_id]["critico"]:
        dia_ini = iso(inicio_dia_chile(leer_iso(inicio)))
        guardar_alerta(local_id, "agua_m3_dia", dia, AGUA[local_id]["critico"],
                       f"Agua diaria sobre {AGUA[local_id]['critico']} m³", dia_ini)
        n += 1
    return n


# ---------------- consulta (dashboard) ----------------

def estado():
    ahora = datetime.now(timezone.utc)
    salida = []
    for l in LOCALES:
        u = ultimo_intervalo(l["local_id"])
        ultimo = (u.get("recibido_en") or u["inicio_intervalo"]) if u else None
        caido = not ultimo or ahora - leer_iso(ultimo) > timedelta(minutes=MINUTOS_DESCONECTADO)
        salida.append({
            "local_id": l["local_id"],
            "enlace": "offline" if caido else "online",
            "pendientes": 0,
            "ultima_sincronizacion": ultimo,
            "ultimo_dato": ultimo,
        })
    return respuesta(200, {"origen": "nube", "hora_servidor": iso(ahora), "locales": salida})


def actual(local_id):
    if local_id not in IDS_LOCALES:
        return error(404, "LOCAL_NO_EXISTE", "Local inexistente.")
    u = ultimo_intervalo(local_id)
    if not u:
        return error(503, "SIN_DATOS", "Todavía no llegan datos de este local.")
    inicio = u["inicio_intervalo"]
    kw = num(u.get("energia_kw")) or 0
    ref = promedio_4_semanas(local_id, inicio)
    dia = agua_del_dia(local_id, inicio)
    caudal = num(u.get("agua_m3h")) or 0
    fuga = caudal > AGUA[local_id]["fuga"] and es_horario_fuga(leer_iso(inicio))

    v = [
        {"id": "energia_kw", "valor": kw, "referencia": ref, "nivel": nivel_energia(kw, ref)},
        {"id": "agua_m3h", "valor": caudal, "referencia": None, "nivel": "critico" if fuga else "normal"},
        {"id": "agua_m3_dia", "valor": dia, "referencia": AGUA[local_id]["normal"], "nivel": nivel_agua_dia(local_id, dia)},
        {"id": "hh_sin_incidentes", "valor": num(u.get("hh_sin_incidentes")) or 0, "referencia": None, "nivel": "normal"},
        {"id": "dias_sin_incidentes", "valor": num(u.get("dias_sin_incidentes")) or 0, "referencia": None, "nivel": "normal"},
    ]
    if local_id == "local1":
        uv = num(u.get("uv_max")) or 0
        v += [
            {"id": "uv_index", "valor": uv, "referencia": None, "nivel": nivel_uv(uv)},
            {"id": "produccion_mes", "valor": num(u.get("produccion_mes")) or 0, "referencia": META_MES, "nivel": "normal"},
            {"id": "produccion_anual", "valor": num(u.get("produccion_anual")) or 0, "referencia": META_ANIO, "nivel": "normal"},
        ]
    else:
        for k in ("energia_climatizacion_kw", "energia_iluminacion_kw"):
            x = num(u.get(k)) or 0
            v.append({"id": k, "valor": x, "referencia": None, "nivel": "normal"})
    return respuesta(200, {"local_id": local_id, "ts": inicio, "variables": v})


def lista_alertas(q):
    locales = [q["local_id"]] if q.get("local_id") in IDS_LOCALES else sorted(IDS_LOCALES)
    items = []
    for l in locales:
        items += T_ALE.query(KeyConditionExpression=Key("local_id").eq(l))["Items"]
    if q.get("estado"):
        items = [a for a in items if a.get("estado") == q["estado"]]
    items.sort(key=lambda a: a["inicio_intervalo"], reverse=True)
    for a in items:
        a.setdefault("reconocida_en", None)
    return respuesta(200, items[:200])


def reconocer(id_alerta):
    local_id = id_alerta.split(":", 1)[0]
    if local_id not in IDS_LOCALES:
        return error(404, "ALERTA_NO_EXISTE", "Alerta inexistente.")
    try:
        r = T_ALE.update_item(
            Key={"local_id": local_id, "id": id_alerta},
            UpdateExpression="SET #e=:e, reconocida_en=:t",
            ConditionExpression="attribute_exists(id)",
            ExpressionAttributeNames={"#e": "estado"},
            ExpressionAttributeValues={":e": "reconocida", ":t": iso(datetime.now(timezone.utc))},
            ReturnValues="ALL_NEW",
        )
    except dynamo.meta.client.exceptions.ConditionalCheckFailedException:
        return error(404, "ALERTA_NO_EXISTE", "Alerta inexistente.")
    return respuesta(200, r["Attributes"])


CAMPO_HIST = {"energia_kw": "energia_kw", "uv_index": "uv_max", "agua_m3h": "agua_m3h", "agua_m3_dia": "agua_m3"}


def historico(evento):
    q = evento.get("queryStringParameters") or {}
    multi = evento.get("rawQueryString", "")
    locales = [p.split("=", 1)[1] for p in multi.split("&") if p.startswith("local_id=")] or [q.get("local_id")]
    variable, agr = q.get("variable"), q.get("agrupacion", "hora")
    if variable not in CAMPO_HIST or not q.get("desde") or not q.get("hasta"):
        return error(400, "PARAMETROS", "Faltan variable, desde o hasta.")
    campo = CAMPO_HIST[variable]
    acumulada = variable == "agua_m3_dia"
    series = []
    for l in locales:
        if l not in IDS_LOCALES:
            return error(400, "PARAMETROS", f"Local inválido: {l}")
        grupos = {}
        for i in intervalos(l, q["desde"], q["hasta"]):
            if i.get(campo) is None:
                continue
            t = leer_iso(i["inicio_intervalo"])
            if agr == "dia":
                clave = iso(inicio_dia_chile(t))
            elif agr == "hora":
                clave = iso(t.replace(minute=0, second=0))
            else:
                clave = i["inicio_intervalo"]
            grupos.setdefault(clave, []).append(num(i[campo]))
        puntos = [
            {
                "inicio": k,
                "promedio": None if acumulada else sum(vs) / len(vs),
                "maximo": None if acumulada else max(vs),
                "total": sum(vs) if acumulada else None,
            }
            for k, vs in sorted(grupos.items())
        ]
        if len(puntos) > 2000:
            return error(400, "RANGO_DEMASIADO_GRANDE", "Pide un rango menor o una agrupación mayor.")
        series.append({"local_id": l, "puntos": puntos})
    return respuesta(200, {"variable": variable, "agrupacion": agr, "series": series})


# ---------------- enrutador ----------------

def lambda_handler(evento, _contexto):
    metodo = evento.get("requestContext", {}).get("http", {}).get("method", "GET")
    ruta = (evento.get("rawPath") or "/").rstrip("/") or "/"
    # Quitar el nombre del stage si viene en la ruta (ej. /prod/api/estado)
    stage = evento.get("requestContext", {}).get("stage")
    if stage and stage != "$default" and ruta.startswith(f"/{stage}/"):
        ruta = ruta[len(stage) + 1:]
    q = evento.get("queryStringParameters") or {}
    partes = ruta.strip("/").split("/")

    try:
        if metodo == "OPTIONS":
            return respuesta(204, {})
        if ruta == "/health":
            return respuesta(200, {"ok": True})
        if metodo == "POST" and ruta == "/intervalos":
            return ingesta(evento)
        if metodo == "GET" and ruta == "/api/estado":
            return estado()
        if metodo == "GET" and ruta == "/api/locales":
            return respuesta(200, LOCALES)
        if metodo == "GET" and len(partes) == 4 and partes[:2] == ["api", "locales"] and partes[3] == "actual":
            return actual(partes[2])
        if metodo == "GET" and ruta == "/api/alertas":
            return lista_alertas(q)
        if metodo == "POST" and len(partes) == 4 and partes[:2] == ["api", "alertas"] and partes[3] == "reconocer":
            from urllib.parse import unquote
            return reconocer(unquote(partes[2]))
        if metodo == "GET" and ruta == "/api/historico":
            return historico(evento)
        return error(404, "RUTA_NO_EXISTE", f"{metodo} {ruta}")
    except Exception as e:  # nunca devolver el stack al cliente
        print("ERROR", repr(e))
        return error(500, "ERROR_INTERNO", "Error interno de la API.")
