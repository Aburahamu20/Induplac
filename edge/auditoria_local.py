"""
Auditoría local del Edge (tarea 29, Fase 4): quién hizo qué en la planta, también sin internet.

Igual que en la nube (backend/lambda_api/auditoria.py): los registros solo se
agregan y cada uno guarda el hash SHA-256 del anterior, así que si alguien borra
o cambia una fila de la base SQLite, `verificar()` lo detecta. Hay UNA cadena por
Edge (en la demo, un Edge atiende las dos sedes); cada registro dice de qué sede es.

Al volver internet, sincronizacion.py sube los pendientes a POST /auditoria/edge y
la nube los agrega a su propia cadena, con la hora y el hash originales del Edge.

El hash usa los MISMOS campos y el mismo formato que la nube, para que la nube
pueda comprobar que lo que llega es lo que el Edge guardó.
"""

import calendar
import hashlib
import json
import secrets
import threading
import time

import db

GENESIS = "0" * 64
CAMPOS = ("sede", "id", "ts", "usuario", "rol", "accion", "objeto", "detalle", "origen", "hash_anterior")
SEDES = ("local1", "local2", "general")

_lock = threading.Lock()

db.ejecutar_script(
    """
    CREATE TABLE IF NOT EXISTS auditoria_local (
        seq           INTEGER PRIMARY KEY AUTOINCREMENT,  -- orden de la cadena
        id            TEXT NOT NULL UNIQUE,               -- hora ISO + '#' + azar (igual que la nube)
        sede          TEXT NOT NULL,
        ts            TEXT NOT NULL,
        usuario       TEXT NOT NULL,                      -- alias, nunca nombre ni RUT (Ley 19.628)
        rol           TEXT NOT NULL,
        accion        TEXT NOT NULL,
        objeto        TEXT NOT NULL,
        detalle       TEXT NOT NULL,                      -- JSON
        origen        TEXT NOT NULL DEFAULT 'edge',
        hash_anterior TEXT NOT NULL,
        hash          TEXT NOT NULL,
        is_synced     INTEGER NOT NULL DEFAULT 0
    );
    -- Sin UPDATE ni DELETE desde la aplicación: solo se marca is_synced.
    CREATE TRIGGER IF NOT EXISTS auditoria_sin_borrar BEFORE DELETE ON auditoria_local
    BEGIN SELECT RAISE(ABORT, 'La auditoría no se borra'); END;
    CREATE TRIGGER IF NOT EXISTS auditoria_sin_editar BEFORE UPDATE OF
        id, sede, ts, usuario, rol, accion, objeto, detalle, origen, hash_anterior, hash ON auditoria_local
    BEGIN SELECT RAISE(ABORT, 'La auditoría no se edita'); END;
    """
)


def calcular_hash(reg: dict) -> str:
    base = json.dumps({c: reg.get(c) for c in CAMPOS}, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(base.encode("utf-8")).hexdigest()


def _iso_ms(t: float) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(t)) + f".{int(t * 1000) % 1000:03d}Z"


def registrar(sede: str, usuario: str, rol: str, accion: str, objeto: str, detalle: dict | None = None,
              ahora: float | None = None) -> dict:
    if sede not in SEDES:
        raise ValueError(f"Sede de auditoría inválida: {sede}")
    with _lock:  # una escritura a la vez: la cadena no se bifurca
        ultimo = db.consultar("SELECT id, ts, hash FROM auditoria_local ORDER BY seq DESC LIMIT 1")
        t = ahora if ahora is not None else time.time()
        ts = _iso_ms(t)
        if ultimo and ts <= ultimo[0]["ts"]:  # reloj atrasado o dos en el mismo ms: sigue el orden
            ts = _iso_ms(_leer(ultimo[0]["ts"]) + 0.001)
        reg = {
            "sede": sede, "id": f"{ts}#{secrets.token_hex(4)}", "ts": ts, "usuario": usuario, "rol": rol,
            "accion": accion, "objeto": objeto,
            "detalle": json.dumps(detalle or {}, sort_keys=True, ensure_ascii=False, default=str),
            "origen": "edge", "hash_anterior": ultimo[0]["hash"] if ultimo else GENESIS,
        }
        reg["hash"] = calcular_hash(reg)
        db.ejecutar(
            "INSERT INTO auditoria_local (id, sede, ts, usuario, rol, accion, objeto, detalle, origen, hash_anterior, hash) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            tuple(reg[c] for c in ("id", "sede", "ts", "usuario", "rol", "accion", "objeto", "detalle", "origen",
                                   "hash_anterior", "hash")),
        )
        return reg


def _leer(ts: str) -> float:
    base, ms = ts.rstrip("Z").split(".")
    return calendar.timegm(time.strptime(base, "%Y-%m-%dT%H:%M:%S")) + int(ms) / 1000


def _filas(sql: str, params=()) -> list[dict]:
    return [dict(f) for f in db.consultar(sql, params)]


def verificar() -> list[dict]:
    """Recorre toda la cadena local. Devuelve los problemas (vacía = íntegra)."""
    problemas, esperado = [], GENESIS
    for r in _filas("SELECT * FROM auditoria_local ORDER BY seq"):
        if calcular_hash(r) != r["hash"]:
            problemas.append({"id": r["id"], "tipo": "modificado", "mensaje": "El registro fue cambiado después de guardarse."})
        if r["hash_anterior"] != esperado:
            problemas.append({"id": r["id"], "tipo": "faltante", "mensaje": "Falta o se cambió el registro anterior a este."})
        esperado = r["hash"]
    return problemas


def pendientes(limite: int = 100) -> list[dict]:
    campos = ", ".join(CAMPOS + ("hash",))
    return _filas(f"SELECT {campos} FROM auditoria_local WHERE is_synced=0 ORDER BY seq LIMIT ?", (limite,))


def marcar(ids: list[str]) -> None:
    if ids:
        db.ejecutar(f"UPDATE auditoria_local SET is_synced=1 WHERE id IN ({','.join('?' * len(ids))})", ids)


def contar_pendientes() -> int:
    return db.consultar("SELECT COUNT(*) n FROM auditoria_local WHERE is_synced=0")[0]["n"]


def lista(sedes: list[str], desde: str | None = None, hasta: str | None = None, limite: int = 500) -> list[dict]:
    sql, p = f"SELECT * FROM auditoria_local WHERE sede IN ({','.join('?' * len(sedes))})", list(sedes)
    if desde:
        sql, p = sql + " AND ts >= ?", p + [desde]
    if hasta:
        sql, p = sql + " AND ts <= ?", p + [hasta]
    filas = _filas(sql + " ORDER BY seq DESC LIMIT ?", p + [limite])
    for f in filas:
        f["detalle"] = json.loads(f["detalle"])
        f["is_synced"] = bool(f["is_synced"])
    return filas
