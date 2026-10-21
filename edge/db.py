"""
Base de datos local del Edge (SQLite). Tablas de docs/modo-offline.md §3.2:
  - lecturas_crudas:  cada lectura validada del ESP32 (retención 30 días)
  - intervalos_15min: intervalos cerrados, con is_synced
  - alertas_local:    alertas generadas por el Edge, con is_synced
  - contadores:       horas hombre acumuladas por local
"""

import json
import sqlite3
import threading

import config

_lock = threading.Lock()
_con = sqlite3.connect(config.DB, check_same_thread=False)
_con.row_factory = sqlite3.Row
_con.execute("PRAGMA journal_mode=WAL")

_con.executescript(
    """
    CREATE TABLE IF NOT EXISTS lecturas_crudas (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        local_id    TEXT NOT NULL,
        device_id   TEXT NOT NULL,
        seq         INTEGER NOT NULL,
        ts          INTEGER NOT NULL,          -- segundos UTC
        datos       TEXT NOT NULL,             -- JSON de la lectura
        -- Un reenvío del ring buffer trae el mismo seq Y el mismo ts -> se descarta.
        -- Si el ESP32 se reinicia, seq vuelve a 1 pero con otro ts -> se acepta.
        UNIQUE (device_id, seq, ts)
    );
    CREATE INDEX IF NOT EXISTS ix_crudas_local_ts ON lecturas_crudas (local_id, ts);

    CREATE TABLE IF NOT EXISTS intervalos_15min (
        local_id         TEXT NOT NULL,
        inicio_intervalo TEXT NOT NULL,        -- ISO UTC
        datos            TEXT NOT NULL,        -- JSON con el formato de ingesta
        is_synced        INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (local_id, inicio_intervalo)
    );

    CREATE TABLE IF NOT EXISTS alertas_local (
        id               TEXT PRIMARY KEY,     -- local:variable:inicio_intervalo
        local_id         TEXT NOT NULL,
        variable         TEXT NOT NULL,
        valor            REAL NOT NULL,
        umbral           REAL NOT NULL,
        regla            TEXT NOT NULL,
        inicio_intervalo TEXT NOT NULL,
        estado           TEXT NOT NULL DEFAULT 'activa',
        reconocida_en    TEXT,
        is_synced        INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS contadores (
        local_id  TEXT PRIMARY KEY,
        hh        REAL NOT NULL DEFAULT 0,
        ultimo_ts INTEGER
    );

    -- HH estimadas antes de que el Edge midiera (se calculan una vez por incidente)
    CREATE TABLE IF NOT EXISTS hh_historicas (
        local_id      TEXT PRIMARY KEY,
        fecha_inicio  TEXT NOT NULL,           -- fecha del último incidente (YYYY-MM-DD)
        hh            REAL NOT NULL,
        calculado_ts  INTEGER NOT NULL
    );
    """
)
_con.commit()

# Migración: las bases creadas antes tenían UNIQUE (device_id, seq), que descartaba las
# lecturas de un ESP32 recién reiniciado. Se reconstruye la tabla conservando los datos.
_sql = _con.execute("SELECT sql FROM sqlite_master WHERE name='lecturas_crudas'").fetchone()[0]
if "UNIQUE (device_id, seq)" in _sql:
    _con.executescript(
        """
        BEGIN;
        ALTER TABLE lecturas_crudas RENAME TO lecturas_crudas_v1;
        CREATE TABLE lecturas_crudas (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            local_id    TEXT NOT NULL,
            device_id   TEXT NOT NULL,
            seq         INTEGER NOT NULL,
            ts          INTEGER NOT NULL,
            datos       TEXT NOT NULL,
            UNIQUE (device_id, seq, ts)
        );
        INSERT INTO lecturas_crudas SELECT * FROM lecturas_crudas_v1;
        DROP TABLE lecturas_crudas_v1;
        DROP INDEX IF EXISTS ix_crudas_local_ts;
        CREATE INDEX ix_crudas_local_ts ON lecturas_crudas (local_id, ts);
        COMMIT;
        """
    )


def ejecutar(sql: str, params=()):
    with _lock:
        cur = _con.execute(sql, params)
        _con.commit()
        return cur


def consultar(sql: str, params=()) -> list[sqlite3.Row]:
    with _lock:
        return _con.execute(sql, params).fetchall()


# ---------- Lecturas ----------

def guardar_lectura(local_id: str, device_id: str, seq: int, ts: int, datos: dict) -> bool:
    """Devuelve False si la lectura ya existía (duplicado por device_id + seq + ts)."""
    with _lock:
        cur = _con.execute(
            "INSERT OR IGNORE INTO lecturas_crudas (local_id, device_id, seq, ts, datos) VALUES (?,?,?,?,?)",
            (local_id, device_id, seq, ts, json.dumps(datos)),
        )
        _con.commit()
        return cur.rowcount == 1


def lecturas_entre(local_id: str, desde: int, hasta: int) -> list[dict]:
    filas = consultar(
        "SELECT ts, datos FROM lecturas_crudas WHERE local_id=? AND ts>=? AND ts<? ORDER BY ts",
        (local_id, desde, hasta),
    )
    return [{"ts": f["ts"], **json.loads(f["datos"])} for f in filas]


def inicios_con_lecturas(local_id: str, desde: int, hasta: int) -> list[int]:
    filas = consultar(
        "SELECT DISTINCT (ts / ?) * ? AS inicio FROM lecturas_crudas WHERE local_id=? AND ts>=? AND ts<? ORDER BY inicio",
        (config.INTERVALO_SEG, config.INTERVALO_SEG, local_id, desde, hasta),
    )
    return [f["inicio"] for f in filas]


def ultima_lectura(local_id: str) -> dict | None:
    filas = consultar("SELECT ts, datos FROM lecturas_crudas WHERE local_id=? ORDER BY ts DESC LIMIT 1", (local_id,))
    return {"ts": filas[0]["ts"], **json.loads(filas[0]["datos"])} if filas else None


def purgar_crudas(antes_de: int) -> None:
    ejecutar("DELETE FROM lecturas_crudas WHERE ts < ?", (antes_de,))


# ---------- Contadores de horas hombre ----------

def sumar_hh(local_id: str, ts: int, personas: float) -> float:
    with _lock:
        fila = _con.execute("SELECT hh, ultimo_ts FROM contadores WHERE local_id=?", (local_id,)).fetchone()
        hh, ultimo = (fila["hh"], fila["ultimo_ts"]) if fila else (0.0, None)
        # Solo suma huecos cortos: si el ESP32 estuvo caído no se inventan horas
        if ultimo is not None and 0 < ts - ultimo <= 60:
            hh += personas * (ts - ultimo) / 3600
        _con.execute(
            "INSERT INTO contadores (local_id, hh, ultimo_ts) VALUES (?,?,?) "
            "ON CONFLICT(local_id) DO UPDATE SET hh=excluded.hh, ultimo_ts=excluded.ultimo_ts",
            (local_id, hh, ts),
        )
        _con.commit()
        return hh


def hh_historicas(local_id: str) -> dict | None:
    filas = consultar("SELECT fecha_inicio, hh FROM hh_historicas WHERE local_id=?", (local_id,))
    return dict(filas[0]) if filas else None


def guardar_hh_historicas(local_id: str, fecha_inicio: str, hh: float, ts: int) -> None:
    ejecutar(
        "INSERT INTO hh_historicas (local_id, fecha_inicio, hh, calculado_ts) VALUES (?,?,?,?) "
        "ON CONFLICT(local_id) DO UPDATE SET fecha_inicio=excluded.fecha_inicio, hh=excluded.hh, calculado_ts=excluded.calculado_ts",
        (local_id, fecha_inicio, hh, ts),
    )


def reiniciar_hh_medidas(local_id: str) -> None:
    """Nuevo incidente: las HH medidas vuelven a cero."""
    ejecutar("UPDATE contadores SET hh=0 WHERE local_id=?", (local_id,))


def hh_actual(local_id: str) -> float:
    filas = consultar("SELECT hh FROM contadores WHERE local_id=?", (local_id,))
    return filas[0]["hh"] if filas else 0.0


# ---------- Intervalos ----------

def intervalo_existe(local_id: str, inicio: str) -> bool:
    return bool(consultar("SELECT 1 FROM intervalos_15min WHERE local_id=? AND inicio_intervalo=?", (local_id, inicio)))


def guardar_intervalo(local_id: str, inicio: str, datos: dict) -> None:
    ejecutar(
        "INSERT OR REPLACE INTO intervalos_15min (local_id, inicio_intervalo, datos, is_synced) VALUES (?,?,?,0)",
        (local_id, inicio, json.dumps(datos)),
    )


def intervalo(local_id: str, inicio: str) -> dict | None:
    filas = consultar("SELECT datos FROM intervalos_15min WHERE local_id=? AND inicio_intervalo=?", (local_id, inicio))
    return json.loads(filas[0]["datos"]) if filas else None


def intervalos_desde(local_id: str, desde: str) -> list[dict]:
    filas = consultar(
        "SELECT datos FROM intervalos_15min WHERE local_id=? AND inicio_intervalo>=? ORDER BY inicio_intervalo",
        (local_id, desde),
    )
    return [json.loads(f["datos"]) for f in filas]


def intervalos_pendientes(local_id: str, limite: int) -> list[dict]:
    filas = consultar(
        "SELECT datos FROM intervalos_15min WHERE local_id=? AND is_synced=0 ORDER BY inicio_intervalo LIMIT ?",
        (local_id, limite),
    )
    return [json.loads(f["datos"]) for f in filas]


def marcar_intervalos(local_id: str, inicios: list[str]) -> None:
    if inicios:
        marcas = ",".join("?" * len(inicios))
        ejecutar(
            f"UPDATE intervalos_15min SET is_synced=1 WHERE local_id=? AND inicio_intervalo IN ({marcas})",
            (local_id, *inicios),
        )


# ---------- Alertas ----------

def guardar_alerta(a: dict) -> bool:
    """Upsert por id. Devuelve True si la alerta es nueva."""
    with _lock:
        existe = _con.execute("SELECT 1 FROM alertas_local WHERE id=?", (a["id"],)).fetchone()
        if existe:
            _con.execute(
                "UPDATE alertas_local SET valor=?, umbral=?, regla=? WHERE id=?",
                (a["valor"], a["umbral"], a["regla"], a["id"]),
            )
        else:
            _con.execute(
                "INSERT INTO alertas_local (id, local_id, variable, valor, umbral, regla, inicio_intervalo) "
                "VALUES (:id, :local_id, :variable, :valor, :umbral, :regla, :inicio_intervalo)",
                a,
            )
        _con.commit()
        return not existe


def alertas(local_id: str | None = None, estado: str | None = None) -> list[dict]:
    sql, p = "SELECT * FROM alertas_local WHERE 1=1", []
    if local_id:
        sql, p = sql + " AND local_id=?", p + [local_id]
    if estado:
        sql, p = sql + " AND estado=?", p + [estado]
    return [dict(f) for f in consultar(sql + " ORDER BY inicio_intervalo DESC", p)]


def alertas_pendientes(local_id: str) -> list[dict]:
    return [dict(f) for f in consultar("SELECT * FROM alertas_local WHERE local_id=? AND is_synced=0", (local_id,))]


def marcar_alertas(ids: list[str]) -> None:
    if ids:
        ejecutar(f"UPDATE alertas_local SET is_synced=1 WHERE id IN ({','.join('?' * len(ids))})", ids)


def contar_pendientes(local_id: str) -> int:
    a = consultar("SELECT COUNT(*) n FROM intervalos_15min WHERE local_id=? AND is_synced=0", (local_id,))[0]["n"]
    b = consultar("SELECT COUNT(*) n FROM alertas_local WHERE local_id=? AND is_synced=0", (local_id,))[0]["n"]
    return a + b
