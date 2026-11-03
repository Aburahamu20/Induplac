"""
Auditoría local del Edge (tarea 29): cadena de hashes en SQLite, acciones auditadas
y subida a la nube al reconectar. Sin AWS ni red: base temporal y envío simulado.

Correr local (desde la carpeta edge/):  py -m unittest discover -s tests -v
"""

import base64
import json
import os
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

_TMP = tempfile.mkdtemp()
os.environ.setdefault("DB", os.path.join(_TMP, "prueba.db"))
os.environ["AWS_API_URL"] = ""
os.environ.setdefault("EDGE_CLAVE_MFA", base64.b64encode(os.urandom(32)).decode())
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import api_local  # noqa: E402
import auditoria_local as A  # noqa: E402
import auth_local  # noqa: E402
import config  # noqa: E402
import db  # noqa: E402
from auth_local import ErrorApi  # noqa: E402
from sincronizacion import Enlace  # noqa: E402

JEFE = {"usuario": "jefe.planta", "rol": "jefe_mantenimiento_operaciones", "locales": ["local1"],
        "permisos": ["ver_actual", "ver_alertas", "reconocer_alertas"]}
ADMIN = {"usuario": "admin.edge", "rol": "administrador", "locales": ["local1", "local2"],
         "permisos": ["ver_actual", "ver_alertas", "reconocer_alertas", "gestionar_usuarios"]}


def limpiar():
    db.ejecutar_script("DROP TRIGGER IF EXISTS auditoria_sin_borrar; DELETE FROM auditoria_local;")
    db.ejecutar_script("""
        CREATE TRIGGER auditoria_sin_borrar BEFORE DELETE ON auditoria_local
        BEGIN SELECT RAISE(ABORT, 'La auditoría no se borra'); END;""")


def alerta(id_, local="local1"):
    db.guardar_alerta({"id": id_, "local_id": local, "variable": "uv_index", "valor": 9.0, "umbral": 8.0,
                       "regla": "UV", "inicio_intervalo": "2026-11-03T15:00:00Z"})


class Ctx:
    def __init__(self, estado="offline"):
        self.enlace = type("E", (), {"estado": estado})()


class TestCadena(unittest.TestCase):
    def setUp(self):
        limpiar()

    def test_encadena_y_verifica(self):
        a = A.registrar("local1", "u", "jefe", "x", "1", {"n": 1}, ahora=1_000.0)
        b = A.registrar("local1", "u", "jefe", "x", "2", ahora=1_000.0)  # mismo ms: sigue en orden
        self.assertEqual(a["hash_anterior"], A.GENESIS)
        self.assertEqual(b["hash_anterior"], a["hash"])
        self.assertGreater(b["id"], a["id"])
        self.assertEqual(A.verificar(), [])

    def test_no_se_borra_ni_se_edita_desde_la_app(self):
        A.registrar("local1", "u", "jefe", "x", "1")
        with self.assertRaises(sqlite3.DatabaseError):
            db.ejecutar("DELETE FROM auditoria_local")
        with self.assertRaises(sqlite3.DatabaseError):
            db.ejecutar("UPDATE auditoria_local SET usuario='otro'")
        db.ejecutar("UPDATE auditoria_local SET is_synced=1")  # esto sí se permite

    def test_detecta_cambios_y_borrados_hechos_a_mano(self):
        for i in range(4):
            A.registrar("local1", "u", "jefe", "x", str(i))
        # alguien con acceso a la Raspberry quita los triggers y toca la base
        db.ejecutar_script("DROP TRIGGER auditoria_sin_borrar; DROP TRIGGER auditoria_sin_editar;")
        db.ejecutar("UPDATE auditoria_local SET usuario='intruso' WHERE objeto='1'")
        db.ejecutar("DELETE FROM auditoria_local WHERE objeto='2'")
        tipos = {p["tipo"] for p in A.verificar()}
        self.assertEqual(tipos, {"modificado", "faltante"})
        db.ejecutar_script("""
            CREATE TRIGGER auditoria_sin_editar BEFORE UPDATE OF
                id, sede, ts, usuario, rol, accion, objeto, detalle, origen, hash_anterior, hash ON auditoria_local
            BEGIN SELECT RAISE(ABORT, 'La auditoría no se edita'); END;""")
        limpiar()


class TestAcciones(unittest.TestCase):
    def setUp(self):
        limpiar()

    def test_reconocer_con_comentario_una_vez_y_auditado(self):
        alerta("local1:uv_index:t-a")
        a = api_local.reconocer(Ctx("offline"), JEFE, "local1:uv_index:t-a", {"comentario": "Se movió la carga a sombra"})
        self.assertEqual((a["reconocida_por"], a["comentario"]), ("jefe.planta", "Se movió la carga a sombra"))
        with self.assertRaises(ErrorApi) as e:
            api_local.reconocer(Ctx(), JEFE, "local1:uv_index:t-a", {"comentario": "otro"})
        self.assertEqual(e.exception.http, 409)
        r = A.lista(["local1"])[0]
        self.assertEqual((r["accion"], r["usuario"], r["detalle"]["sin_internet"]), ("alerta.reconocida", "jefe.planta", True))

    def test_ver_auditoria_solo_admin(self):
        alerta("local1:uv_index:t-b")
        api_local.reconocer(Ctx("online"), JEFE, "local1:uv_index:t-b")
        with self.assertRaises(ErrorApi):
            api_local.ver_auditoria(JEFE, {})
        r = api_local.ver_auditoria(ADMIN, {})
        self.assertEqual((r["integridad"]["edge"]["estado"], r["pendientes_de_subir"]), ("ok", 1))

    def test_bloqueo_de_cuenta_queda_registrado(self):
        auth_local.crear_usuario("op.bloqueo", "operario", ["local1"])
        for _ in range(config.INTENTOS_BLOQUEO):
            try:
                auth_local.login("op.bloqueo", "clave-mala")
            except ErrorApi:
                pass
        acciones = [r["accion"] for r in A.lista(["general"])]
        self.assertIn("sesion.bloqueada", acciones)


class TestSubida(unittest.TestCase):
    def setUp(self):
        limpiar()

    def test_sube_en_orden_y_marca(self):
        for i in range(3):
            A.registrar("local1", "u", "jefe", "x", str(i))
        e = Enlace()
        enviados = []
        e._pedir = lambda metodo, ruta, cuerpo=None: enviados.append((ruta, cuerpo)) or {}
        e._subir_auditoria()
        self.assertEqual(enviados[0][0], "/auditoria/edge")
        regs = enviados[0][1]["registros"]
        self.assertEqual([r["objeto"] for r in regs], ["0", "1", "2"])
        self.assertEqual(regs[1]["hash_anterior"], regs[0]["hash"])
        self.assertEqual(A.calcular_hash(regs[0]), regs[0]["hash"])  # la nube puede comprobarlo
        self.assertEqual(A.contar_pendientes(), 0)

    def test_si_falla_quedan_pendientes(self):
        A.registrar("local1", "u", "jefe", "x", "1")
        e = Enlace()

        def falla(*_a, **_k):
            raise OSError("sin internet")
        e._pedir = falla
        with self.assertRaises(OSError):
            e._subir_auditoria()
        self.assertEqual(A.contar_pendientes(), 1)


if __name__ == "__main__":
    unittest.main()
