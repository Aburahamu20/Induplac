"""
Administración de los usuarios del login de planta (docs/api-dashboard.md §6.1 y §6.4).

Uso (desde la carpeta edge/):
  py usuarios.py crear operario1 --rol operario --locales local1
  py usuarios.py crear jefe1 --rol jefe --locales local1,local2 --quitar ver_general
  py usuarios.py crear admin1 --rol administrador --locales local1,local2
  py usuarios.py resetear-clave jefe1     # clave olvidada: nueva clave temporal (y desbloquea)
  py usuarios.py resetear-mfa jefe1       # celular perdido: registra el MFA de nuevo al entrar
  py usuarios.py listar

Usuarios con alias, nunca con nombre ni RUT (Ley 19.628). La clave temporal se muestra una
sola vez: el usuario la cambia en su primer inicio de sesión y nadie más la vuelve a ver.
"""

import argparse
import sys

import auth_local
from auth_local import ErrorApi

ALIAS_ROL = {"jefe": "jefe_mantenimiento_operaciones", "admin": "administrador"}


def _lista(texto: str | None) -> list[str]:
    return [x.strip() for x in (texto or "").split(",") if x.strip()]


def _mostrar_temporal(usuario: str, temporal: str) -> None:
    print(f"Clave temporal de {usuario}: {temporal}")
    print("Entrégala al usuario; no se vuelve a mostrar. La cambia en su primer inicio de sesión.")


def crear(a) -> None:
    rol = ALIAS_ROL.get(a.rol, a.rol)
    if rol not in auth_local.ROLES:
        raise ErrorApi(400, "ROL_INVALIDO", f"Rol inválido. Opciones: {', '.join(auth_local.ROLES)} (o jefe, admin)")
    permisos = list(auth_local.ROLES[rol])
    permisos += [p for p in _lista(a.agregar) if p not in permisos]
    permisos = [p for p in permisos if p not in _lista(a.quitar)]
    temporal = auth_local.crear_usuario(a.usuario, rol, _lista(a.locales), permisos)
    print(f"Usuario {a.usuario.lower()} creado · rol {rol} · permisos: {', '.join(permisos) or '(ninguno)'}")
    if auth_local.requiere_mfa(permisos):
        print("Tiene permisos de modificación: registrará el MFA (Authenticator) en su primer inicio de sesión.")
    _mostrar_temporal(a.usuario.lower(), temporal)


def resetear_clave(a) -> None:
    _mostrar_temporal(a.usuario, auth_local.resetear_clave(a.usuario.lower()))


def resetear_mfa(a) -> None:
    auth_local.resetear_mfa(a.usuario.lower())
    print(f"MFA de {a.usuario} borrado: lo registra de nuevo en su próximo inicio de sesión.")


def listar(_a) -> None:
    filas = auth_local.listar()
    if not filas:
        print("No hay usuarios. Crea el primero con: py usuarios.py crear admin1 --rol administrador --locales local1,local2")
        return
    print(f"{'USUARIO':<16} {'ROL':<32} {'LOCALES':<15} {'MFA':<4} {'ESTADO':<16} PERMISOS")
    for u in filas:
        estado = "bloqueado" if u["bloqueado"] else "clave temporal" if u["clave_temporal"] else "activo"
        print(f"{u['usuario']:<16} {u['rol']:<32} {','.join(u['locales']):<15} {'sí' if u['mfa'] else 'no':<4} "
              f"{estado:<16} {', '.join(u['permisos'])}")


def main() -> None:
    p = argparse.ArgumentParser(description="Usuarios del login local del Edge")
    sub = p.add_subparsers(dest="comando", required=True)

    c = sub.add_parser("crear", help="crea un usuario con clave temporal")
    c.add_argument("usuario")
    c.add_argument("--rol", required=True, help="operario | jefe | administrador (plantilla de permisos)")
    c.add_argument("--locales", required=True, help="local1, local2 o local1,local2")
    c.add_argument("--agregar", help="permisos extra, separados por coma")
    c.add_argument("--quitar", help="permisos de la plantilla que no tendrá, separados por coma")
    c.set_defaults(fn=crear)

    for nombre, fn, ayuda in (("resetear-clave", resetear_clave, "nueva clave temporal (y desbloquea)"),
                              ("resetear-mfa", resetear_mfa, "obliga a registrar el MFA de nuevo")):
        s = sub.add_parser(nombre, help=ayuda)
        s.add_argument("usuario")
        s.set_defaults(fn=fn)

    sub.add_parser("listar", help="muestra los usuarios (sin claves)").set_defaults(fn=listar)

    a = p.parse_args()
    try:
        a.fn(a)
    except ErrorApi as e:
        sys.exit(f"Error: {e.mensaje}")


if __name__ == "__main__":
    main()
