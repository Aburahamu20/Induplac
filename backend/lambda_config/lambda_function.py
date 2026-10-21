"""
Lambda induplac-config: lee la CONFIGURACIÓN de Induplac IoT desde RDS PostgreSQL.

Va separada de induplac-api a propósito: esta corre dentro de la VPC para llegar
a RDS; induplac-api (ingesta y dashboard, en DynamoDB) no se toca. Si RDS está
apagado, solo falla esta Lambda y el resto del sistema sigue funcionando.

Rutas (API Gateway induplac-http):
  GET /config/umbrales      umbrales de alerta por local y variable
  GET /config/catalogo      locales y dispositivos

Variables de entorno: DB_HOST, DB_NAME, DB_USER, DB_PASS
Conexión cifrada (TLS) verificando el certificado de RDS con global-bundle.pem.
"""

import json
import os
import ssl
from decimal import Decimal

import pg8000.native

_CA = os.path.join(os.path.dirname(__file__), "global-bundle.pem")
_SSL = ssl.create_default_context(cafile=_CA)

CORS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
}


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


def _filas(con, sql):
    filas = con.run(sql)
    cols = [c["name"] for c in con.columns]
    return [{k: (float(v) if isinstance(v, Decimal) else v) for k, v in zip(cols, f)} for f in filas]


def _respuesta(codigo, cuerpo):
    return {"statusCode": codigo, "headers": CORS, "body": json.dumps(cuerpo, ensure_ascii=False, default=str)}


def lambda_handler(event, _context):
    ruta = event.get("rawPath") or event.get("path") or ""

    try:
        con = _conectar()
    except Exception as e:  # RDS apagado, red o credenciales
        print("No se pudo conectar a RDS:", repr(e))
        return _respuesta(503, {"error": "RDS no disponible", "detalle": type(e).__name__})

    try:
        if ruta.endswith("/config/umbrales"):
            datos = _filas(con, """
                SELECT u.local_id, l.nombre AS local, u.variable, u.advertencia, u.alerta, u.unidad, u.actualizado
                FROM umbrales u JOIN locales l USING (local_id)
                ORDER BY u.local_id, u.variable""")
            return _respuesta(200, {"fuente": "rds", "umbrales": datos})

        if ruta.endswith("/config/catalogo"):
            locales = _filas(con, "SELECT local_id, nombre, tipo FROM locales ORDER BY local_id")
            dispositivos = _filas(con, "SELECT device_id, local_id, tipo, descripcion, activo FROM dispositivos ORDER BY device_id")
            return _respuesta(200, {"fuente": "rds", "locales": locales, "dispositivos": dispositivos})

        return _respuesta(404, {"error": "Ruta no encontrada", "rutas": ["/config/umbrales", "/config/catalogo"]})
    finally:
        con.close()
