"""Permisos de la API según el token de Cognito (grupo + custom:sede).

Sin AWS: se reemplazan las consultas a DynamoDB por datos en memoria.
Se salta si boto3 no está instalado (el CI lo instala).
"""

import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "prueba")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "prueba")

try:
    import boto3  # noqa: F401
except ImportError:  # pragma: no cover
    boto3 = None


class TablaAlertas:
    def __init__(self):
        self.items = {
            "local1": [{"local_id": "local1", "id": "local1:energia_kw:t1", "inicio_intervalo": "t1", "estado": "activa", "variable": "energia_kw"}],
            "local2": [{"local_id": "local2", "id": "local2:agua_m3h:t1", "inicio_intervalo": "t1", "estado": "activa", "variable": "agua_m3h"}],
        }

    def query(self, KeyConditionExpression):
        local = KeyConditionExpression.get_expression()["values"][1]
        return {"Items": [dict(a) for a in self.items.get(local, [])]}

    def update_item(self, Key, ExpressionAttributeValues=None, **_):
        import lambda_function as L
        a = next((x for x in self.items[Key["local_id"]] if x["id"] == Key["id"]), None)
        if not a or a["estado"] != "activa":
            raise L.dynamo.meta.client.exceptions.ConditionalCheckFailedException(
                {"Error": {"Code": "ConditionalCheckFailedException", "Message": "x"}}, "UpdateItem")
        v = ExpressionAttributeValues or {}
        a.update(estado="reconocida", reconocida_por=v.get(":p"), comentario=v.get(":c"))
        return {"Attributes": dict(a)}

    def get_item(self, Key):
        a = next((x for x in self.items.get(Key["local_id"], []) if x["id"] == Key["id"]), None)
        return {"Item": dict(a)} if a else {}


@unittest.skipUnless(boto3, "boto3 no está instalado")
class TestPermisos(unittest.TestCase):
    def setUp(self):
        import lambda_function as L
        from test_auditoria import RepoMemoria

        self.L = L
        L.AUDIT = RepoMemoria()
        L.T_ALE = TablaAlertas()
        L.ultimo_intervalo = lambda local: {"inicio_intervalo": "2026-11-02T12:00:00Z", "energia_kw": 10}
        L.intervalos = lambda local, desde, hasta: []

    def pedir(self, metodo, ruta, grupos=None, sede=None, q=None, raw=""):
        claims = {} if grupos is None else {"cognito:groups": grupos, "custom:sede": sede, "cognito:username": "u"}
        ev = {"rawPath": ruta, "rawQueryString": raw, "queryStringParameters": q,
              "requestContext": {"http": {"method": metodo}, "authorizer": {"jwt": {"claims": claims}}}}
        r = self.L.lambda_handler(ev, None)
        return r["statusCode"], json.loads(r["body"]) if r.get("body") else None

    def test_sin_rol_no_ve_nada(self):
        self.assertEqual(self.pedir("GET", "/api/estado")[0], 403)
        self.assertEqual(self.pedir("GET", "/api/estado", "[jefe]", "plantas")[0], 403)  # sede mal escrita

    def test_estado_y_locales_solo_de_su_sede(self):
        c, b = self.pedir("GET", "/api/estado", "[operario]", "oficinas")
        self.assertEqual([l["local_id"] for l in b["locales"]], ["local2"])
        c, b = self.pedir("GET", "/api/locales", "[admin-sede]", "planta")
        self.assertEqual([l["local_id"] for l in b], ["local1"])
        c, b = self.pedir("GET", "/api/estado", "[admin-general]", "todas")
        self.assertEqual(len(b["locales"]), 2)

    def test_actual_de_otra_sede(self):
        self.assertEqual(self.pedir("GET", "/api/locales/local2/actual", "[jefe]", "planta")[0], 403)

    def test_alertas_filtradas(self):
        c, b = self.pedir("GET", "/api/alertas", "[jefe]", "oficinas")
        self.assertEqual({a["local_id"] for a in b}, {"local2"})
        self.assertEqual(self.pedir("GET", "/api/alertas", "[jefe]", "oficinas", {"local_id": "local1"})[0], 403)
        c, b = self.pedir("GET", "/api/alertas", "[jefe]", "todas")
        self.assertEqual(len(b), 2)

    def test_historico(self):
        q = {"variable": "energia_kw", "desde": "2026-11-01T00:00:00Z", "hasta": "2026-11-02T00:00:00Z", "local_id": "local1"}
        self.assertEqual(self.pedir("GET", "/api/historico", "[operario]", "planta", q, "local_id=local1")[0], 403)
        self.assertEqual(self.pedir("GET", "/api/historico", "[jefe]", "oficinas", q, "local_id=local1")[0], 403)
        self.assertEqual(self.pedir("GET", "/api/historico", "[jefe]", "planta", q, "local_id=local1")[0], 200)

    def test_reconocer(self):
        ruta = "/api/alertas/local1:energia_kw:t1/reconocer"
        self.assertEqual(self.pedir("POST", ruta, "[operario]", "planta")[0], 403)
        self.assertEqual(self.pedir("POST", ruta, "[jefe]", "oficinas")[0], 403)
        self.assertEqual(self.pedir("POST", ruta, "[jefe]", "planta")[0], 200)
        self.assertEqual(len(self.L.AUDIT.items), 1)

    def test_reconocer_con_comentario_una_sola_vez(self):
        ruta = "/api/alertas/local1:energia_kw:t1/reconocer"
        claims = {"cognito:groups": "[jefe]", "custom:sede": "planta", "cognito:username": "jefe.planta"}

        def post(cuerpo):
            r = self.L.lambda_handler({"rawPath": ruta, "body": cuerpo, "requestContext": {
                "http": {"method": "POST"}, "authorizer": {"jwt": {"claims": claims}}}}, None)
            return r["statusCode"], json.loads(r["body"])

        self.assertEqual(post('{"comentario": "' + "x" * 501 + '"}')[0], 400)
        c, a = post('{"comentario": "Era el compresor 2, ya se apagó"}')
        self.assertEqual((c, a["reconocida_por"], a["comentario"]), (200, "jefe.planta", "Era el compresor 2, ya se apagó"))
        self.assertEqual(post('{"comentario": "otro"}')[0], 409)  # no se reescribe
        reg = list(self.L.AUDIT.items.values())[0]
        self.assertIn("compresor 2", reg["detalle"])
        self.assertEqual(self.pedir("POST", "/api/alertas/local1:no:existe/reconocer", "[jefe]", "planta")[0], 404)

    def test_auditoria(self):
        self.assertEqual(self.pedir("GET", "/api/auditoria", "[jefe]", "todas")[0], 403)
        self.assertEqual(self.pedir("GET", "/api/auditoria", "[admin-sede]", "planta", {"sede": "local2"})[0], 403)
        c, b = self.pedir("GET", "/api/auditoria", "[admin-general]", "todas")
        self.assertEqual(set(b["integridad"]), {"local1", "local2", "general"})

    def test_rutas_usuarios(self):
        from test_usuarios import CognitoFalso
        import usuarios as U

        self.L._usuarios = U.Usuarios(CognitoFalso(), "pool", self.L.AUDIT)
        self.assertEqual(self.pedir("GET", "/api/usuarios", "[jefe]", "todas")[0], 403)
        c, b = self.pedir("GET", "/api/usuarios", "[admin-sede]", "planta")
        self.assertEqual((c, [u["usuario"] for u in b]), (200, ["barbara", "lisandra"]))
        ev_cuerpo = '{"usuario": "op.nuevo", "email": "o@x.cl", "grupo": "operario", "sede": "planta"}'
        claims = {"cognito:groups": "[admin-sede]", "custom:sede": "planta", "cognito:username": "barbara"}
        r = self.L.lambda_handler({"rawPath": "/api/usuarios", "body": ev_cuerpo, "requestContext": {
            "http": {"method": "POST"}, "authorizer": {"jwt": {"claims": claims}}}}, None)
        self.assertEqual(r["statusCode"], 201)
        r = self.L.lambda_handler({"rawPath": "/api/usuarios/op.nuevo/desactivar", "requestContext": {
            "http": {"method": "POST"}, "authorizer": {"jwt": {"claims": claims}}}}, None)
        self.assertEqual(r["statusCode"], 200)
        self.assertEqual(self.pedir("POST", "/api/usuarios/op.nuevo/borrar", "[admin-general]", "todas")[0], 404)

    def test_health_e_ingesta_sin_token(self):
        self.assertEqual(self.pedir("GET", "/health")[0], 200)
        self.assertEqual(self.pedir("POST", "/intervalos")[0], 401)  # pide la clave del Edge, no el token


if __name__ == "__main__":
    unittest.main()
