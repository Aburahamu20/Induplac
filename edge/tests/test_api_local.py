"""
Pruebas de la API local del Edge y del login de planta (tarea 22).

Levantan la API de verdad en un puerto libre de 127.0.0.1 con una base SQLite temporal
y un build falso del dashboard. Sin broker, sin AWS y sin red externa.

Correr local (desde la carpeta edge/):  py -m unittest discover -s tests -v
"""

import base64
import json
import os
import re
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import quote

# Todo antes de importar config: base temporal, sin AWS, con demo y con su propia clave MFA
_TMP = tempfile.mkdtemp()
os.environ.setdefault("DB", os.path.join(_TMP, "prueba.db"))
os.environ["AWS_API_URL"] = ""
os.environ["LOCALES"] = "local1,local2"
os.environ["DEMO"] = "1"
os.environ["DASHBOARD_DIR"] = os.path.join(_TMP, "dist-planta")
os.environ["EDGE_CLAVE_MFA"] = base64.b64encode(os.urandom(32)).decode()
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import api_local  # noqa: E402
import auth_local  # noqa: E402
import db  # noqa: E402
import reglas  # noqa: E402
from sincronizacion import Enlace  # noqa: E402

CLAVE = "clave-personal-123"

# Build falso del dashboard
_DIST = Path(os.environ["DASHBOARD_DIR"])
(_DIST / "assets").mkdir(parents=True)
(_DIST / "index.html").write_text("<!doctype html><title>Induplac</title>", encoding="utf-8")
(_DIST / "assets" / "app-123.js").write_text("console.log('ok')", encoding="utf-8")


class Servidor(unittest.TestCase):
    """Base: API real en un hilo + helpers para pedir y para iniciar sesión."""

    @classmethod
    def setUpClass(cls):
        cls.enlace = Enlace()
        cls.abiertos: dict = {}
        cls.srv = api_local.crear_servidor(cls.enlace, lambda: cls.abiertos, host="127.0.0.1", puerto=0)
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()
        cls.base = f"http://127.0.0.1:{cls.srv.server_address[1]}"

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()
        cls.srv.server_close()

    def pedir(self, metodo, ruta, cuerpo=None, token=None, crudo=False):
        datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
        req = urllib.request.Request(self.base + ruta, data=datos, method=metodo)
        req.add_header("Content-Type", "application/json")
        if token:
            req.add_header("Authorization", f"Bearer {token}")
        try:
            with urllib.request.urlopen(req, timeout=5) as r:
                return r.status, (r.read() if crudo else json.loads(r.read())), r.headers
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read()), e.headers

    def ok(self, metodo, ruta, cuerpo=None, token=None):
        codigo, datos, _ = self.pedir(metodo, ruta, cuerpo, token)
        self.assertEqual(codigo, 200, datos)
        return datos

    @staticmethod
    def usuario_nuevo(prefijo, rol, locales, permisos=None):
        nombre = f"{prefijo}{time.time_ns() % 10**9}"
        return nombre, auth_local.crear_usuario(nombre, rol, locales, permisos)

    def entrar(self, rol="jefe_mantenimiento_operaciones", locales=("local1", "local2"), permisos=None):
        """Recorre el login completo (cambio de clave y, si corresponde, MFA). Devuelve el token."""
        nombre, temporal = self.usuario_nuevo("u", rol, list(locales), permisos)
        r = self.ok("POST", "/api/auth/login", {"usuario": nombre, "clave": temporal})
        r = self.ok("POST", "/api/auth/cambiar-clave", {"sesion": r["sesion"], "clave_nueva": CLAVE})
        if r.get("desafio") == "registrar_mfa":
            qr = self.ok("POST", "/api/auth/mfa/registrar", {"sesion": r["sesion"]})
            secreto = re.search(r"secret=([A-Z2-7]+)", qr["qr_uri"]).group(1)
            r = self.ok("POST", "/api/auth/mfa/verificar", {"sesion": r["sesion"], "codigo": auth_local.totp(secreto)})
        return r["token"]


class Login(Servidor):
    def test_operario_cambia_la_clave_y_entra_sin_mfa(self):
        nombre, temporal = self.usuario_nuevo("op", "operario", ["local1"])
        r = self.ok("POST", "/api/auth/login", {"usuario": nombre, "clave": temporal})
        self.assertEqual(r["desafio"], "cambiar_clave")
        r = self.ok("POST", "/api/auth/cambiar-clave", {"sesion": r["sesion"], "clave_nueva": CLAVE})
        self.assertIn("token", r)
        self.assertEqual((r["rol"], r["locales"]), ("operario", ["local1"]))
        # Segundo inicio: ya sin desafío
        self.assertIn("token", self.ok("POST", "/api/auth/login", {"usuario": nombre, "clave": CLAVE}))

    def test_clave_nueva_corta_o_igual_a_la_temporal_se_rechaza(self):
        nombre, temporal = self.usuario_nuevo("op", "operario", ["local1"])
        sesion = self.ok("POST", "/api/auth/login", {"usuario": nombre, "clave": temporal})["sesion"]
        codigo, r, _ = self.pedir("POST", "/api/auth/cambiar-clave", {"sesion": sesion, "clave_nueva": "corta"})
        self.assertEqual((codigo, r["error"]["codigo"]), (400, "CLAVE_DEBIL"))
        codigo, r, _ = self.pedir("POST", "/api/auth/cambiar-clave", {"sesion": sesion, "clave_nueva": temporal})
        self.assertEqual((codigo, r["error"]["codigo"]), (400, "CLAVE_REPETIDA"))

    def test_login_completo_con_registro_de_mfa_y_codigo(self):
        nombre, temporal = self.usuario_nuevo("jefe", "jefe_mantenimiento_operaciones", ["local1", "local2"])
        r = self.ok("POST", "/api/auth/login", {"usuario": nombre, "clave": temporal})
        r = self.ok("POST", "/api/auth/cambiar-clave", {"sesion": r["sesion"], "clave_nueva": CLAVE})
        self.assertEqual(r["desafio"], "registrar_mfa")  # tiene reconocer_alertas -> MFA obligatorio
        sesion = r["sesion"]
        qr = self.ok("POST", "/api/auth/mfa/registrar", {"sesion": sesion})["qr_uri"]
        self.assertTrue(qr.startswith("otpauth://totp/Induplac%20Planta"))
        secreto = re.search(r"secret=([A-Z2-7]+)", qr).group(1)

        codigo, r, _ = self.pedir("POST", "/api/auth/mfa/verificar", {"sesion": sesion, "codigo": "000000"
                                  if auth_local.totp(secreto) != "000000" else "111111"})
        self.assertEqual(codigo, 401)
        r = self.ok("POST", "/api/auth/mfa/verificar", {"sesion": sesion, "codigo": auth_local.totp(secreto)})
        self.assertEqual(r["permisos"], auth_local.ROLES["jefe_mantenimiento_operaciones"])

        # Siguiente inicio: pide código; el mismo código no sirve dos veces
        sesion = self.ok("POST", "/api/auth/login", {"usuario": nombre, "clave": CLAVE})
        self.assertEqual(sesion["desafio"], "codigo_mfa")
        usado = auth_local.totp(secreto)
        codigo, _, _ = self.pedir("POST", "/api/auth/mfa/verificar", {"sesion": sesion["sesion"], "codigo": usado})
        self.assertEqual(codigo, 401)
        siguiente = auth_local.totp(secreto, time.time() + 30)  # el de los próximos 30 s se acepta (±1 paso)
        r = self.ok("POST", "/api/auth/mfa/verificar", {"sesion": sesion["sesion"], "codigo": siguiente})
        self.assertIn("token", r)

        # yo y logout
        self.assertEqual(self.ok("GET", "/api/auth/yo", token=r["token"])["usuario"], nombre)
        self.ok("POST", "/api/auth/logout", {}, token=r["token"])
        self.assertEqual(self.pedir("GET", "/api/auth/yo", token=r["token"])[0], 401)

    def test_clave_mala_y_usuario_inexistente_dan_el_mismo_error(self):
        nombre, _ = self.usuario_nuevo("op", "operario", ["local1"])
        a = self.pedir("POST", "/api/auth/login", {"usuario": nombre, "clave": "mala-clave-xx"})
        b = self.pedir("POST", "/api/auth/login", {"usuario": "no-existe", "clave": "mala-clave-xx"})
        self.assertEqual(a[:2], b[:2])
        self.assertEqual(a[0], 401)

    def test_bloqueo_tras_5_intentos_fallidos(self):
        nombre, temporal = self.usuario_nuevo("op", "operario", ["local1"])
        for _ in range(5):
            self.assertEqual(self.pedir("POST", "/api/auth/login", {"usuario": nombre, "clave": "mala-clave-xx"})[0], 401)
        codigo, r, _ = self.pedir("POST", "/api/auth/login", {"usuario": nombre, "clave": temporal})
        self.assertEqual((codigo, r["error"]["codigo"]), (403, "CUENTA_BLOQUEADA"))
        # El Administrador resetea la clave: se desbloquea con la nueva temporal
        nueva = auth_local.resetear_clave(nombre)
        self.assertEqual(self.ok("POST", "/api/auth/login", {"usuario": nombre, "clave": nueva})["desafio"], "cambiar_clave")

    def test_resetear_mfa_obliga_a_registrarlo_de_nuevo(self):
        token = self.entrar()
        nombre = self.ok("GET", "/api/auth/yo", token=token)["usuario"]
        auth_local.resetear_mfa(nombre)
        self.assertEqual(self.pedir("GET", "/api/estado", token=token)[0], 401)  # cierra sus sesiones
        r = self.ok("POST", "/api/auth/login", {"usuario": nombre, "clave": CLAVE})
        self.assertEqual(r["desafio"], "registrar_mfa")

    def test_sesion_temporal_no_sirve_para_otro_paso(self):
        nombre, temporal = self.usuario_nuevo("jefe", "jefe_mantenimiento_operaciones", ["local1"])
        sesion = self.ok("POST", "/api/auth/login", {"usuario": nombre, "clave": temporal})["sesion"]
        self.assertEqual(self.pedir("POST", "/api/auth/mfa/registrar", {"sesion": sesion})[0], 401)

    def test_token_expirado(self):
        token = self.entrar(rol="operario", locales=("local1",))
        db.ejecutar("UPDATE sesiones SET expira=0 WHERE token_hash=?", (auth_local._sha(token),))
        self.assertEqual(self.pedir("GET", "/api/estado", token=token)[0], 401)

    def test_en_la_base_no_quedan_ni_claves_ni_tokens_ni_secretos(self):
        token = self.entrar()
        nombre = self.ok("GET", "/api/auth/yo", token=token)["usuario"]
        fila = db.consultar("SELECT * FROM usuarios WHERE usuario=?", (nombre,))[0]
        self.assertTrue(fila["clave_hash"].startswith("scrypt$"))
        self.assertNotIn(CLAVE, fila["clave_hash"])
        secreto = auth_local.descifrar(fila["mfa_secreto"])
        self.assertNotIn(secreto, fila["mfa_secreto"])
        self.assertFalse(db.consultar("SELECT 1 FROM sesiones WHERE token_hash=?", (token,)))
        self.assertTrue(db.consultar("SELECT 1 FROM sesiones WHERE token_hash=?", (auth_local._sha(token),)))


class Permisos(Servidor):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        ahora = int(time.time())
        db.guardar_alerta({"id": f"local2:uv_index:{reglas.iso(ahora)}", "local_id": "local2", "variable": "uv_index",
                           "valor": 9, "umbral": 8, "regla": "prueba", "inicio_intervalo": reglas.iso(ahora)})

    def setUp(self):
        self.operario = self.entrar(rol="operario", locales=("local1",))

    def test_sin_token_todo_es_401(self):
        for ruta in ("/api/estado", "/api/locales", "/api/locales/local1/actual", "/api/alertas", "/api/historico"):
            codigo, r, _ = self.pedir("GET", ruta)
            self.assertEqual((codigo, r["error"]["codigo"]), (401, "NO_AUTENTICADO"), ruta)

    def test_operario_no_ve_el_otro_local(self):
        codigo, r, _ = self.pedir("GET", "/api/locales/local2/actual", token=self.operario)
        self.assertEqual((codigo, r["error"]["codigo"]), (403, "LOCAL_NO_PERMITIDO"))
        self.assertEqual(self.pedir("GET", "/api/alertas?local_id=local2", token=self.operario)[0], 403)
        # Y en las listas solo aparece el suyo
        self.assertEqual([l["local_id"] for l in self.ok("GET", "/api/locales", token=self.operario)], ["local1"])
        self.assertEqual([l["local_id"] for l in self.ok("GET", "/api/estado", token=self.operario)["locales"]], ["local1"])
        self.assertTrue(all(a["local_id"] == "local1" for a in self.ok("GET", "/api/alertas", token=self.operario)))

    def test_operario_sin_historico_ni_reconocer(self):
        codigo, r, _ = self.pedir("GET", "/api/historico?local_id=local1&variable=energia_kw"
                                  "&desde=2026-10-01T00:00:00Z&hasta=2026-10-02T00:00:00Z", token=self.operario)
        self.assertEqual((codigo, r["error"]["codigo"]), (403, "SIN_PERMISO"))
        codigo, _, _ = self.pedir("POST", "/api/alertas/local1%3Auv_index%3Ax/reconocer", {}, token=self.operario)
        self.assertEqual(codigo, 403)

    def test_permiso_quitado_por_el_administrador_se_respeta(self):
        token = self.entrar(rol="operario", locales=("local1",), permisos=["ver_actual"])
        self.assertEqual(self.pedir("GET", "/api/alertas", token=token)[0], 403)

    def test_jefe_reconoce_y_queda_pendiente_de_subir(self):
        jefe = self.entrar()
        id_ = self.ok("GET", "/api/alertas?local_id=local2&estado=activa", token=jefe)[0]["id"]
        db.marcar_alertas([id_])
        a = self.ok("POST", f"/api/alertas/{quote(id_, safe='')}/reconocer", {}, token=jefe)
        self.assertEqual(a["estado"], "reconocida")
        self.assertIsNotNone(a["reconocida_en"])
        self.assertIn(id_, [x["id"] for x in db.alertas_pendientes("local2")])

    def test_local_o_alerta_inexistente_es_404(self):
        jefe = self.entrar()
        self.assertEqual(self.pedir("GET", "/api/locales/local9/actual", token=jefe)[0], 404)
        self.assertEqual(self.pedir("POST", "/api/alertas/local1%3Anada%3Ax/reconocer", {}, token=jefe)[0], 404)


class Endpoints(Servidor):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # Un intervalo cerrado hace 1 h y uno en curso (lo comparte el Edge, no está en la base)
        ahora = int(time.time())
        cls.cerrado = reglas.iso(reglas.inicio_de(ahora - 3600))
        db.guardar_intervalo("local1", cls.cerrado, {"inicio_intervalo": cls.cerrado, "energia_kw": 40.0, "agua_m3h": 0.4,
                                                     "agua_m3": 0.1, "uv_max": 5.0, "hh_sin_incidentes": 1800,
                                                     "dias_sin_incidentes": 60, "produccion_mes": 300, "produccion_anual": 3400})
        cls.en_curso = reglas.iso(reglas.inicio_de(ahora))
        cls.abiertos["local1"] = {"inicio_intervalo": cls.en_curso, "energia_kw": 60.0, "agua_m3h": 0.5, "agua_m3": 0.2,
                                  "uv_max": 6.5, "hh_sin_incidentes": 1801, "dias_sin_incidentes": 60,
                                  "produccion_mes": 301, "produccion_anual": 3401}
        db.guardar_lectura("local1", "esp32-prueba", 1, ahora, {"device_id": "esp32-prueba", "seq": 1, "energia_kw": 60.0,
                                                                  "agua_m3h": 0.5, "uv_index": 6.5, "personal_activo": 18})

    def setUp(self):
        self.token = self.entrar(rol="administrador")

    def test_estado(self):
        r = self.ok("GET", "/api/estado", token=self.token)
        self.assertEqual(r["origen"], "edge")
        l1 = next(l for l in r["locales"] if l["local_id"] == "local1")
        self.assertEqual(l1["enlace"], "offline")  # sin AWS_API_URL
        self.assertIsInstance(l1["pendientes"], int)
        self.assertIsNotNone(l1["ultimo_dato"])

    def test_locales(self):
        r = self.ok("GET", "/api/locales", token=self.token)
        self.assertEqual([l["local_id"] for l in r], ["local1", "local2"])
        self.assertIn("uv_index", r[0]["variables"])

    def test_actual_usa_el_intervalo_en_curso(self):
        r = self.ok("GET", "/api/locales/local1/actual", token=self.token)
        self.assertEqual(r["ts"], self.en_curso)
        v = {x["id"]: x for x in r["variables"]}
        self.assertEqual(v["energia_kw"]["valor"], 60.0)
        self.assertEqual(v["energia_kw"]["nivel"], "critico")  # sobre 55 kW sin 4 semanas de historia
        self.assertEqual(v["uv_index"]["nivel"], "advertencia")
        self.assertAlmostEqual(v["agua_m3_dia"]["valor"], 0.3, places=3)  # cerrado + en curso (mismo día en Chile)
        self.assertEqual(v["produccion_mes"]["referencia"], 400)

    def test_actual_sin_datos_es_503(self):
        self.assertEqual(self.pedir("GET", "/api/locales/local2/actual", token=self.token)[0], 503)

    def test_historico_por_hora_incluye_el_intervalo_en_curso(self):
        desde = reglas.iso(time.time() - 3 * 3600)
        hasta = reglas.iso(time.time() + 3600)
        r = self.ok("GET", f"/api/historico?local_id=local1&variable=energia_kw&desde={desde}&hasta={hasta}"
                    "&agrupacion=15min", token=self.token)
        puntos = r["series"][0]["puntos"]
        self.assertEqual([p["inicio"] for p in puntos], [self.cerrado, self.en_curso])
        self.assertEqual(puntos[1]["maximo"], 60.0)
        r = self.ok("GET", f"/api/historico?local_id=local1&variable=agua_m3_dia&desde={desde}&hasta={hasta}"
                    "&agrupacion=dia", token=self.token)
        self.assertIsNone(r["series"][0]["puntos"][0]["promedio"])

    def test_historico_parametros_invalidos(self):
        base = "/api/historico?local_id=local1&desde=2026-10-01T00:00:00Z&hasta=2026-10-02T00:00:00Z"
        self.assertEqual(self.pedir("GET", base + "&variable=nada", token=self.token)[0], 400)
        self.assertEqual(self.pedir("GET", base + "&variable=energia_kw&agrupacion=semana", token=self.token)[0], 400)
        codigo, r, _ = self.pedir("GET", "/api/historico?local_id=local1&variable=energia_kw&desde=ayer"
                                  "&hasta=2026-10-02T00:00:00Z", token=self.token)
        self.assertEqual((codigo, r["error"]["codigo"]), (400, "FECHA_INVALIDA"))

    def test_demo_inyectar_dispara_la_alerta(self):
        r = self.ok("POST", "/api/demo/inyectar", {"local_id": "local1", "variable": "uv_index", "valor": 9.5}, token=self.token)
        self.assertGreaterEqual(r["alertas_nuevas"] + len(self.ok("GET", "/api/alertas?local_id=local1", token=self.token)), 1)
        alertas = self.ok("GET", "/api/alertas?local_id=local1&estado=activa", token=self.token)
        uv = [a for a in alertas if a["variable"] == "uv_index"]
        self.assertTrue(uv)
        self.assertEqual((uv[0]["origen"], uv[0]["nivel"]), ("edge", "critico"))
        codigo, _, _ = self.pedir("POST", "/api/demo/inyectar", {"local_id": "local1", "variable": "uv_index", "valor": 99},
                                  token=self.token)
        self.assertEqual(codigo, 400)  # fuera de rango, igual que una lectura real

    def test_demo_enlace_corta_y_restablece_la_sincronizacion(self):
        self.ok("POST", "/api/demo/enlace", {"local_id": "local1", "conectado": False}, token=self.token)
        self.assertTrue(self.enlace.cortado)
        self.assertEqual(self.ok("GET", "/api/estado", token=self.token)["locales"][0]["enlace"], "offline")
        self.ok("POST", "/api/demo/enlace", {"local_id": "local1", "conectado": True}, token=self.token)
        self.assertFalse(self.enlace.cortado)

    def test_demo_tambien_pide_login(self):
        self.assertEqual(self.pedir("POST", "/api/demo/enlace", {"conectado": False})[0], 401)

    def test_ruta_inexistente_y_json_malo(self):
        self.assertEqual(self.pedir("GET", "/api/nada", token=self.token)[0], 404)
        req = urllib.request.Request(self.base + "/api/auth/login", data=b"no es json", method="POST")
        with self.assertRaises(urllib.error.HTTPError) as e:
            urllib.request.urlopen(req, timeout=5)
        self.assertEqual(e.exception.code, 400)


class Dashboard(Servidor):
    def test_raiz_y_rutas_desconocidas_dan_index(self):
        for ruta in ("/", "/historico/local1", "/no-existe.png"):
            codigo, cuerpo, h = self.pedir("GET", ruta, crudo=True)
            self.assertEqual(codigo, 200, ruta)
            self.assertIn(b"<title>Induplac</title>", cuerpo)
            self.assertTrue(h["Content-Type"].startswith("text/html"))

    def test_assets_con_tipo_y_cache(self):
        codigo, cuerpo, h = self.pedir("GET", "/assets/app-123.js", crudo=True)
        self.assertEqual((codigo, cuerpo), (200, b"console.log('ok')"))
        self.assertTrue(h["Content-Type"].startswith("text/javascript"))
        self.assertIn("immutable", h["Cache-Control"])

    def test_no_se_sale_de_la_carpeta_del_build(self):
        for ruta in ("/..%2F..%2Fprueba.db", "/%2e%2e/%2e%2e/edge/config.py"):
            codigo, cuerpo, _ = self.pedir("GET", ruta, crudo=True)
            self.assertEqual(codigo, 200)
            self.assertIn(b"<title>Induplac</title>", cuerpo)


class Demo(unittest.TestCase):
    def test_sin_demo_los_endpoints_no_existen(self):
        api_local.config.DEMO = False
        try:
            token = auth_local._emitir_token({"usuario": "x", "rol": "administrador", "locales": ["local1"],
                                              "permisos": auth_local.PERMISOS})["token"]
            db.ejecutar("INSERT OR IGNORE INTO usuarios (usuario, clave_hash, rol, locales, permisos, creado_en) "
                        "VALUES ('x', 'scrypt$1$1$1$00$00', 'administrador', '[\"local1\"]', ?, '')",
                        (json.dumps(auth_local.PERMISOS),))
            with self.assertRaises(api_local.ErrorApi) as e:
                api_local.despachar(api_local.Contexto(Enlace()), "POST", "/api/demo/enlace", {}, {"conectado": False},
                                    f"Bearer {token}")
            self.assertEqual(e.exception.http, 404)
        finally:
            api_local.config.DEMO = True


class Totp(unittest.TestCase):
    def test_vector_del_rfc_6238(self):
        # Apéndice B del RFC 6238 (SHA-1): secreto "12345678901234567890", T=59 -> 94287082 (8 dígitos)
        secreto = base64.b32encode(b"12345678901234567890").decode()
        self.assertEqual(auth_local.totp(secreto, 59), "287082")
        self.assertEqual(auth_local.totp(secreto, 1111111109), "081804")

    def test_cifrado_detecta_cambios(self):
        guardado = auth_local.cifrar("SECRETO")
        self.assertEqual(auth_local.descifrar(guardado), "SECRETO")
        crudo = bytearray(base64.b64decode(guardado))
        crudo[20] ^= 1
        with self.assertRaises(ValueError):
            auth_local.descifrar(base64.b64encode(bytes(crudo)).decode())


if __name__ == "__main__":
    unittest.main()
