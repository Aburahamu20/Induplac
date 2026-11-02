"""Administración de usuarios con un Cognito falso en memoria (sin AWS)."""

import os
import sys
import types
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import usuarios as U  # noqa: E402
from test_auditoria import RepoMemoria  # noqa: E402


class CognitoFalso:
    class UserNotFoundException(Exception):
        pass

    class UsernameExistsException(Exception):
        pass

    def __init__(self):
        self.exceptions = types.SimpleNamespace(UserNotFoundException=self.UserNotFoundException,
                                                UsernameExistsException=self.UsernameExistsException)
        self.u = {}  # usuario -> {attrs, grupos, Enabled, UserStatus, mfa}
        self.cerradas = []
        for n, g, s in [("abraham", "admin-general", "todas"), ("barbara", "admin-sede", "planta"),
                        ("seba", "admin-sede", "oficinas"), ("lisandra", "operario", "planta"),
                        ("jefe.of", "jefe", "oficinas")]:
            self.u[n] = {"attrs": {"custom:sede": s, "email": f"{n}@x.cl"}, "grupos": {g}, "Enabled": True,
                         "UserStatus": "CONFIRMED", "mfa": True}

    def _user(self, n):
        if n not in self.u:
            raise self.UserNotFoundException()
        d = self.u[n]
        return {"Username": n, "Enabled": d["Enabled"], "UserStatus": d["UserStatus"],
                "Attributes": [{"Name": k, "Value": v} for k, v in d["attrs"].items()]}

    def admin_get_user(self, UserPoolId, Username):
        r = self._user(Username)
        r["UserAttributes"] = r.pop("Attributes")
        return r

    def admin_list_groups_for_user(self, UserPoolId, Username):
        return {"Groups": [{"GroupName": g} for g in self.u[Username]["grupos"]]}

    def list_users(self, UserPoolId, Limit, PaginationToken=None):
        return {"Users": [self._user(n) for n in self.u]}

    def list_users_in_group(self, UserPoolId, GroupName, Limit):
        return {"Users": [self._user(n) for n, d in self.u.items() if GroupName in d["grupos"]]}

    def admin_create_user(self, UserPoolId, Username, UserAttributes, DesiredDeliveryMediums):
        if Username in self.u:
            raise self.UsernameExistsException()
        self.u[Username] = {"attrs": {a["Name"]: a["Value"] for a in UserAttributes}, "grupos": set(),
                            "Enabled": True, "UserStatus": "FORCE_CHANGE_PASSWORD", "mfa": False}

    def admin_add_user_to_group(self, UserPoolId, Username, GroupName):
        self.u[Username]["grupos"].add(GroupName)

    def admin_remove_user_from_group(self, UserPoolId, Username, GroupName):
        self.u[Username]["grupos"].discard(GroupName)

    def admin_update_user_attributes(self, UserPoolId, Username, UserAttributes):
        self.u[Username]["attrs"].update({a["Name"]: a["Value"] for a in UserAttributes})

    def admin_disable_user(self, UserPoolId, Username):
        self.u[Username]["Enabled"] = False

    def admin_enable_user(self, UserPoolId, Username):
        self.u[Username]["Enabled"] = True

    def admin_user_global_sign_out(self, UserPoolId, Username):
        self.cerradas.append(Username)

    def admin_set_user_password(self, UserPoolId, Username, Password, Permanent):
        self.u[Username]["UserStatus"] = "CONFIRMED" if Permanent else "FORCE_CHANGE_PASSWORD"
        self.u[Username]["clave"] = Password

    def admin_set_user_mfa_preference(self, UserPoolId, Username, SoftwareTokenMfaSettings):
        self.u[Username]["mfa"] = SoftwareTokenMfaSettings["Enabled"]


GENERAL = {"usuario": "abraham", "grupo": "admin-general", "locales": ["local1", "local2"]}
PLANTA = {"usuario": "barbara", "grupo": "admin-sede", "locales": ["local1"]}
JEFE = {"usuario": "jefe.of", "grupo": "jefe", "locales": ["local2"]}


class TestUsuarios(unittest.TestCase):
    def setUp(self):
        self.c = CognitoFalso()
        self.audit = RepoMemoria()
        self.s = U.Usuarios(self.c, "pool", self.audit)

    def falla(self, http, f, *a):
        with self.assertRaises(U.ErrorUsuarios) as e:
            f(*a)
        self.assertEqual(e.exception.http, http)

    def test_listar_segun_rol(self):
        self.assertEqual(len(self.s.listar(GENERAL)), 5)
        self.assertEqual([u["usuario"] for u in self.s.listar(PLANTA)], ["barbara", "lisandra"])
        self.falla(403, self.s.listar, JEFE)
        self.assertNotIn("email", self.s.listar(GENERAL)[0])

    def test_crear_operario_y_auditar(self):
        u = self.s.crear(PLANTA, {"usuario": "Nuevo.Op", "email": "n@x.cl", "grupo": "operario", "sede": "planta"})
        self.assertEqual((u["usuario"], u["grupo"], u["sede"], u["estado"]), ("nuevo.op", "operario", "planta", "FORCE_CHANGE_PASSWORD"))
        reg = list(self.audit.items.values())[0]
        self.assertEqual((reg["sede"], reg["accion"], reg["objeto"]), ("local1", "usuario.creado", "nuevo.op"))
        self.assertNotIn("n@x.cl", reg["detalle"])

    def test_admin_sede_limites(self):
        self.falla(403, self.s.crear, PLANTA, {"usuario": "x.y", "email": "a@b.cl", "grupo": "operario", "sede": "oficinas"})
        self.falla(403, self.s.crear, PLANTA, {"usuario": "x.y", "email": "a@b.cl", "grupo": "admin-sede", "sede": "planta"})
        self.falla(403, self.s.desactivar, PLANTA, "jefe.of")  # otra sede
        self.falla(403, self.s.desactivar, PLANTA, "abraham")

    def test_grupo_y_sede_coherentes(self):
        self.falla(400, self.s.crear, GENERAL, {"usuario": "x.y", "email": "a@b.cl", "grupo": "operario", "sede": "todas"})
        self.falla(400, self.s.crear, GENERAL, {"usuario": "x.y", "email": "a@b.cl", "grupo": "admin-general", "sede": "planta"})
        self.falla(400, self.s.crear, GENERAL, {"usuario": "x.y", "email": "a@b.cl", "grupo": "root", "sede": "todas"})
        self.falla(400, self.s.crear, GENERAL, {"usuario": "x", "email": "a@b.cl", "grupo": "jefe", "sede": "todas"})
        self.falla(400, self.s.crear, GENERAL, {"usuario": "x.y", "email": "nocorreo", "grupo": "jefe", "sede": "todas"})
        self.falla(409, self.s.crear, GENERAL, {"usuario": "lisandra", "email": "a@b.cl", "grupo": "jefe", "sede": "todas"})

    def test_desactivar_cierra_sesion_y_activar(self):
        self.assertFalse(self.s.desactivar(PLANTA, "lisandra")["habilitado"])
        self.assertEqual(self.c.cerradas, ["lisandra"])
        self.assertTrue(self.s.activar(PLANTA, "lisandra")["habilitado"])
        acciones = [r["accion"] for r in sorted(self.audit.items.values(), key=lambda r: r["id"])]
        self.assertEqual(acciones, ["usuario.desactivado", "usuario.activado"])

    def test_no_a_si_mismo_y_ultimo_admin(self):
        self.falla(409, self.s.desactivar, GENERAL, "abraham")
        otro = {"usuario": "felipe", "grupo": "admin-general", "locales": ["local1", "local2"]}
        self.falla(409, self.s.desactivar, otro, "abraham")  # es el único admin-general activo
        self.c.u["felipe"] = {"attrs": {"custom:sede": "todas"}, "grupos": {"admin-general"}, "Enabled": True,
                              "UserStatus": "CONFIRMED", "mfa": True}
        self.assertFalse(self.s.desactivar(otro, "abraham")["habilitado"])

    def test_modificar_rol_y_sede(self):
        u = self.s.modificar(GENERAL, "lisandra", {"grupo": "jefe", "sede": "todas"})
        self.assertEqual((u["grupo"], u["sede"]), ("jefe", "todas"))
        self.assertEqual(self.c.u["lisandra"]["grupos"], {"jefe"})
        self.falla(409, self.s.modificar, PLANTA, "barbara", {"grupo": "jefe"})  # a sí mismo
        self.falla(403, self.s.modificar, PLANTA, "seba", {"grupo": "jefe"})  # otro admin
        self.falla(403, self.s.modificar, PLANTA, "jefe.of", {"sede": "planta"})

    def test_resetear_clave_y_mfa(self):
        r = self.s.resetear_clave(PLANTA, "lisandra")
        clave = r["clave_temporal"]
        self.assertEqual(self.c.u["lisandra"]["clave"], clave)
        self.assertEqual(r["estado"], "FORCE_CHANGE_PASSWORD")
        self.assertTrue(any(ch.isupper() for ch in clave) and any(ch.isdigit() for ch in clave) and len(clave) >= 12)
        self.assertFalse(any(clave in reg["detalle"] for reg in self.audit.items.values()))
        self.s.resetear_mfa(GENERAL, "jefe.of")
        self.assertFalse(self.c.u["jefe.of"]["mfa"])


if __name__ == "__main__":
    unittest.main()
