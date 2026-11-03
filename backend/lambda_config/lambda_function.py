"""
Lambda induplac-config: CONFIGURACIÓN de Induplac IoT en RDS PostgreSQL.

Va separada de induplac-api a propósito: esta corre dentro de la VPC para llegar
a RDS; induplac-api (ingesta y dashboard, en DynamoDB) no se toca. Si RDS está
apagado, solo falla esta Lambda y el resto del sistema sigue funcionando.

Rutas (API Gateway, con el authorizer JWT de Cognito `cognito-jwt`):
  GET /config/umbrales                       umbrales de RDS (cualquier usuario con sesión, sus sedes)
  GET /config/catalogo                       locales y dispositivos
  PUT /config/umbrales/{local_id}/{variable} cambia un umbral: {"advertencia", "alerta"} (admins de esa sede)
  PUT /config/umbrales                       copia TODOS los umbrales de RDS a DynamoDB (solo admin general)

Al cambiar un umbral (decisión 2026-11-03): se guarda en RDS (la fuente), se copia
a la tabla DynamoDB `induplac-umbrales` (la que lee induplac-api para las alertas)
y queda en la auditoría. DynamoDB se alcanza por el punto de enlace Gateway de la VPC.

Variables de entorno: DB_HOST, DB_NAME, DB_USER, DB_PASS,
  TABLA_UMBRALES (induplac-umbrales), TABLA_AUDITORIA (induplac-auditoria)
Conexión cifrada (TLS) verificando el certificado de RDS con global-bundle.pem.
Los módulos auditoria.py, permisos.py y umbrales.py vienen de backend/lambda_api
(el deploy los copia al paquete).
"""

import json
import os
import ssl
from datetime import datetime, timezone
from decimal import Decimal

import boto3
import pg8000.native

import auditoria
import permisos
import umbrales as U

_CA = os.path.join(os.path.dirname(__file__), "global-bundle.pem")
_SSL = ssl.create_default_context(cafile=_CA) if os.path.exists(_CA) else None

CORS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type,authorization",
    "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
}

_dynamo = boto3.resource("dynamodb")
T_UMB = _dynamo.Table(os.environ.get("TABLA_UMBRALES", "induplac-umbrales"))
AUDIT = auditoria.RepoDynamo(_dynamo.Table(os.environ.get("TABLA_AUDITORIA", "induplac-auditoria")))


def _conectar():
    return pg8000.native.Connection(
        host=os.environ["DB_HOST"],
        database=os.environ.get("DB_NAME", "induplac"),
        user=os.environ.get("DB_USER", "induplac_admin"),
        password=os.environ["DB_PASS"],
        port=5432,
        ssl_context=_SSL,
        timeout=5,
    )


def _filas(con, sql, **params):
    filas = con.run(sql, **params)
    cols = [c["name"] for c in con.columns]
    return [{k: (float(v) if isinstance(v, Decimal) else v) for k, v in zip(cols, f)} for f in filas]


def _respuesta(codigo, cuerpo):
    return {"statusCode": codigo, "headers": CORS, "body": json.dumps(cuerpo, ensure_ascii=False, default=str)}


def _error(codigo, cod, mensaje):
    return _respuesta(codigo, {"error": {"codigo": cod, "mensaje": mensaje}})


def _copiar(fila, quien):
    """Escribe la copia de un umbral en DynamoDB (lo que lee induplac-api)."""
    T_UMB.put_item(Item={
        "local_id": fila["local_id"], "variable": fila["variable"],
        "advertencia": U.a_dynamo(fila.get("advertencia")), "alerta": U.a_dynamo(fila["alerta"]),
        "unidad": fila.get("unidad"), "actualizado": str(fila.get("actualizado") or datetime.now(timezone.utc).isoformat()),
        "actualizado_por": quien["usuario"],
    })


def cambiar_umbral(con, quien, local_id, variable, evento):
    if not permisos.puede_configurar(quien, local_id):
        return _error(403, "SIN_PERMISO", "Solo los administradores de esa sede cambian sus umbrales.")
    try:
        cuerpo = json.loads(evento.get("body") or "{}")
        adv, alerta = U.validar(local_id, variable, cuerpo.get("advertencia"), cuerpo.get("alerta"))
    except ValueError as e:
        return _error(400, "PARAMETROS", str(e))
    antes = _filas(con, "SELECT advertencia, alerta FROM umbrales WHERE local_id = :l AND variable = :v",
                   l=local_id, v=variable)
    fila = _filas(con, """
        INSERT INTO umbrales (local_id, variable, advertencia, alerta, unidad, actualizado)
        VALUES (:l, :v, :a, :r, :u, now())
        ON CONFLICT (local_id, variable) DO UPDATE
            SET advertencia = EXCLUDED.advertencia, alerta = EXCLUDED.alerta, actualizado = now()
        RETURNING local_id, variable, advertencia, alerta, unidad, actualizado""",
                  l=local_id, v=variable, a=adv, r=alerta, u=U.VARIABLES[variable]["unidad"])[0]
    previo = antes[0] if antes else {"advertencia": U.DEFECTO[(local_id, variable)][0],
                                     "alerta": U.DEFECTO[(local_id, variable)][1]}
    aviso = None
    try:
        _copiar(fila, quien)
    except Exception as e:  # quedó en RDS pero las alertas siguen con el valor anterior
        print("ERROR copia a DynamoDB", repr(e))
        aviso = "Se guardó en RDS, pero no se pudo copiar a DynamoDB: las alertas siguen con el valor anterior."
    try:
        auditoria.registrar(AUDIT, local_id, quien["usuario"], quien["grupo"], "umbral.modificado",
                            f"{local_id}:{variable}",
                            {"antes": previo, "despues": {"advertencia": adv, "alerta": alerta},
                             "unidad": U.VARIABLES[variable]["unidad"], "copiado": aviso is None})
    except Exception as e:
        print("ERROR auditoría", repr(e))
    return _respuesta(502 if aviso else 200, {**fila, "copiado": aviso is None, "aviso": aviso})


def sincronizar(con, quien):
    if not quien or quien["grupo"] not in permisos.GRUPOS_TODAS_LAS_SEDES:
        return _error(403, "SIN_PERMISO", "Solo el admin general copia todos los umbrales.")
    filas = _filas(con, "SELECT local_id, variable, advertencia, alerta, unidad, actualizado FROM umbrales")
    copiados = []
    for f in filas:
        try:
            U.validar(f["local_id"], f["variable"], f.get("advertencia"), f.get("alerta"))
        except ValueError:
            continue  # filas viejas que ya no se usan (o con otro nombre) no se copian
        _copiar(f, quien)
        copiados.append(f"{f['local_id']}:{f['variable']}")
    auditoria.registrar(AUDIT, "general", quien["usuario"], quien["grupo"], "umbral.sincronizado", "umbrales",
                        {"copiados": copiados})
    return _respuesta(200, {"copiados": copiados})


def lambda_handler(event, _context):
    ruta = (event.get("rawPath") or event.get("path") or "").rstrip("/")
    metodo = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    if metodo == "OPTIONS":
        return _respuesta(204, {})
    quien = permisos.perfil(event)
    if not quien:
        return _error(403, "SIN_PERMISO", "Tu cuenta no tiene rol o sede asignados.")
    partes = ruta.split("/config/", 1)[-1].split("/") if "/config/" in ruta else []

    try:
        con = _conectar()
    except Exception as e:  # RDS apagado, red o credenciales
        print("No se pudo conectar a RDS:", repr(e))
        return _error(503, "RDS_NO_DISPONIBLE", "RDS no está disponible (¿está encendido?).")

    try:
        if metodo == "GET" and partes == ["umbrales"]:
            datos = _filas(con, """
                SELECT u.local_id, l.nombre AS local, u.variable, u.advertencia, u.alerta, u.unidad, u.actualizado
                FROM umbrales u JOIN locales l USING (local_id)
                ORDER BY u.local_id, u.variable""")
            return _respuesta(200, {"fuente": "rds", "umbrales": [d for d in datos if d["local_id"] in quien["locales"]]})

        if metodo == "GET" and partes == ["catalogo"]:
            locales = _filas(con, "SELECT local_id, nombre, tipo FROM locales ORDER BY local_id")
            dispositivos = _filas(con, "SELECT device_id, local_id, tipo, descripcion, activo FROM dispositivos ORDER BY device_id")
            return _respuesta(200, {"fuente": "rds", "locales": locales, "dispositivos": dispositivos})

        if metodo == "PUT" and partes == ["umbrales"]:
            return sincronizar(con, quien)

        if metodo == "PUT" and len(partes) == 3 and partes[0] == "umbrales":
            return cambiar_umbral(con, quien, partes[1], partes[2], event)

        return _error(404, "RUTA_NO_EXISTE", f"{metodo} {ruta}")
    except Exception as e:
        print("ERROR", repr(e))
        return _error(500, "ERROR_INTERNO", "Error interno de configuración.")
    finally:
        con.close()
