"""
Edge Gateway de Induplac IoT (tarea 4).

  ESP32 --MQTT--> broker --MQTT--> [este programa] --HTTPS--> AWS
                                        |
                                        +--> SQLite (crudo, intervalos, alertas)

Capas:
  1. Escucha el broker, valida y guarda cada lectura en SQLite.
  2. Cierra intervalos de 15 min y evalúa alertas locales.
  3. Sincroniza con AWS; sin internet encola y sube después.
  4. API local + dashboard de planta en un hilo aparte (api_local.py).

Uso (desde la carpeta edge/):  py edge_gateway.py
"""

import json
import logging
import signal
import sys
import threading
import time

import paho.mqtt.client as mqtt

import api_local
import config
import db
import reglas
from sincronizacion import Enlace

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-7s %(name)s: %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("edge")

enlace = Enlace()
_parar = threading.Event()
_ultimo_aviso: dict[str, float] = {}


# ---------------- Capa 1: MQTT -> SQLite ----------------

def al_conectar(cliente, _userdata, _flags, codigo, _props=None):
    if codigo != 0 and str(codigo) != "Success":
        log.error("El broker rechazó la conexión: %s", codigo)
        return
    # Se suscribe en CADA conexión: si el broker nos desconecta, al volver recupera la suscripción
    cliente.subscribe(config.TOPIC_SUSCRIPCION, qos=1)
    log.info("Conectado al broker y suscrito a %s", config.TOPIC_SUSCRIPCION)


def al_desconectar(_cliente, _userdata, *args):
    log.warning("Desconectado del broker; paho reintenta solo.")


def al_recibir(_cliente, _userdata, msg):
    partes = msg.topic.split("/")
    if len(partes) != 3 or partes[2] != "telemetria" or partes[1] not in config.LOCALES:
        log.warning("Topic ignorado: %r", msg.topic)
        return
    local = partes[1]
    try:
        datos = json.loads(msg.payload.decode())
    except (UnicodeDecodeError, json.JSONDecodeError):
        log.warning("%s: mensaje que no es JSON, descartado", local)
        return

    motivo = reglas.validar(datos)
    if motivo:
        log.warning("%s: lectura rechazada (%s)", local, motivo)
        return

    ts = reglas.hora_lectura(datos, int(time.time()))
    if not db.guardar_lectura(local, datos["device_id"], datos["seq"], ts, datos):
        log.info("%s: lectura duplicada seq=%s descartada", local, datos["seq"])
        return
    if isinstance(datos.get("personal_activo"), (int, float)):
        db.sumar_hh(local, ts, datos["personal_activo"])

    # Una línea por local cada ~30 s para no llenar la consola
    if time.time() - _ultimo_aviso.get(local, 0) > 30:
        _ultimo_aviso[local] = time.time()
        log.info("%s: lectura seq=%s · %.1f kW · agua %s m³/h · UV %s", local, datos["seq"], datos.get("energia_kw", 0),
                 datos.get("agua_m3h", "-"), datos.get("uv_index", "-"))


def conectar_broker() -> mqtt.Client:
    protocolo = mqtt.MQTTv5 if config.MQTT_VERSION == "5" else mqtt.MQTTv311
    cliente = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=config.MQTT_CLIENT_ID, protocol=protocolo)
    cliente.username_pw_set(config.MQTT_USUARIO, config.MQTT_CLAVE)
    if config.MQTT_TLS:
        cliente.tls_set(ca_certs=config.MQTT_CA or None)
    cliente.on_connect = al_conectar
    cliente.on_disconnect = al_desconectar
    cliente.on_message = al_recibir
    cliente.reconnect_delay_set(min_delay=1, max_delay=30)
    cliente.connect_async(config.MQTT_HOST, config.MQTT_PORT, keepalive=60)
    cliente.loop_start()
    return cliente


# ---------------- Capa 2: intervalos y alertas ----------------

def cerrar_intervalos() -> dict[str, dict]:
    """Cierra los intervalos terminados y devuelve el intervalo en curso de cada local."""
    ahora = int(time.time())
    actual = reglas.inicio_de(ahora)
    abiertos = {}
    for local in config.LOCALES:
        for inicio in db.inicios_con_lecturas(local, actual - 2 * 86400, actual):
            iso = reglas.iso(inicio)
            if db.intervalo_existe(local, iso):
                continue
            r = reglas.calcular_intervalo(local, inicio)
            if r:
                db.guardar_intervalo(local, iso, r)
                log.info("%s: intervalo %s cerrado (%d lecturas, %.1f kW prom.)", local, iso, r["lecturas"], r.get("energia_kw", 0))
                revisar_alertas(local, r)
        abierto = reglas.calcular_intervalo(local, actual)
        if abierto:
            abiertos[local] = abierto
            revisar_alertas(local, abierto)
    return abiertos


def revisar_alertas(local: str, r: dict) -> None:
    for a in reglas.evaluar(local, r):
        if db.guardar_alerta(a):
            log.warning("🚨 ALERTA %s: %s (valor %s, umbral %s)", local, a["regla"], a["valor"], a["umbral"])


# ---------------- Bucle principal ----------------

def estado_resumido() -> str:
    pend = sum(db.contar_pendientes(l) for l in config.LOCALES)
    return f"enlace={enlace.estado} pendientes={pend}"


def main():
    faltan = [n for n in ("MQTT_HOST", "MQTT_USUARIO", "MQTT_CLAVE") if not getattr(config, n)]
    if faltan:
        sys.exit(f"Falta configurar {', '.join(faltan)} en edge/.env (copia .env.example)")
    if not config.AWS_API_URL:
        log.warning("AWS_API_URL vacío: el Edge funcionará solo en modo local (todo queda pendiente)")

    signal.signal(signal.SIGINT, lambda *_: _parar.set())
    cliente = conectar_broker()
    proxima_sync = proximo_health = proximo_resumen = 0.0
    abiertos: dict[str, dict] = {}

    # Capa 4: la API comparte el mismo Enlace (estado y demo) y ve el intervalo en curso
    try:
        api_local.iniciar(enlace, lambda: abiertos)
    except OSError as e:
        log.error("No se pudo abrir la API local en el puerto %s (%s); el Edge sigue sin ella.", config.API_PORT, e)

    log.info("Edge iniciado · locales %s · base %s", ",".join(config.LOCALES), config.DB.name)
    while not _parar.is_set():
        ahora = time.time()
        abiertos = cerrar_intervalos()
        if ahora >= proximo_health:
            enlace.revisar()
            proximo_health = ahora + config.HEALTH_SEG
        if ahora >= proxima_sync:
            enlace.sincronizar(abiertos)
            proxima_sync = ahora + config.SYNC_SEG
        if ahora >= proximo_resumen:
            log.info("Estado: %s", estado_resumido())
            db.purgar_crudas(int(ahora) - 30 * 86400)  # retención de 30 días
            proximo_resumen = ahora + 60
        _parar.wait(5)

    log.info("Deteniendo el Edge...")
    cliente.loop_stop()
    cliente.disconnect()


if __name__ == "__main__":
    main()
