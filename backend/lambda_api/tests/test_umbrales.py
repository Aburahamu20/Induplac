"""Umbrales: validación, copia en DynamoDB con valores por defecto y simulación (sin AWS)."""

import json
import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "prueba")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "prueba")
import umbrales as U  # noqa: E402

try:
    import boto3  # noqa: F401
except ImportError:  # pragma: no cover
    boto3 = None


class TablaCopia:
    def __init__(self, items=()):
        self.items = list(items)
        self.lecturas = 0

    def scan(self, **_):
        self.lecturas += 1
        return {"Items": [dict(i) for i in self.items]}


class TestValidar(unittest.TestCase):
    def test_validos(self):
        self.assertEqual(U.validar("local1", "agua_m3_dia", "11", 13.5), (11.0, 13.5))
        self.assertEqual(U.validar("local2", "agua_m3h", 0.01, 0.1), (None, 0.1))  # sin advertencia

    def test_invalidos(self):
        for args in [("local2", "uv", 6, 8), ("local1", "nada", 1, 2), ("local1", "uv", 9, 8),
                     ("local1", "uv", None, None), ("local1", "uv", -1, 8), ("local1", "energia_pct", 10, 500),
                     ("local1", "agua_m3_dia", "abc", 3)]:
            with self.assertRaises(ValueError, msg=args):
                U.validar(*args)


class TestCopia(unittest.TestCase):
    def test_defecto_y_copia(self):
        t = TablaCopia([{"local_id": "local1", "variable": "uv", "advertencia": Decimal("5"), "alerta": Decimal("7")}])
        u = U.Umbrales(t)
        self.assertEqual((u.get("local1", "uv")["alerta"], u.get("local1", "uv")["origen"]), (7.0, "copia"))
        self.assertEqual((u.get("local2", "agua_m3_dia")["alerta"], u.get("local2", "agua_m3_dia")["origen"]), (2.5, "defecto"))
        u.get("local1", "agua_m3h")
        self.assertEqual(t.lecturas, 1)  # caché

    def test_sin_tabla_usa_defecto(self):
        class Rota:
            def scan(self, **_):
                raise RuntimeError("sin permiso")
        self.assertEqual(U.Umbrales(Rota()).alerta("local1", "agua_m3_dia"), 14)

    def test_lista_por_sede(self):
        vs = [x["variable"] for x in U.Umbrales(TablaCopia()).lista(["local2"])]
        self.assertNotIn("uv", vs)
        self.assertIn("energia_pct", vs)


T0 = datetime(2026, 11, 2, 15, 0, tzinfo=timezone.utc)  # lunes 12:00 en Chile


def iv(t, **campos):
    return {"inicio_intervalo": t.strftime("%Y-%m-%dT%H:%M:%SZ"), **{k: Decimal(str(v)) for k, v in campos.items()}}


@unittest.skipUnless(boto3, "boto3 no está instalado")
class TestSimulacion(unittest.TestCase):
    def setUp(self):
        import lambda_function as L
        self.L = L
        L.UMB = U.Umbrales(TablaCopia())

    def test_agua_por_dia(self):
        datos = [iv(T0 - timedelta(days=d, minutes=15 * k), agua_m3=1) for d in range(3) for k in range(13)]  # 13 m³/día
        r = self.L.contar_eventos("agua_m3_dia", datos, T0 - timedelta(days=5),
                                  {"actual": (12, 14), "propuesto": (11, 12.5)})
        self.assertEqual(r["unidad"], "días")
        self.assertEqual((r["actual"]["alertas"], r["actual"]["advertencias"]), (0, 3))
        self.assertEqual(r["propuesto"]["alertas"], 3)

    def test_energia_pct_con_4_semanas(self):
        datos = [iv(T0 - timedelta(weeks=s), energia_kw=40) for s in range(1, 5)] + [iv(T0, energia_kw=50)]  # +25 %
        r = self.L.contar_eventos("energia_pct", datos, T0 - timedelta(days=1),
                                  {"actual": (10, 20), "propuesto": (20, 30)})
        self.assertEqual((r["actual"]["alertas"], r["propuesto"]["alertas"], r["propuesto"]["advertencias"]), (1, 0, 1))

    def test_fuga_solo_fuera_de_horario(self):
        noche = datetime(2026, 11, 3, 4, 0, tzinfo=timezone.utc)  # 01:00 en Chile
        datos = [iv(T0, agua_m3h=0.5), iv(noche, agua_m3h=0.5)]
        r = self.L.contar_eventos("agua_m3h", datos, T0 - timedelta(days=1), {"actual": (None, 0.3), "propuesto": (None, 0.6)})
        self.assertEqual((r["actual"]["evaluados"], r["actual"]["alertas"], r["propuesto"]["alertas"]), (1, 1, 0))

    def test_endpoint_permisos_y_respuesta(self):
        from unittest import mock
        p = mock.patch.object(self.L, "intervalos",
                              lambda local, desde, hasta: [iv(datetime.now(timezone.utc) - timedelta(hours=1), uv_max=7)])
        p.start()
        self.addCleanup(p.stop)

        def post(grupos, sede, cuerpo):
            claims = {"cognito:groups": grupos, "custom:sede": sede, "cognito:username": "u"}
            r = self.L.lambda_handler({"rawPath": "/api/umbrales/simulacion", "body": json.dumps(cuerpo), "requestContext": {
                "http": {"method": "POST"}, "authorizer": {"jwt": {"claims": claims}}}}, None)
            return r["statusCode"], json.loads(r["body"])

        cuerpo = {"local_id": "local1", "variable": "uv", "advertencia": 5, "alerta": 7, "dias": 30}
        self.assertEqual(post("[jefe]", "planta", cuerpo)[0], 403)
        self.assertEqual(post("[admin-sede]", "oficinas", cuerpo)[0], 403)
        self.assertEqual(post("[admin-sede]", "planta", {**cuerpo, "dias": 500})[0], 400)
        c, b = post("[admin-sede]", "planta", cuerpo)
        self.assertEqual(c, 200)
        self.assertEqual((b["actual"]["alertas"], b["actual"]["advertencias"], b["propuesto"]["alertas"]), (0, 1, 1))

    def test_alertas_usan_la_copia(self):
        self.L.UMB = U.Umbrales(TablaCopia([{"local_id": "local1", "variable": "uv", "advertencia": None, "alerta": Decimal("5")}]))
        from unittest import mock
        guardadas = []
        with mock.patch.object(self.L, "guardar_alerta", lambda *a: guardadas.append(a)), \
                mock.patch.object(self.L, "promedio_4_semanas", lambda *a: None), \
                mock.patch.object(self.L, "agua_del_dia", lambda *a: 0):
            self.L.evaluar_alertas("local1", {"inicio_intervalo": "2026-11-02T15:00:00Z", "uv_max": Decimal("5.5")})
        self.assertEqual(guardadas[0][1:3], ("uv_index", Decimal("5.5")))
        self.assertIn("5", guardadas[0][4])


if __name__ == "__main__":
    unittest.main()
