"""
Sincronización Edge -> AWS y máquina de estados del enlace (docs/modo-offline.md §6).

  ONLINE --3 fallos--> OFFLINE --health OK--> SINCRONIZANDO --pendientes = 0--> ONLINE

Nada se marca como sincronizado sin respuesta 200 de AWS.
"""

import json
import logging
import time
import urllib.error
import urllib.request

import config
import db

log = logging.getLogger("sync")


class Enlace:
    def __init__(self):
        self.estado = "offline"  # hasta el primer healthcheck exitoso
        self.fallos = 0
        self.ultima_sincronizacion: str | None = None

    # ---------- HTTP ----------

    def _pedir(self, metodo: str, ruta: str, cuerpo: dict | None = None) -> dict:
        datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
        req = urllib.request.Request(
            f"{config.AWS_API_URL}{ruta}",
            data=datos,
            method=metodo,
            headers={"Content-Type": "application/json", "x-induplac-key": config.CLAVE_INGESTA},
        )
        with urllib.request.urlopen(req, timeout=5) as r:
            return json.loads(r.read() or b"{}")

    # ---------- Healthcheck ----------

    def revisar(self) -> None:
        if not config.AWS_API_URL:
            self.estado = "offline"
            return
        try:
            self._pedir("GET", "/health")
            self.fallos = 0
            if self.estado == "offline":
                hay = any(db.contar_pendientes(l) for l in config.LOCALES)
                self._cambiar("sincronizando" if hay else "online")
        except (urllib.error.URLError, TimeoutError, OSError, ValueError) as e:
            self.fallos += 1
            if self.estado != "offline" and self.fallos >= config.FALLOS_PARA_OFFLINE:
                log.warning("Sin enlace con AWS (%s). Monitoreo y alertas locales activos.", e)
                self._cambiar("offline")

    def _cambiar(self, nuevo: str) -> None:
        if nuevo != self.estado:
            iconos = {"online": "🟢 ONLINE", "offline": "🔴 OFFLINE", "sincronizando": "🟡 SINCRONIZANDO"}
            log.info("Enlace: %s -> %s", iconos.get(self.estado, self.estado), iconos[nuevo])
            self.estado = nuevo

    # ---------- Envío ----------

    def sincronizar(self, intervalos_abiertos: dict[str, dict]) -> None:
        """Sube pendientes en lotes y, si hay enlace, el intervalo en curso (upsert, no se marca)."""
        if self.estado == "offline":
            return
        try:
            for local in config.LOCALES:
                # 1) Pendientes cerrados, en orden cronológico, de a LOTE
                while True:
                    lote = db.intervalos_pendientes(local, config.LOTE)
                    alertas = db.alertas_pendientes(local)
                    if not lote and not alertas:
                        break
                    cuerpo = {
                        "batch_id": f"{local}-{lote[0]['inicio_intervalo'] if lote else 'alertas'}",
                        "local_id": local,
                        "records": lote,
                        "alertas": [_alerta_para_nube(a) for a in alertas],
                    }
                    if not lote:  # la Lambda exige records: se manda el intervalo en curso
                        abierto = intervalos_abiertos.get(local)
                        if not abierto:
                            break
                        cuerpo["records"] = [abierto]
                    self._pedir("POST", "/intervalos", cuerpo)
                    db.marcar_intervalos(local, [r["inicio_intervalo"] for r in lote])
                    db.marcar_alertas([a["id"] for a in alertas])
                    if lote:
                        log.info("%s: %d intervalos sincronizados", local, len(lote))
                    if len(lote) < config.LOTE:
                        break

                # 2) Intervalo en curso: así gerencia ve datos casi en vivo (upsert idempotente)
                abierto = intervalos_abiertos.get(local)
                if abierto:
                    self._pedir("POST", "/intervalos", {"batch_id": f"{local}-vivo", "local_id": local, "records": [abierto]})

            self.ultima_sincronizacion = _ahora_iso()
            if self.estado == "sincronizando" and not any(db.contar_pendientes(l) for l in config.LOCALES):
                self._cambiar("online")
        except (urllib.error.URLError, TimeoutError, OSError, ValueError) as e:
            log.warning("Falló la sincronización (%s); se reintenta más tarde.", e)
            self.fallos += 1
            if self.fallos >= config.FALLOS_PARA_OFFLINE:
                self._cambiar("offline")


def _alerta_para_nube(a: dict) -> dict:
    return {k: a[k] for k in ("id", "variable", "valor", "umbral", "regla", "inicio_intervalo", "estado", "reconocida_en")}


def _ahora_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
