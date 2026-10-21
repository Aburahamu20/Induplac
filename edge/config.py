"""
Configuración del Edge, leída desde edge/.env (nunca se sube al repo).
Ver edge/.env.example para la lista completa.
"""

import os
from pathlib import Path


def _cargar_env(ruta: Path) -> None:
    """Lee un archivo .env simple (CLAVE=valor) sin depender de librerías externas."""
    if not ruta.exists():
        return
    for linea in ruta.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#") or "=" not in linea:
            continue
        clave, valor = linea.split("=", 1)
        os.environ.setdefault(clave.strip(), valor.strip().strip('"').strip("'"))


CARPETA = Path(__file__).resolve().parent
_cargar_env(CARPETA / ".env")


def _num(nombre: str, defecto: float) -> float:
    try:
        return float(os.environ.get(nombre, defecto))
    except ValueError:
        return defecto


# ---- Broker MQTT ----
MQTT_HOST = os.environ.get("MQTT_HOST", "")
MQTT_PORT = int(_num("MQTT_PORT", 8883))
MQTT_TLS = os.environ.get("MQTT_TLS", "1") == "1"
MQTT_CA = os.environ.get("MQTT_CA", "")  # opcional: ruta al certificado CA del broker
MQTT_VERSION = os.environ.get("MQTT_VERSION", "5")  # 5 | 3.1.1
MQTT_USUARIO = os.environ.get("MQTT_USUARIO", "")
MQTT_CLAVE = os.environ.get("MQTT_CLAVE", "")
MQTT_CLIENT_ID = os.environ.get("MQTT_CLIENT_ID", "edge-local-01")
# Topics constantes (lección de la prueba: nada de topics armados a mano)
TOPIC_SUSCRIPCION = "induplac/+/telemetria"

# ---- AWS ----
AWS_API_URL = os.environ.get("AWS_API_URL", "").rstrip("/")
CLAVE_INGESTA = os.environ.get("CLAVE_INGESTA", "")

# ---- Funcionamiento ----
# En la demo un solo Edge atiende las dos sedes; en el diseño hay uno por sede.
LOCALES = [l.strip() for l in os.environ.get("LOCALES", "local1,local2").split(",") if l.strip()]
DB = CARPETA / os.environ.get("DB", "edge.db")
SYNC_SEG = _num("SYNC_SEG", 30)          # cada cuánto se intenta sincronizar con AWS
HEALTH_SEG = _num("HEALTH_SEG", 10)      # cada cuánto se revisa el enlace (modo-offline.md §6.2)
FALLOS_PARA_OFFLINE = int(_num("FALLOS_PARA_OFFLINE", 3))
LOTE = 50                                # intervalos por envío (modo-offline.md §6.3)
INTERVALO_SEG = int(_num("INTERVALO_SEG", 15 * 60))  # solo se cambia para pruebas

# Bases para contadores que el ESP32 no conoce (valores ficticios de demo)
PRODUCCION_ANUAL_BASE = int(_num("PRODUCCION_ANUAL_BASE", 3100))
DIAS_SIN_INCIDENTES = {"local1": int(_num("DIAS_LOCAL1", 53)), "local2": int(_num("DIAS_LOCAL2", 120))}

# ---- Simulador del ESP32 (solo pruebas) ----
ESP32_CLAVES = {
    "local1": os.environ.get("ESP32_LOCAL1_CLAVE", ""),
    "local2": os.environ.get("ESP32_LOCAL2_CLAVE", ""),
}
