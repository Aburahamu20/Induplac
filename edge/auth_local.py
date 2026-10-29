"""
Login local del Edge (docs/api-dashboard.md §6.1 y §6.2): funciona con y sin internet.

  login --> [cambiar_clave] --> [registrar_mfa | codigo_mfa] --> token de 8 h

- Usuarios propios del Edge en SQLite (opción 1 del §6.3). Se crean con usuarios.py.
- Claves solo como hash scrypt; nadie puede verlas, ni el Administrador.
- MFA TOTP (RFC 6238, compatible con Microsoft Authenticator), obligatorio para quien
  tenga algún permiso de modificación. El secreto se guarda cifrado.
- Token y sesión temporal del desafío se guardan como hash SHA-256 (si se roba edge.db,
  no sirven para entrar).
- Bloqueo de la cuenta tras 5 intentos fallidos (clave o código MFA).

Solo usa la biblioteca estándar: corre igual en la Raspberry Pi que en Windows.
"""

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import struct
import time
from urllib.parse import quote

import config
import db

PERMISOS = [
    "ver_actual", "ver_alertas", "ver_historico", "ver_general",
    "reconocer_alertas", "modificar_umbrales", "gestionar_usuarios",
]
PERMISOS_MODIFICAR = {"reconocer_alertas", "modificar_umbrales", "gestionar_usuarios"}

# Plantillas por rol (§6.4); el Administrador las ajusta con --agregar / --quitar
ROLES = {
    "operario": ["ver_actual", "ver_alertas"],
    "jefe_mantenimiento_operaciones": ["ver_actual", "ver_alertas", "ver_historico", "ver_general", "reconocer_alertas"],
    "administrador": list(PERMISOS),
}
LOCALES_VALIDOS = ("local1", "local2")
CLAVE_MINIMA = 10
EMISOR_MFA = "Induplac Planta"  # nombre que se ve en Authenticator (distinto al de la nube, §6.2)
SCRYPT = {"n": 2**14, "r": 8, "p": 1}

db.ejecutar_script(
    """
    CREATE TABLE IF NOT EXISTS usuarios (
        usuario          TEXT PRIMARY KEY,     -- alias, nunca nombre ni RUT (Ley 19.628)
        clave_hash       TEXT NOT NULL,        -- scrypt$n$r$p$sal$hash
        clave_temporal   INTEGER NOT NULL DEFAULT 1,  -- 1 = debe cambiarla al entrar
        rol              TEXT NOT NULL,
        locales          TEXT NOT NULL,        -- JSON
        permisos         TEXT NOT NULL,        -- JSON
        mfa_secreto      TEXT,                 -- secreto TOTP cifrado; NULL = sin registrar
        mfa_ultimo_paso  INTEGER NOT NULL DEFAULT 0,  -- un código no se puede usar dos veces
        fallos           INTEGER NOT NULL DEFAULT 0,
        bloqueado_hasta  INTEGER NOT NULL DEFAULT 0,  -- segundos UTC
        creado_en        TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sesiones (
        token_hash TEXT PRIMARY KEY,           -- SHA-256 del token (el token no se guarda)
        usuario    TEXT NOT NULL,
        expira     INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS desafios (
        sesion_hash   TEXT PRIMARY KEY,        -- SHA-256 de la sesión temporal
        usuario       TEXT NOT NULL,
        tipo          TEXT NOT NULL,           -- cambiar_clave | registrar_mfa | codigo_mfa
        mfa_pendiente TEXT,                    -- secreto cifrado mientras se registra el MFA
        expira        INTEGER NOT NULL
    );
    """
)


class ErrorApi(Exception):
    """Error con el formato del contrato (§2): { "error": { "codigo", "mensaje" } }."""

    def __init__(self, http: int, codigo: str, mensaje: str):
        super().__init__(mensaje)
        self.http, self.codigo, self.mensaje = http, codigo, mensaje

    def cuerpo(self) -> dict:
        return {"error": {"codigo": self.codigo, "mensaje": self.mensaje}}


def _iso(ts: float) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(ts))


def _sha(texto: str) -> str:
    return hashlib.sha256(texto.encode()).hexdigest()


# ---------------- Claves (scrypt) ----------------

def hash_clave(clave: str) -> str:
    sal = os.urandom(16)
    h = hashlib.scrypt(clave.encode(), salt=sal, dklen=32, **SCRYPT)
    return f"scrypt${SCRYPT['n']}${SCRYPT['r']}${SCRYPT['p']}${sal.hex()}${h.hex()}"


def verificar_clave(clave: str, guardado: str) -> bool:
    _, n, r, p, sal, h = guardado.split("$")
    calculado = hashlib.scrypt(clave.encode(), salt=bytes.fromhex(sal), n=int(n), r=int(r), p=int(p), dklen=len(h) // 2)
    return hmac.compare_digest(calculado.hex(), h)


_hash_falso: str | None = None


def _hash_para_usuario_inexistente() -> str:
    """Se verifica igual contra algo: así no se puede saber por el tiempo si un usuario existe."""
    global _hash_falso
    if _hash_falso is None:
        _hash_falso = hash_clave(secrets.token_hex(16))
    return _hash_falso


def clave_temporal() -> str:
    alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"  # sin 0/O ni 1/l/I
    return "".join(secrets.choice(alfabeto) for _ in range(12))


# ---------------- Cifrado del secreto MFA ----------------
# Solo biblioteca estándar: flujo HMAC-SHA256 en modo contador + HMAC de integridad
# (cifrar y después autenticar). La clave maestra no vive en la base de datos.

_maestra: bytes | None = None


def _clave_maestra() -> bytes:
    global _maestra
    if _maestra is None:
        texto = os.environ.get("EDGE_CLAVE_MFA", "").strip()
        if not texto:
            archivo = config.CLAVE_MFA_ARCHIVO
            if not archivo.exists():
                archivo.write_text(base64.b64encode(os.urandom(32)).decode())
                try:
                    os.chmod(archivo, 0o600)
                except OSError:
                    pass
            texto = archivo.read_text().strip()
        _maestra = base64.b64decode(texto)
        if len(_maestra) < 32:
            raise RuntimeError("EDGE_CLAVE_MFA debe tener al menos 32 bytes en base64")
    return _maestra


def _subclaves() -> tuple[bytes, bytes]:
    m = _clave_maestra()
    return hmac.new(m, b"cifrar", hashlib.sha256).digest(), hmac.new(m, b"autenticar", hashlib.sha256).digest()


def _flujo(clave: bytes, nonce: bytes, largo: int) -> bytes:
    salida, i = b"", 0
    while len(salida) < largo:
        salida += hmac.new(clave, nonce + i.to_bytes(4, "big"), hashlib.sha256).digest()
        i += 1
    return salida[:largo]


def cifrar(texto: str) -> str:
    k_cifrar, k_auth = _subclaves()
    nonce, dato = os.urandom(16), texto.encode()
    cifrado = bytes(a ^ b for a, b in zip(dato, _flujo(k_cifrar, nonce, len(dato))))
    sello = hmac.new(k_auth, nonce + cifrado, hashlib.sha256).digest()
    return base64.b64encode(nonce + cifrado + sello).decode()


def descifrar(guardado: str) -> str:
    k_cifrar, k_auth = _subclaves()
    crudo = base64.b64decode(guardado)
    nonce, cifrado, sello = crudo[:16], crudo[16:-32], crudo[-32:]
    if not hmac.compare_digest(sello, hmac.new(k_auth, nonce + cifrado, hashlib.sha256).digest()):
        raise ValueError("Secreto MFA alterado o clave maestra distinta")
    return bytes(a ^ b for a, b in zip(cifrado, _flujo(k_cifrar, nonce, len(cifrado)))).decode()


# ---------------- TOTP (RFC 6238: SHA-1, 6 dígitos, 30 s) ----------------

def nuevo_secreto() -> str:
    return base64.b32encode(os.urandom(20)).decode().rstrip("=")


def _hotp(secreto: str, paso: int) -> str:
    clave = base64.b32decode(secreto + "=" * (-len(secreto) % 8))
    d = hmac.new(clave, struct.pack(">Q", paso), hashlib.sha1).digest()
    o = d[-1] & 0x0F
    return f"{(struct.unpack('>I', d[o:o + 4])[0] & 0x7FFFFFFF) % 1_000_000:06d}"


def totp(secreto: str, momento: float | None = None) -> str:
    return _hotp(secreto, int((time.time() if momento is None else momento) // 30))


def _paso_valido(secreto: str, codigo: str, ultimo_usado: int) -> int | None:
    """Acepta el código de ahora y el de ±30 s (reloj del celular desfasado), si no se usó antes."""
    actual = int(time.time() // 30)
    for paso in (actual - 1, actual, actual + 1):
        if paso > ultimo_usado and hmac.compare_digest(_hotp(secreto, paso), codigo):
            return paso
    return None


def qr_uri(usuario: str, secreto: str) -> str:
    etiqueta = quote(f"{EMISOR_MFA}:{usuario}")
    return f"otpauth://totp/{etiqueta}?secret={secreto}&issuer={quote(EMISOR_MFA)}&algorithm=SHA1&digits=6&period=30"


# ---------------- Usuarios ----------------

def requiere_mfa(permisos: list[str]) -> bool:
    return bool(PERMISOS_MODIFICAR & set(permisos))


def _usuario(nombre: str) -> dict | None:
    filas = db.consultar("SELECT * FROM usuarios WHERE usuario=?", (nombre,))
    if not filas:
        return None
    u = dict(filas[0])
    u["locales"], u["permisos"] = json.loads(u["locales"]), json.loads(u["permisos"])
    return u


def crear_usuario(usuario: str, rol: str, locales: list[str], permisos: list[str] | None = None) -> str:
    """Crea la cuenta con una clave temporal y la devuelve (se muestra una sola vez)."""
    usuario = usuario.strip().lower()
    if not re.fullmatch(r"[a-z0-9._-]{3,32}", usuario):
        raise ErrorApi(400, "USUARIO_INVALIDO", "Usuario de 3 a 32 caracteres: letras, números, punto, guion.")
    if rol not in ROLES:
        raise ErrorApi(400, "ROL_INVALIDO", f"Rol inválido. Opciones: {', '.join(ROLES)}")
    if not locales or any(l not in LOCALES_VALIDOS for l in locales):
        raise ErrorApi(400, "LOCAL_INVALIDO", f"Locales válidos: {', '.join(LOCALES_VALIDOS)}")
    permisos = ROLES[rol] if permisos is None else permisos
    if any(p not in PERMISOS for p in permisos):
        raise ErrorApi(400, "PERMISO_INVALIDO", f"Permisos válidos: {', '.join(PERMISOS)}")
    if _usuario(usuario):
        raise ErrorApi(409, "USUARIO_EXISTE", f"El usuario {usuario} ya existe.")
    temporal = clave_temporal()
    db.ejecutar(
        "INSERT INTO usuarios (usuario, clave_hash, rol, locales, permisos, creado_en) VALUES (?,?,?,?,?,?)",
        (usuario, hash_clave(temporal), rol, json.dumps(sorted(set(locales))),
         json.dumps([p for p in PERMISOS if p in permisos]), _iso(time.time())),
    )
    return temporal


def resetear_clave(usuario: str) -> str:
    """Clave olvidada: nueva clave temporal, desbloquea la cuenta y cierra sus sesiones."""
    temporal = clave_temporal()
    cur = db.ejecutar(
        "UPDATE usuarios SET clave_hash=?, clave_temporal=1, fallos=0, bloqueado_hasta=0 WHERE usuario=?",
        (hash_clave(temporal), usuario),
    )
    if cur.rowcount == 0:
        raise ErrorApi(404, "USUARIO_NO_EXISTE", f"No existe el usuario {usuario}.")
    cerrar_sesiones(usuario)
    return temporal


def resetear_mfa(usuario: str) -> None:
    """Celular perdido: borra el secreto; lo registra de nuevo en su próximo inicio de sesión."""
    cur = db.ejecutar("UPDATE usuarios SET mfa_secreto=NULL, mfa_ultimo_paso=0 WHERE usuario=?", (usuario,))
    if cur.rowcount == 0:
        raise ErrorApi(404, "USUARIO_NO_EXISTE", f"No existe el usuario {usuario}.")
    cerrar_sesiones(usuario)


def listar() -> list[dict]:
    ahora = int(time.time())
    salida = []
    for f in db.consultar("SELECT * FROM usuarios ORDER BY usuario"):
        salida.append({
            "usuario": f["usuario"],
            "rol": f["rol"],
            "locales": json.loads(f["locales"]),
            "permisos": json.loads(f["permisos"]),
            "mfa": f["mfa_secreto"] is not None,
            "clave_temporal": bool(f["clave_temporal"]),
            "bloqueado": f["bloqueado_hasta"] > ahora,
        })
    return salida


def cerrar_sesiones(usuario: str) -> None:
    db.ejecutar("DELETE FROM sesiones WHERE usuario=?", (usuario,))
    db.ejecutar("DELETE FROM desafios WHERE usuario=?", (usuario,))


# ---------------- Intentos fallidos ----------------

def _revisar_bloqueo(u: dict) -> None:
    if u["bloqueado_hasta"] > time.time():
        raise ErrorApi(403, "CUENTA_BLOQUEADA",
                       f"Cuenta bloqueada por {config.INTENTOS_BLOQUEO} intentos fallidos. "
                       f"Espera {int(config.BLOQUEO_MIN)} min o pide al Administrador que resetee la clave.")


def _fallo(u: dict) -> None:
    fallos = u["fallos"] + 1
    if fallos >= config.INTENTOS_BLOQUEO:
        db.ejecutar("UPDATE usuarios SET fallos=0, bloqueado_hasta=? WHERE usuario=?",
                    (int(time.time() + config.BLOQUEO_MIN * 60), u["usuario"]))
        db.ejecutar("DELETE FROM desafios WHERE usuario=?", (u["usuario"],))
    else:
        db.ejecutar("UPDATE usuarios SET fallos=? WHERE usuario=?", (fallos, u["usuario"]))


def _sin_fallos(usuario: str) -> None:
    db.ejecutar("UPDATE usuarios SET fallos=0 WHERE usuario=?", (usuario,))


# ---------------- Flujo de inicio de sesión (§6.2) ----------------

def _siguiente_paso(u: dict) -> dict:
    if u["clave_temporal"]:
        return _desafio(u, "cambiar_clave")
    if requiere_mfa(u["permisos"]):
        return _desafio(u, "codigo_mfa" if u["mfa_secreto"] else "registrar_mfa")
    return _emitir_token(u)


def _desafio(u: dict, tipo: str) -> dict:
    ahora = int(time.time())
    sesion = secrets.token_urlsafe(32)
    db.ejecutar("DELETE FROM desafios WHERE expira<=? OR usuario=?", (ahora, u["usuario"]))
    db.ejecutar("INSERT INTO desafios (sesion_hash, usuario, tipo, expira) VALUES (?,?,?,?)",
                (_sha(sesion), u["usuario"], tipo, ahora + config.DESAFIO_SEG))
    return {"desafio": tipo, "sesion": sesion}


def _tomar_desafio(sesion: str, tipos: set[str]) -> tuple[dict, dict]:
    filas = db.consultar("SELECT * FROM desafios WHERE sesion_hash=? AND expira>?", (_sha(sesion), int(time.time())))
    u = _usuario(filas[0]["usuario"]) if filas else None
    if not filas or filas[0]["tipo"] not in tipos or not u:
        raise ErrorApi(401, "SESION_INVALIDA", "La sesión temporal expiró o no corresponde. Vuelve a iniciar sesión.")
    _revisar_bloqueo(u)
    return dict(filas[0]), u


def login(usuario: str, clave: str) -> dict:
    u = _usuario(usuario.strip().lower())
    if u:
        _revisar_bloqueo(u)
    if not verificar_clave(clave, u["clave_hash"] if u else _hash_para_usuario_inexistente()) or not u:
        if u:
            _fallo(u)
        raise ErrorApi(401, "CREDENCIALES", "Usuario o clave incorrectos.")
    _sin_fallos(u["usuario"])
    return _siguiente_paso(u)


def cambiar_clave(sesion: str, clave_nueva: str) -> dict:
    d, u = _tomar_desafio(sesion, {"cambiar_clave"})
    if len(clave_nueva) < CLAVE_MINIMA:
        raise ErrorApi(400, "CLAVE_DEBIL", f"La clave debe tener al menos {CLAVE_MINIMA} caracteres.")
    if verificar_clave(clave_nueva, u["clave_hash"]):
        raise ErrorApi(400, "CLAVE_REPETIDA", "La clave nueva debe ser distinta a la temporal.")
    db.ejecutar("UPDATE usuarios SET clave_hash=?, clave_temporal=0 WHERE usuario=?", (hash_clave(clave_nueva), u["usuario"]))
    db.ejecutar("DELETE FROM desafios WHERE sesion_hash=?", (d["sesion_hash"],))
    return _siguiente_paso(_usuario(u["usuario"]))


def registrar_mfa(sesion: str) -> dict:
    d, u = _tomar_desafio(sesion, {"registrar_mfa"})
    secreto = nuevo_secreto()
    db.ejecutar("UPDATE desafios SET mfa_pendiente=? WHERE sesion_hash=?", (cifrar(secreto), d["sesion_hash"]))
    return {"qr_uri": qr_uri(u["usuario"], secreto)}


def verificar_mfa(sesion: str, codigo: str) -> dict:
    d, u = _tomar_desafio(sesion, {"registrar_mfa", "codigo_mfa"})
    codigo = codigo.strip().replace(" ", "")
    if not re.fullmatch(r"\d{6}", codigo):
        raise ErrorApi(400, "CODIGO_INVALIDO", "El código tiene 6 dígitos.")
    if d["tipo"] == "registrar_mfa":
        if not d["mfa_pendiente"]:
            raise ErrorApi(400, "MFA_SIN_QR", "Primero pide el código QR para registrar el MFA.")
        guardado, ultimo = d["mfa_pendiente"], 0
    else:
        guardado, ultimo = u["mfa_secreto"], u["mfa_ultimo_paso"]
    paso = _paso_valido(descifrar(guardado), codigo, ultimo)
    if paso is None:
        _fallo(u)
        raise ErrorApi(401, "CODIGO_INCORRECTO", "Código MFA incorrecto o ya usado.")
    db.ejecutar("UPDATE usuarios SET mfa_secreto=?, mfa_ultimo_paso=?, fallos=0 WHERE usuario=?",
                (guardado, paso, u["usuario"]))
    db.ejecutar("DELETE FROM desafios WHERE sesion_hash=?", (d["sesion_hash"],))
    return _emitir_token(_usuario(u["usuario"]))


# ---------------- Token de sesión ----------------

def _datos_sesion(u: dict, expira: int) -> dict:
    return {"usuario": u["usuario"], "rol": u["rol"], "locales": u["locales"], "permisos": u["permisos"], "expira": _iso(expira)}


def _emitir_token(u: dict) -> dict:
    ahora = int(time.time())
    token = secrets.token_urlsafe(32)
    expira = ahora + int(config.SESION_HORAS * 3600)
    db.ejecutar("DELETE FROM sesiones WHERE expira<=?", (ahora,))
    db.ejecutar("INSERT INTO sesiones (token_hash, usuario, expira) VALUES (?,?,?)", (_sha(token), u["usuario"], expira))
    return {"token": token, **_datos_sesion(u, expira)}


def validar_token(token: str) -> dict:
    """Devuelve usuario, rol, locales, permisos y expira; 401 si el token no sirve."""
    filas = db.consultar("SELECT usuario, expira FROM sesiones WHERE token_hash=? AND expira>?", (_sha(token), int(time.time())))
    u = _usuario(filas[0]["usuario"]) if filas else None
    if not u:
        raise ErrorApi(401, "NO_AUTENTICADO", "La sesión expiró o no es válida. Inicia sesión.")
    return _datos_sesion(u, filas[0]["expira"])


def logout(token: str) -> None:
    db.ejecutar("DELETE FROM sesiones WHERE token_hash=?", (_sha(token),))
