"""POST /auditoria/edge: la auditoría local del Edge entra a la cadena de la nube (tarea 29)."""

import json
import os
import re
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "prueba")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "prueba")
import auditoria as A  # noqa: E402
from test_auditoria import RepoMemoria  # noqa: E402

try:
    import boto3  # noqa: F401
except ImportError:  # pragma: no cover
    boto3 = None

EDGE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "edge", "auditoria_local.py")


class TablaFalsa:
    def __init__(self):
        self.items = {}

    def get_item(self, Key, **_):
        i = self.items.get((Key["sede"], Key["id"]))
        return {"Item": dict(i)} if i else {}

    def put_item(self, Item):
        self.items[(Item["sede"], Item["id"])] = dict(Item)


def cadena_edge(n, inicio=A.GENESIS):
    regs, ant = [], inicio
    for i in range(n):
        r = {"sede": "local1", "id": f"2026-11-03T05:0{i}:00.000Z#ab{i}", "ts": f"2026-11-03T05:0{i}:00.000Z",
             "usuario": "jefe.planta", "rol": "jefe_mantenimiento_operaciones", "accion": "alerta.reconocida",
             "objeto": f"local1:uv_index:{i}", "detalle": json.dumps({"comentario": f"c{i}"}, sort_keys=True),
             "origen": "edge", "hash_anterior": ant}
        r["hash"] = A.calcular_hash(r)
        ant = r["hash"]
        regs.append(r)
    return regs


class TestMismoHash(unittest.TestCase):
    def test_edge_y_nube_usan_los_mismos_campos(self):
        fuente = open(EDGE, encoding="utf-8").read()
        campos = re.search(r"^CAMPOS = (\(.*?\))", fuente, re.M).group(1)
        self.assertEqual(eval(campos), A.CAMPOS)  # noqa: S307 (es una tupla literal del repo)


@unittest.skipUnless(boto3, "boto3 no está instalado")
class TestRecibir(unittest.TestCase):
    def setUp(self):
        import lambda_function as L
        self.L = L
        self.repo = RepoMemoria()
        self.repo.t = TablaFalsa()
        for p in (mock.patch.object(L, "AUDIT", self.repo), mock.patch.object(L, "CLAVE_INGESTA", "clave-edge")):
            p.start()
            self.addCleanup(p.stop)

    def enviar(self, registros, clave="clave-edge"):
        r = self.L.lambda_handler({"rawPath": "/auditoria/edge", "headers": {"x-induplac-key": clave},
                                   "body": json.dumps({"edge_id": "edge-local-01", "registros": registros}),
                                   "requestContext": {"http": {"method": "POST"}}}, None)
        return r["statusCode"], json.loads(r["body"])

    def nube(self):
        return sorted(self.repo.items.values(), key=lambda r: r["id"])

    def test_clave(self):
        self.assertEqual(self.enviar(cadena_edge(1), clave="otra")[0], 401)

    def test_entra_a_la_cadena_sin_duplicar(self):
        regs = cadena_edge(3)
        c, b = self.enviar(regs)
        self.assertEqual((c, b["recibidos"], b["alterados"]), (200, 3, 0))
        c, b = self.enviar(regs)  # el Edge reintenta: no se duplica
        self.assertEqual((b["recibidos"], b["duplicados"]), (0, 3))
        nube = self.nube()
        self.assertEqual(len(nube), 3)
        self.assertEqual({r["origen"] for r in nube}, {"edge"})
        d = json.loads(nube[0]["detalle"])
        self.assertEqual((d["comentario"], d["_edge"]["hash_ok"], d["_edge"]["cadena_ok"]), ("c0", True, True))
        r = A.consultar(self.repo, ["local1"], A.leer_ts("2026-01-01T00:00:00.000Z"), A.leer_ts("2100-01-01T00:00:00.000Z"))
        self.assertEqual(r["integridad"]["local1"]["estado"], "ok")  # la cadena de la nube sigue sana

    def test_marca_lo_cambiado_en_el_edge(self):
        regs = cadena_edge(3)
        regs[1]["usuario"] = "intruso"  # cambiado en la Raspberry después de guardarse
        c, b = self.enviar(regs)
        self.assertEqual(b["alterados"], 1)
        d = json.loads(self.nube()[1]["detalle"])["_edge"]
        self.assertEqual((d["hash_ok"], d["cadena_ok"]), (False, True))

    def test_marca_un_hueco_en_la_cadena_del_edge(self):
        regs = cadena_edge(3)
        self.enviar(regs[:1])
        c, b = self.enviar(regs[2:])  # el registro 1 se borró en la Raspberry antes de subir
        self.assertEqual(b["alterados"], 1)
        d = json.loads(self.nube()[-1]["detalle"])["_edge"]
        self.assertEqual((d["hash_ok"], d["cadena_ok"]), (True, False))

    def test_cadena_reiniciada(self):
        self.enviar(cadena_edge(2))
        nueva = cadena_edge(1)
        nueva[0]["id"] = "2026-11-04T00:00:00.000Z#zz"
        nueva[0]["hash"] = A.calcular_hash(nueva[0])
        c, b = self.enviar(nueva)  # empieza de nuevo en 0000…: borraron la base del Edge
        self.assertEqual(b["alterados"], 1)


if __name__ == "__main__":
    unittest.main()
