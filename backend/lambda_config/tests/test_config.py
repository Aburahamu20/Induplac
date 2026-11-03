"""induplac-config: cambiar umbrales (RDS + copia en DynamoDB + auditoría) sin AWS ni RDS.

pg8000 se reemplaza por una base falsa en memoria. Se salta si boto3 no está.
"""

import json
import os
import sys
import types
import unittest
from unittest import mock

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(AQUI))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(AQUI)), "lambda_api"))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(AQUI)), "lambda_api", "tests"))
os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "prueba")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "prueba")
os.environ.setdefault("DB_HOST", "rds-falso")
os.environ.setdefault("DB_PASS", "x")

try:
    import boto3  # noqa: F401
except ImportError:  # pragma: no cover
    boto3 = None


class BaseFalsa:
    filas = {}

    def __init__(self, **_):
        self.columns = []

    def run(self, sql, **p):
        s = " ".join(sql.split())
        if s.startswith("SELECT advertencia, alerta FROM umbrales"):
            f = self.filas.get((p["l"], p["v"]))
            self.columns = [{"name": "advertencia"}, {"name": "alerta"}]
            return [[f["advertencia"], f["alerta"]]] if f else []
        if s.startswith("INSERT INTO umbrales"):
            self.filas[(p["l"], p["v"])] = {"local_id": p["l"], "variable": p["v"], "advertencia": p["a"],
                                            "alerta": p["r"], "unidad": p["u"], "actualizado": "ahora"}
            cols = ["local_id", "variable", "advertencia", "alerta", "unidad", "actualizado"]
            self.columns = [{"name": c} for c in cols]
            return [[self.filas[(p["l"], p["v"])][c] for c in cols]]
        if s.startswith("SELECT local_id, variable, advertencia, alerta, unidad, actualizado FROM umbrales"):
            cols = ["local_id", "variable", "advertencia", "alerta", "unidad", "actualizado"]
            self.columns = [{"name": c} for c in cols]
            return [[f[c] for c in cols] for f in self.filas.values()]
        raise AssertionError(f"SQL no esperado: {s[:60]}")

    def close(self):
        pass


@unittest.skipUnless(boto3, "boto3 no está instalado")
class TestConfig(unittest.TestCase):
    def setUp(self):
        pg = types.ModuleType("pg8000")
        pg.native = types.SimpleNamespace(Connection=BaseFalsa)
        sys.modules["pg8000"], sys.modules["pg8000.native"] = pg, pg.native
        import importlib.util
        spec = importlib.util.spec_from_file_location("config_lambda", os.path.join(os.path.dirname(AQUI), "lambda_function.py"))
        C = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(C)
        from test_auditoria import RepoMemoria
        self.C = C
        BaseFalsa.filas = {("local1", "uv"): {"local_id": "local1", "variable": "uv", "advertencia": 6, "alerta": 8,
                                              "unidad": "UVI", "actualizado": "antes"}}
        self.copias = []
        self.p = [mock.patch.object(C, "AUDIT", RepoMemoria()),
                  mock.patch.object(C, "T_UMB", types.SimpleNamespace(put_item=lambda Item: self.copias.append(Item)))]
        for x in self.p:
            x.start()
            self.addCleanup(x.stop)

    def put(self, ruta, grupos, sede, cuerpo=None):
        claims = {"cognito:groups": grupos, "custom:sede": sede, "cognito:username": "barbara"}
        r = self.C.lambda_handler({"rawPath": ruta, "body": json.dumps(cuerpo or {}), "requestContext": {
            "http": {"method": "PUT"}, "authorizer": {"jwt": {"claims": claims}}}}, None)
        return r["statusCode"], json.loads(r["body"])

    def test_cambiar_umbral(self):
        c, b = self.put("/config/umbrales/local1/uv", "[admin-sede]", "planta", {"advertencia": 5, "alerta": 7})
        self.assertEqual((c, b["alerta"], b["copiado"]), (200, 7.0, True))
        self.assertEqual((self.copias[0]["alerta"], self.copias[0]["actualizado_por"]), (7, "barbara"))
        reg = list(self.C.AUDIT.items.values())[0]
        self.assertEqual(reg["accion"], "umbral.modificado")
        self.assertEqual(json.loads(reg["detalle"])["antes"], {"advertencia": 6, "alerta": 8})

    def test_permisos_y_validacion(self):
        self.assertEqual(self.put("/config/umbrales/local1/uv", "[jefe]", "planta", {"alerta": 7})[0], 403)
        self.assertEqual(self.put("/config/umbrales/local1/uv", "[admin-sede]", "oficinas", {"alerta": 7})[0], 403)
        self.assertEqual(self.put("/config/umbrales/local1/uv", "[admin-sede]", "planta", {"advertencia": 9, "alerta": 7})[0], 400)
        self.assertEqual(self.put("/config/umbrales/local2/uv", "[admin-general]", "todas", {"alerta": 7})[0], 400)
        self.assertEqual(self.copias, [])

    def test_variable_nueva_y_copia_fallida(self):
        def rota(Item):
            raise RuntimeError("sin endpoint")
        with mock.patch.object(self.C, "T_UMB", types.SimpleNamespace(put_item=rota)):
            c, b = self.put("/config/umbrales/local2/agua_m3h", "[admin-general]", "todas", {"alerta": 0.08})
        self.assertEqual((c, b["copiado"]), (502, False))
        self.assertIn(("local2", "agua_m3h"), BaseFalsa.filas)  # quedó en RDS

    def test_sincronizar(self):
        self.assertEqual(self.put("/config/umbrales", "[admin-sede]", "planta")[0], 403)
        c, b = self.put("/config/umbrales", "[admin-general]", "todas")
        self.assertEqual((c, b["copiados"]), (200, ["local1:uv"]))

    def test_options_sin_rds(self):
        r = self.C.lambda_handler({"rawPath": "/config/umbrales", "requestContext": {"http": {"method": "OPTIONS"}}}, None)
        self.assertEqual(r["statusCode"], 204)


if __name__ == "__main__":
    unittest.main()
