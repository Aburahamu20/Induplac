"""Revisa la petición real que boto3 arma para la transacción de auditoría.

Se intercepta antes de enviarla (no llega a AWS). Se salta si boto3 no está
instalado (el CI no lo instala; en la Lambda viene incluido).
"""

import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import boto3
    from botocore.awsrequest import AWSResponse
except ImportError:  # pragma: no cover
    boto3 = None


class _Cuerpo:
    def stream(self, **_):
        yield b"{}"


@unittest.skipUnless(boto3, "boto3 no está instalado")
class TestRepoDynamo(unittest.TestCase):
    def setUp(self):
        os.environ.setdefault("AWS_ACCESS_KEY_ID", "prueba")
        os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "prueba")
        import auditoria

        self.capturado = {}

        def enviar(request, **_):
            self.capturado = json.loads(request.body)
            r = AWSResponse(request.url, 200, {}, _Cuerpo())
            r._content = b"{}"
            return r

        tabla = boto3.resource("dynamodb", region_name="us-east-1").Table("induplac-auditoria")
        tabla.meta.client.meta.events.register("before-send", enviar)
        self.repo = auditoria.RepoDynamo(tabla)
        self.reg = {"sede": "local1", "id": "2026-11-02T15:00:00.000Z#ab", "ts": "2026-11-02T15:00:00.000Z",
                    "usuario": "u", "rol": "jefe", "accion": "a", "objeto": "o", "detalle": "{}",
                    "origen": "nube", "hash_anterior": "0" * 64, "hash": "f" * 64}

    def test_tipos_simples_sin_doble_conversion(self):
        self.repo.escribir(self.reg, "0" * 64)
        upd, put = (x[k] for x, k in zip(self.capturado["TransactItems"], ("Update", "Put")))
        self.assertEqual(upd["ExpressionAttributeValues"][":uno"], {"N": "1"})
        self.assertEqual(upd["ExpressionAttributeValues"][":p"], {"S": "0" * 64})
        self.assertEqual(upd["Key"], {"sede": {"S": "cadena"}, "id": {"S": "local1"}})
        self.assertEqual(put["Item"]["usuario"], {"S": "u"})
        # palabras reservadas siempre con #
        self.assertNotIn(" total", upd["UpdateExpression"])
        self.assertIn("#tot", upd["UpdateExpression"])


if __name__ == "__main__":
    unittest.main()
