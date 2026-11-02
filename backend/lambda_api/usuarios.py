"""
Administración de cuentas en Cognito desde la API (tarea 28, parte 2).

Reglas (CONTEXTO §4.8 y docs/api-dashboard.md §6.4):
  - Solo admins. admin-general maneja a todos; admin-sede solo jefes y
    operarios de SU sede (custom:sede igual a la suya).
  - Grupo y sede válidos juntos: admin-general -> todas; admin-sede -> planta u
    oficinas; jefe -> planta, oficinas o todas; operario -> planta u oficinas.
  - Nadie se desactiva ni se cambia el rol a sí mismo, y siempre queda al menos
    un admin-general activo.
  - Cada cambio queda en la auditoría, sin correos (Ley 19.628).
  - Cognito genera la clave temporal y la manda por correo al crear la cuenta.
    Al resetear, la API genera una clave temporal y se la muestra UNA vez al admin.

Este módulo recibe el cliente de Cognito como parámetro para poder probarlo sin
AWS (tests/test_usuarios.py).
"""

import re
import secrets
import string

import auditoria

GRUPOS = ("admin-general", "admin-sede", "jefe", "operario")
SEDES_VALIDAS = {
    "admin-general": {"todas"},
    "admin-sede": {"planta", "oficinas"},
    "jefe": {"planta", "oficinas", "todas"},
    "operario": {"planta", "oficinas"},
}
SEDE_AUDITORIA = {"planta": "local1", "oficinas": "local2", "todas": "general"}
ORDEN = ["admin-general", "administrador", "admin-sede", "jefe", "operario"]
RE_USUARIO = re.compile(r"^[a-z0-9][a-z0-9._-]{2,39}$")
RE_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class ErrorUsuarios(Exception):
    def __init__(self, codigo_http, codigo, mensaje):
        super().__init__(mensaje)
        self.http, self.codigo, self.mensaje = codigo_http, codigo, mensaje


def _no(mensaje):
    return ErrorUsuarios(403, "SIN_PERMISO", mensaje)


def clave_temporal(largo=14):
    """Cumple la política de Cognito: mayúscula, minúscula, número y símbolo."""
    simbolos = "!#$%&*+-=?@"
    base = [secrets.choice(string.ascii_uppercase), secrets.choice(string.ascii_lowercase),
            secrets.choice(string.digits), secrets.choice(simbolos)]
    todos = string.ascii_letters + string.digits + simbolos
    base += [secrets.choice(todos) for _ in range(largo - len(base))]
    secrets.SystemRandom().shuffle(base)
    return "".join(base)


class Usuarios:
    def __init__(self, cognito, pool_id, repo_auditoria):
        self.c = cognito
        self.pool = pool_id
        self.audit = repo_auditoria

    # ---------- lectura ----------

    def _grupo(self, usuario):
        r = self.c.admin_list_groups_for_user(UserPoolId=self.pool, Username=usuario)
        nombres = [g["GroupName"] for g in r.get("Groups", [])]
        return next((g for g in ORDEN if g in nombres), None)

    @staticmethod
    def _attrs(lista):
        return {a["Name"]: a["Value"] for a in lista or []}

    def _resumen(self, u, attrs_key="Attributes"):
        a = self._attrs(u.get(attrs_key) or u.get("UserAttributes"))
        nombre = u["Username"]
        return {
            "usuario": nombre,
            "grupo": self._grupo(nombre),
            "sede": a.get("custom:sede"),
            "habilitado": u.get("Enabled", True),
            "estado": u.get("UserStatus"),  # FORCE_CHANGE_PASSWORD = aún no entra por primera vez
            "creado": u.get("UserCreateDate").isoformat() if hasattr(u.get("UserCreateDate"), "isoformat") else u.get("UserCreateDate"),
        }

    def obtener(self, usuario):
        try:
            u = self.c.admin_get_user(UserPoolId=self.pool, Username=usuario)
        except self.c.exceptions.UserNotFoundException:
            raise ErrorUsuarios(404, "USUARIO_NO_EXISTE", "Usuario inexistente.")
        return self._resumen(u)

    def listar(self, quien):
        self._solo_admin(quien)
        salida, args = [], {"UserPoolId": self.pool, "Limit": 60}
        while True:
            r = self.c.list_users(**args)
            salida += [self._resumen(u) for u in r.get("Users", [])]
            if not r.get("PaginationToken"):
                break
            args["PaginationToken"] = r["PaginationToken"]
        visibles = [u for u in salida if self._puede_manejar(quien, u, solo_ver=True)]
        return sorted(visibles, key=lambda u: u["usuario"])

    # ---------- permisos ----------

    @staticmethod
    def _sede_de(quien):
        return {("local1",): "planta", ("local2",): "oficinas"}.get(tuple(quien["locales"]), "todas")

    def _solo_admin(self, quien):
        if quien["grupo"] not in ("admin-general", "administrador", "admin-sede"):
            raise _no("Solo los administradores manejan usuarios.")

    def _es_general(self, quien):
        return quien["grupo"] in ("admin-general", "administrador")

    def _puede_manejar(self, quien, objetivo, solo_ver=False):
        if self._es_general(quien):
            return True
        # admin-sede: jefes y operarios de su sede; ve también a los otros admins de su sede
        grupos_ok = ("jefe", "operario", "admin-sede") if solo_ver else ("jefe", "operario")
        return objetivo.get("grupo") in grupos_ok and objetivo.get("sede") == self._sede_de(quien)

    def _validar_destino(self, quien, grupo, sede):
        if grupo not in GRUPOS:
            raise ErrorUsuarios(400, "PARAMETROS", f"Grupo inválido: {grupo}")
        if sede not in SEDES_VALIDAS[grupo]:
            raise ErrorUsuarios(400, "PARAMETROS", f"La sede '{sede}' no corresponde al grupo {grupo}.")
        if not self._es_general(quien) and (grupo not in ("jefe", "operario") or sede != self._sede_de(quien)):
            raise _no("Un admin de sede solo crea jefes u operarios de su propia sede.")

    def _admins_generales_activos(self):
        r = self.c.list_users_in_group(UserPoolId=self.pool, GroupName="admin-general", Limit=60)
        return [u["Username"] for u in r.get("Users", []) if u.get("Enabled", True)]

    def _cuidar_ultimo_admin(self, objetivo):
        if objetivo["grupo"] == "admin-general" and len(self._admins_generales_activos()) <= 1:
            raise ErrorUsuarios(409, "ULTIMO_ADMIN", "Debe quedar al menos un admin general activo.")

    def _objetivo(self, quien, usuario, propio_ok=False):
        self._solo_admin(quien)
        if not propio_ok and usuario == quien["usuario"]:
            raise ErrorUsuarios(409, "NO_A_SI_MISMO", "No puedes hacer esto con tu propia cuenta.")
        o = self.obtener(usuario)
        if not self._puede_manejar(quien, o):
            raise _no("No puedes manejar esta cuenta.")
        return o

    def _auditar(self, quien, accion, objetivo, detalle):
        auditoria.registrar(self.audit, SEDE_AUDITORIA.get(objetivo.get("sede"), "general"),
                            quien["usuario"], quien["grupo"], accion, objetivo["usuario"], detalle)

    # ---------- acciones ----------

    def crear(self, quien, datos):
        self._solo_admin(quien)
        usuario = str(datos.get("usuario", "")).strip().lower()
        email = str(datos.get("email", "")).strip()
        grupo, sede = datos.get("grupo"), str(datos.get("sede", "")).strip().lower()
        if not RE_USUARIO.match(usuario):
            raise ErrorUsuarios(400, "PARAMETROS", "Usuario inválido: 3 a 40 caracteres, minúsculas, números, punto, guion.")
        if not RE_EMAIL.match(email):
            raise ErrorUsuarios(400, "PARAMETROS", "Correo inválido.")
        self._validar_destino(quien, grupo, sede)
        try:
            self.c.admin_create_user(
                UserPoolId=self.pool,
                Username=usuario,
                UserAttributes=[
                    {"Name": "email", "Value": email},
                    {"Name": "email_verified", "Value": "true"},
                    {"Name": "custom:sede", "Value": sede},
                ],
                DesiredDeliveryMediums=["EMAIL"],  # Cognito manda la clave temporal al correo
            )
        except self.c.exceptions.UsernameExistsException:
            raise ErrorUsuarios(409, "USUARIO_EXISTE", "Ese usuario ya existe.")
        self.c.admin_add_user_to_group(UserPoolId=self.pool, Username=usuario, GroupName=grupo)
        o = {"usuario": usuario, "grupo": grupo, "sede": sede}
        self._auditar(quien, "usuario.creado", o, {"grupo": grupo, "sede": sede})
        return self.obtener(usuario)

    def modificar(self, quien, usuario, datos):
        o = self._objetivo(quien, usuario)
        grupo = datos.get("grupo", o["grupo"])
        sede = str(datos.get("sede", o["sede"]) or "").strip().lower()
        self._validar_destino(quien, grupo, sede)
        if grupo != o["grupo"]:
            self._cuidar_ultimo_admin(o)
            if o["grupo"]:
                self.c.admin_remove_user_from_group(UserPoolId=self.pool, Username=usuario, GroupName=o["grupo"])
            self.c.admin_add_user_to_group(UserPoolId=self.pool, Username=usuario, GroupName=grupo)
        if sede != o["sede"]:
            self.c.admin_update_user_attributes(UserPoolId=self.pool, Username=usuario,
                                                UserAttributes=[{"Name": "custom:sede", "Value": sede}])
        self._auditar(quien, "usuario.modificado", {**o, "sede": sede},
                      {"antes": {"grupo": o["grupo"], "sede": o["sede"]}, "despues": {"grupo": grupo, "sede": sede}})
        return self.obtener(usuario)

    def desactivar(self, quien, usuario):
        o = self._objetivo(quien, usuario)
        self._cuidar_ultimo_admin(o)
        self.c.admin_disable_user(UserPoolId=self.pool, Username=usuario)
        self.c.admin_user_global_sign_out(UserPoolId=self.pool, Username=usuario)  # corta sesiones abiertas
        self._auditar(quien, "usuario.desactivado", o, {"grupo": o["grupo"]})
        return self.obtener(usuario)

    def activar(self, quien, usuario):
        o = self._objetivo(quien, usuario)
        self.c.admin_enable_user(UserPoolId=self.pool, Username=usuario)
        self._auditar(quien, "usuario.activado", o, {"grupo": o["grupo"]})
        return self.obtener(usuario)

    def resetear_clave(self, quien, usuario):
        o = self._objetivo(quien, usuario)
        clave = clave_temporal()
        self.c.admin_set_user_password(UserPoolId=self.pool, Username=usuario, Password=clave, Permanent=False)
        self._auditar(quien, "usuario.clave_reseteada", o, {})  # la clave nunca va a la auditoría
        return {**self.obtener(usuario), "clave_temporal": clave}

    def resetear_mfa(self, quien, usuario):
        o = self._objetivo(quien, usuario)
        self.c.admin_set_user_mfa_preference(UserPoolId=self.pool, Username=usuario,
                                             SoftwareTokenMfaSettings={"Enabled": False, "PreferredMfa": False})
        self._auditar(quien, "usuario.mfa_reseteado", o, {})
        return self.obtener(usuario)
