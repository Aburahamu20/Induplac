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
                            GET  /api/auditoria          (solo admins)
                            GET  /api/usuarios           (solo admins, tarea 28)
                            POST /api/usuarios
                            PATCH /api/usuarios/{u}
                            POST /api/usuarios/{u}/desactivar | activar | resetear-clave | resetear-mfa
                            GET  /health

Formato de la consulta: docs/api-dashboard.md. Formato de la ingesta: backend/README.md.

Variables de entorno:
  TABLA_INTERVALOS  (por defecto induplac-intervalos)
  TABLA_ALERTAS     (por defecto induplac-alertas)
  TABLA_AUDITORIA   (por defecto induplac-auditoria)
  USER_POOL_ID      user pool de Cognito (por defecto el del lab de Felipe)
  CLAVE_INGESTA     clave compartida con el Edge (nunca en el repo)

Login: API Gateway valida el IdToken de Cognito (authorizer JWT `cognito-jwt` en
ANY /api/{proxy+}) y entrega los datos del usuario en
requestContext.authorizer.jwt.claims. /intervalos y /health no pasan por él.

Simplificaciones del MVP (documentadas en backend/README.md):
  - Las alertas se guardan en DynamoDB, no en RDS.
  - Cada /api/* filtra por la sede del token (custom:sede) y revisa el grupo.
"""

import json
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key

import auditoria
import usuarios as mod_usuarios

try:
    from zoneinfo import ZoneInfo

    TZ_CHILE = ZoneInfo("America/Santiago")
except Exception:  # sin base de zonas horarias: Chile en horario de verano (UTC-3)
    TZ_CHILE = timezone(timedelta(hours=-3))

dynamo = boto3.resource("dynamodb")
T_INT = dynamo.Table(os.environ.get("TABLA_INTERVALOS", "induplac-intervalos"))
T_ALE = dynamo.Table(os.environ.get("TABLA_ALERTAS", "induplac-alertas"))
CLAVE_INGESTA = os.environ.get("CLAVE_INGESTA", "")
USER_POOL_ID = os.environ.get("USER_POOL_ID", "us-east-1_BBaCiAwOt")
_usuarios = None


def usuarios():
    global _usuarios
    if _usuarios is None:  # se crea al primer uso: las demás rutas no necesitan Cognito
        _usuarios = mod_usuarios.Usuarios(boto3.client("cognito-idp"), USER_POOL_ID, AUDIT)
    return _usuarios


AUDIT = auditoria.RepoDynamo(dynamo.Table(os.environ.get("TABLA_AUDITORIA", "induplac-auditoria")))

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
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
}


# ---------------- quién es el usuario (token de Cognito) ----------------

# Mismo criterio que el dashboard (dashboard/src/auth/cognito.ts): el grupo dice
# qué puede hacer y custom:sede dice dónde. Si hay varios grupos, gana el primero.
ORDEN_GRUPOS = ["admin-general", "administrador", "admin-sede", "jefe", "operario"]
GRUPOS_TODAS_LAS_SEDES = {"admin-general", "administrador"}
SEDES_COGNITO = {"planta": ["local1"], "oficinas": ["local2"], "todas": ["local1", "local2"]}
PUEDEN_RECONOCER = {"admin-general", "administrador", "admin-sede", "jefe"}
VEN_AUDITORIA = {"admin-general", "administrador", "admin-sede"}
VEN_HISTORICO = {"admin-general", "administrador", "admin-sede", "jefe"}  # el operario solo ve lo actual


def grupos_de(claims):
    g = claims.get("cognito:groups") or []
    if isinstance(g, str):  # API Gateway lo entrega como texto: "[jefe operario]"
        g = g.strip("[]").replace(",", " ").split()
    return list(g)


def perfil(evento):
    """Usuario, grupo y locales del token, o None si no hay sesión válida."""
    claims = (evento.get("requestContext", {}).get("authorizer", {}).get("jwt", {}) or {}).get("claims") or {}
    grupo = next((g for g in ORDEN_GRUPOS if g in grupos_de(claims)), None)
    if not grupo:
        return None
    if grupo in GRUPOS_TODAS_LAS_SEDES:
        locales = ["local1", "local2"]
    else:
        locales = SEDES_COGNITO.get(str(claims.get("custom:sede", "")).strip().lower())
        if not locales:
            return None
    return {"usuario": claims.get("cognito:username") or claims.get("sub", "?"), "grupo": grupo, "locales": locales}


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

def estado(quien):
    ahora = datetime.now(timezone.utc)
    salida = []
    for l in LOCALES:
        if l["local_id"] not in quien["locales"]:
            continue
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


def actual(local_id, quien):
    if local_id not in IDS_LOCALES:
        return error(404, "LOCAL_NO_EXISTE", "Local inexistente.")
    if local_id not in quien["locales"]:
        return error(403, "SIN_PERMISO", "No puedes ver esta sede.")
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


def lista_alertas(q, quien):
    if q.get("local_id") and q["local_id"] not in quien["locales"]:
        return error(403, "SIN_PERMISO", "No puedes ver esta sede.")
    locales = [q["local_id"]] if q.get("local_id") in IDS_LOCALES else sorted(quien["locales"])
    items = []
    for l in locales:
        items += T_ALE.query(KeyConditionExpression=Key("local_id").eq(l))["Items"]
    if q.get("estado"):
        items = [a for a in items if a.get("estado") == q["estado"]]
    items.sort(key=lambda a: a["inicio_intervalo"], reverse=True)
    for a in items:
        a.setdefault("reconocida_en", None)
        a.setdefault("reconocida_por", None)
        a.setdefault("comentario", None)
    return respuesta(200, items[:200])


MAX_COMENTARIO = 500


def reconocer(id_alerta, quien, evento=None):
    local_id = id_alerta.split(":", 1)[0]
    if local_id not in IDS_LOCALES:
        return error(404, "ALERTA_NO_EXISTE", "Alerta inexistente.")
    if not quien or quien["grupo"] not in PUEDEN_RECONOCER or local_id not in quien["locales"]:
        return error(403, "SIN_PERMISO", "Tu rol no puede reconocer alertas de esta sede.")
    try:
        cuerpo = json.loads((evento or {}).get("body") or "{}")
    except ValueError:
        return error(400, "PARAMETROS", "El cuerpo no es JSON válido.")
    comentario = str(cuerpo.get("comentario") or "").strip()
    if len(comentario) > MAX_COMENTARIO:
        return error(400, "PARAMETROS", f"El comentario puede tener hasta {MAX_COMENTARIO} caracteres.")
    try:
        # Solo una vez: una alerta ya reconocida no se vuelve a reconocer ni se le cambia el comentario
        r = T_ALE.update_item(
            Key={"local_id": local_id, "id": id_alerta},
            UpdateExpression="SET #e=:e, reconocida_en=:t, reconocida_por=:p, comentario=:c",
            ConditionExpression="attribute_exists(id) AND #e = :activa",
            ExpressionAttributeNames={"#e": "estado"},
            ExpressionAttributeValues={":e": "reconocida", ":t": iso(datetime.now(timezone.utc)),
                                       ":p": quien["usuario"], ":c": comentario or None, ":activa": "activa"},
            ReturnValues="ALL_NEW",
        )
    except dynamo.meta.client.exceptions.ConditionalCheckFailedException:
        existe = T_ALE.get_item(Key={"local_id": local_id, "id": id_alerta}).get("Item")
        if existe:
            return error(409, "YA_RECONOCIDA", "Esta alerta ya fue reconocida.")
        return error(404, "ALERTA_NO_EXISTE", "Alerta inexistente.")
    a = r["Attributes"]
    try:
        auditoria.registrar(AUDIT, local_id, quien["usuario"], quien["grupo"], "alerta.reconocida", id_alerta,
                            {"variable": a.get("variable"), "nivel": a.get("nivel"), "valor": a.get("valor"),
                             "comentario": comentario or None})
    except Exception as e:  # la alerta ya quedó reconocida: se avisa en los logs
        print("ERROR auditoría", repr(e))
    return respuesta(200, a)


def ver_auditoria(q, quien):
    if not quien or quien["grupo"] not in VEN_AUDITORIA:
        return error(403, "SIN_PERMISO", "Solo los administradores ven la auditoría.")
    permitidas = list(auditoria.SEDES) if quien["grupo"] in GRUPOS_TODAS_LAS_SEDES else quien["locales"]
    sedes = [q["sede"]] if q.get("sede") else permitidas
    if any(s not in permitidas for s in sedes):
        return error(403, "SIN_PERMISO", "No puedes ver la auditoría de esa sede.")
    ahora = datetime.now(timezone.utc)
    try:
        # Sin zona horaria se entiende hora de Chile (ej. "2026-08-03" = ese día en Chile)
        con_zona = lambda s: (lambda d: d if d.tzinfo else d.replace(tzinfo=TZ_CHILE))(leer_iso(s))
        hasta = con_zona(q["hasta"]) if q.get("hasta") else ahora
        desde = con_zona(q["desde"]) if q.get("desde") else hasta - timedelta(days=7)
    except ValueError:
        return error(400, "PARAMETROS", "desde y hasta deben ser fechas ISO 8601.")
    if desde > hasta:
        return error(400, "PARAMETROS", "desde es posterior a hasta.")
    r = auditoria.consultar(AUDIT, sedes, desde, min(hasta, ahora), ahora)
    if q.get("usuario"):
        r["registros"] = [x for x in r["registros"] if x.get("usuario") == q["usuario"]]
    if q.get("accion"):
        r["registros"] = [x for x in r["registros"] if x.get("accion") == q["accion"]]
    return respuesta(200, r)


CAMPO_HIST = {"energia_kw": "energia_kw", "uv_index": "uv_max", "agua_m3h": "agua_m3h", "agua_m3_dia": "agua_m3"}


def historico(evento, quien):
    if quien["grupo"] not in VEN_HISTORICO:
        return error(403, "SIN_PERMISO", "Tu rol no ve el histórico.")
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
        if l not in quien["locales"]:
            return error(403, "SIN_PERMISO", "No puedes ver esta sede.")
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


def rutas_usuarios(metodo, partes, evento, quien):
    from urllib.parse import unquote

    try:
        cuerpo = json.loads(evento.get("body") or "{}")
    except ValueError:
        return error(400, "PARAMETROS", "El cuerpo no es JSON válido.")
    acciones = {"desactivar": "desactivar", "activar": "activar",
                "resetear-clave": "resetear_clave", "resetear-mfa": "resetear_mfa"}
    try:
        u = usuarios()
        if metodo == "GET" and len(partes) == 2:
            return respuesta(200, u.listar(quien))
        if metodo == "POST" and len(partes) == 2:
            return respuesta(201, u.crear(quien, cuerpo))
        if metodo == "PATCH" and len(partes) == 3:
            return respuesta(200, u.modificar(quien, unquote(partes[2]), cuerpo))
        if metodo == "POST" and len(partes) == 4 and partes[3] in acciones:
            return respuesta(200, getattr(u, acciones[partes[3]])(quien, unquote(partes[2])))
    except mod_usuarios.ErrorUsuarios as e:
        return error(e.http, e.codigo, e.mensaje)
    except Exception as e:
        if "AccessDenied" in repr(e) or "not authorized" in repr(e):
            print("ERROR permisos Cognito", repr(e))
            return error(502, "SIN_PERMISO_COGNITO", "La Lambda no tiene permiso para administrar Cognito.")
        raise
    return error(404, "RUTA_NO_EXISTE", f"{metodo} /{'/'.join(partes)}")


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
        # Todo /api/* pasa por el authorizer JWT: sin grupo o sede válidos no se ve nada
        quien = perfil(evento) if ruta.startswith("/api/") else None
        if ruta.startswith("/api/") and not quien:
            return error(403, "SIN_PERMISO", "Tu cuenta no tiene rol o sede asignados.")
        if metodo == "GET" and ruta == "/api/estado":
            return estado(quien)
        if metodo == "GET" and ruta == "/api/locales":
            return respuesta(200, [l for l in LOCALES if l["local_id"] in quien["locales"]])
        if metodo == "GET" and len(partes) == 4 and partes[:2] == ["api", "locales"] and partes[3] == "actual":
            return actual(partes[2], quien)
        if metodo == "GET" and ruta == "/api/alertas":
            return lista_alertas(q, quien)
        if metodo == "POST" and len(partes) == 4 and partes[:2] == ["api", "alertas"] and partes[3] == "reconocer":
            from urllib.parse import unquote
            return reconocer(unquote(partes[2]), quien, evento)
        if metodo == "GET" and ruta == "/api/historico":
            return historico(evento, quien)
        if metodo == "GET" and ruta == "/api/auditoria":
            return ver_auditoria(q, quien)
        if partes[:2] == ["api", "usuarios"]:
            return rutas_usuarios(metodo, partes, evento, quien)
        return error(404, "RUTA_NO_EXISTE", f"{metodo} {ruta}")
    except Exception as e:  # nunca devolver el stack al cliente
        print("ERROR", repr(e))
        return error(500, "ERROR_INTERNO", "Error interno de la API.")
