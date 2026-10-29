"""
API local del Edge (tarea 22): el dashboard de planta, con o sin internet.

Implementa los mismos endpoints y JSON que la API de la nube (backend/lambda_api,
contrato docs/api-dashboard.md §3), pero leyendo edge.db. Además:
  - Login local (§6.2, auth_local.py). Todo lo de datos pide token y la API revisa
    permisos y locales en cada petición (403 si falta).
  - Endpoints de demo (§5) solo si DEMO=1.
  - Sirve el build del dashboard (dashboard/dist-planta), con vuelta a index.html.

Solo biblioteca estándar (http.server). Normalmente la arranca edge_gateway.py en un hilo.
Para probar solo la API (sin MQTT ni AWS), desde edge/:  py api_local.py
"""

import json
import logging
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlsplit

import auth_local
import config
import db
import reglas
from auth_local import ErrorApi

log = logging.getLogger("api")

NOMBRES = {"local1": "Local 1 · Planta", "local2": "Local 2 · Oficinas"}
VARIABLES = {
    "local1": ["energia_kw", "agua_m3h", "agua_m3_dia", "uv_index", "produccion_mes",
               "produccion_anual", "hh_sin_incidentes", "dias_sin_incidentes"],
    "local2": ["energia_kw", "energia_climatizacion_kw", "energia_iluminacion_kw", "agua_m3h",
               "agua_m3_dia", "hh_sin_incidentes", "dias_sin_incidentes"],
}
META_MES, META_ANIO = 400, 5000
CAMPO_HIST = {"energia_kw": "energia_kw", "uv_index": "uv_max", "agua_m3h": "agua_m3h", "agua_m3_dia": "agua_m3"}
AGRUPACIONES = ("15min", "hora", "dia", "mes")
ESTADOS_ALERTA = ("activa", "reconocida", "cerrada")
VARIABLES_DEMO = {"energia_kw", "energia_climatizacion_kw", "energia_iluminacion_kw", "agua_m3h", "uv_index"}
MAX_CUERPO = 64 * 1024

# Windows a veces informa .js como text/plain y el navegador rechaza los módulos: tipos fijos
TIPOS = {
    ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon",
    ".woff": "font/woff", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".map": "application/json",
}


class Contexto:
    """Lo que el Edge comparte con la API: su enlace con AWS y el intervalo en curso de cada local."""

    def __init__(self, enlace, abiertos=None):
        self.enlace = enlace
        self.abiertos = abiertos or (lambda: {})


# ---------------- utilidades ----------------

def _leer_iso(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def _fecha(q: dict, nombre: str, obligatoria: bool) -> str | None:
    valor = _uno(q, nombre)
    if not valor:
        if obligatoria:
            raise ErrorApi(400, "PARAMETROS", f"Falta {nombre}.")
        return None
    try:
        t = _leer_iso(valor)
    except ValueError:
        raise ErrorApi(400, "FECHA_INVALIDA", f"{nombre} debe ser ISO 8601 en UTC.") from None
    if t.tzinfo is None:
        t = t.replace(tzinfo=timezone.utc)
    return reglas.iso(t.timestamp())


def _uno(q: dict, nombre: str) -> str | None:
    valores = q.get(nombre)
    return valores[0] if valores else None


def _texto(cuerpo: dict, campo: str) -> str:
    v = cuerpo.get(campo)
    if not isinstance(v, str) or not v:
        raise ErrorApi(400, "PARAMETROS", f"Falta {campo}.")
    return v


def _permiso(u: dict, permiso: str) -> None:
    if permiso not in u["permisos"]:
        raise ErrorApi(403, "SIN_PERMISO", f"Tu usuario no tiene el permiso {permiso}.")


def _local(u: dict, local_id: str | None) -> str:
    """Valida que el local exista, que lo atienda este Edge y que el usuario pueda verlo."""
    if local_id not in NOMBRES:
        raise ErrorApi(404, "LOCAL_NO_EXISTE", "Local inexistente.")
    if local_id not in u["locales"]:
        raise ErrorApi(403, "LOCAL_NO_PERMITIDO", "Tu usuario no puede ver ese local.")
    if local_id not in config.LOCALES:
        raise ErrorApi(404, "LOCAL_NO_EXISTE", "Este Edge no atiende ese local.")
    return local_id


def _locales_visibles(u: dict) -> list[str]:
    return [l for l in config.LOCALES if l in u["locales"]]


def _ultimo(ctx: Contexto, local_id: str) -> dict | None:
    """El intervalo en curso (casi en vivo) o, si no hay lecturas recientes, el último cerrado."""
    return ctx.abiertos().get(local_id) or db.ultimo_intervalo(local_id)


# ---------------- consulta (mismo JSON que la Lambda) ----------------

def estado(ctx: Contexto, u: dict) -> dict:
    salida = []
    for l in _locales_visibles(u):
        ultima = db.ultima_lectura(l)
        salida.append({
            "local_id": l,
            "enlace": ctx.enlace.estado,
            "pendientes": db.contar_pendientes(l),
            "ultima_sincronizacion": ctx.enlace.ultima_sincronizacion,
            "ultimo_dato": reglas.iso(ultima["ts"]) if ultima else None,
        })
    return {"origen": "edge", "hora_servidor": reglas.iso(time.time()), "locales": salida}


def locales(u: dict) -> list[dict]:
    return [{"local_id": l, "nombre": NOMBRES[l], "variables": VARIABLES[l]} for l in _locales_visibles(u)]


def actual(ctx: Contexto, u: dict, local_id: str) -> dict:
    _permiso(u, "ver_actual")
    _local(u, local_id)
    r = _ultimo(ctx, local_id)
    if not r:
        raise ErrorApi(503, "SIN_DATOS", "Todavía no llegan datos de este local.")
    inicio = r["inicio_intervalo"]
    ts = int(_leer_iso(inicio).timestamp())
    agua = reglas.AGUA[local_id]
    kw = r.get("energia_kw") or 0
    ref = reglas.promedio_4_semanas(local_id, inicio)
    dia = round(reglas.agua_del_dia(local_id, ts, r), 4)
    caudal = r.get("agua_m3h") or 0
    fuga = caudal > agua["fuga"] and reglas.fuera_de_horario(inicio)

    v = [
        {"id": "energia_kw", "valor": kw, "referencia": ref, "nivel": reglas.nivel_energia(kw, ref)},
        {"id": "agua_m3h", "valor": caudal, "referencia": None, "nivel": "critico" if fuga else "normal"},
        {"id": "agua_m3_dia", "valor": dia, "referencia": agua["normal"], "nivel": reglas.nivel_agua_dia(local_id, dia)},
        {"id": "hh_sin_incidentes", "valor": r.get("hh_sin_incidentes") or 0, "referencia": None, "nivel": "normal"},
        {"id": "dias_sin_incidentes", "valor": r.get("dias_sin_incidentes") or 0, "referencia": None, "nivel": "normal"},
    ]
    if local_id == "local1":
        uv = r.get("uv_max") or 0
        v += [
            {"id": "uv_index", "valor": uv, "referencia": None, "nivel": reglas.nivel_uv(uv)},
            {"id": "produccion_mes", "valor": r.get("produccion_mes") or 0, "referencia": META_MES, "nivel": "normal"},
            {"id": "produccion_anual", "valor": r.get("produccion_anual") or 0, "referencia": META_ANIO, "nivel": "normal"},
        ]
    else:
        for k in ("energia_climatizacion_kw", "energia_iluminacion_kw"):
            v.append({"id": k, "valor": r.get(k) or 0, "referencia": None, "nivel": "normal"})
    return {"local_id": local_id, "ts": inicio, "variables": v}


def _alerta_json(a: dict) -> dict:
    campos = ("id", "local_id", "variable", "valor", "umbral", "regla", "inicio_intervalo", "estado", "reconocida_en")
    return {**{k: a[k] for k in campos}, "nivel": "critico", "origen": "edge"}


def lista_alertas(u: dict, q: dict) -> list[dict]:
    _permiso(u, "ver_alertas")
    local_id = _uno(q, "local_id")
    elegidos = [_local(u, local_id)] if local_id else _locales_visibles(u)
    estado_q = _uno(q, "estado")
    if estado_q and estado_q not in ESTADOS_ALERTA:
        raise ErrorApi(400, "PARAMETROS", f"estado debe ser {', '.join(ESTADOS_ALERTA)}.")
    desde, hasta = _fecha(q, "desde", False), _fecha(q, "hasta", False)
    items = []
    for l in elegidos:
        items += db.alertas(l, estado_q)
    items = [a for a in items if (not desde or a["inicio_intervalo"] >= desde) and (not hasta or a["inicio_intervalo"] <= hasta)]
    items.sort(key=lambda a: a["inicio_intervalo"], reverse=True)
    return [_alerta_json(a) for a in items[:200]]


def reconocer(u: dict, id_alerta: str) -> dict:
    _permiso(u, "reconocer_alertas")
    local_id = id_alerta.split(":", 1)[0]
    if local_id not in NOMBRES:
        raise ErrorApi(404, "ALERTA_NO_EXISTE", "Alerta inexistente.")
    _local(u, local_id)
    a = db.reconocer_alerta(id_alerta, reglas.iso(time.time()))
    if not a:
        raise ErrorApi(404, "ALERTA_NO_EXISTE", "Alerta inexistente.")
    return _alerta_json(a)


def _clave_grupo(inicio: str, agrupacion: str) -> str:
    t = _leer_iso(inicio)
    if agrupacion == "hora":
        return reglas.iso(t.replace(minute=0, second=0).timestamp())
    if agrupacion == "dia":
        return reglas.iso(reglas.inicio_dia_chile(int(t.timestamp())))
    if agrupacion == "mes":
        local = t.astimezone(reglas.TZ).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        return reglas.iso(local.timestamp())
    return inicio


def historico(ctx: Contexto, u: dict, q: dict) -> dict:
    _permiso(u, "ver_historico")
    elegidos = q.get("local_id") or []
    variable, agrupacion = _uno(q, "variable"), _uno(q, "agrupacion") or "hora"
    if not elegidos or variable not in CAMPO_HIST:
        raise ErrorApi(400, "PARAMETROS", f"Faltan local_id o variable ({', '.join(CAMPO_HIST)}).")
    if agrupacion not in AGRUPACIONES:
        raise ErrorApi(400, "PARAMETROS", f"agrupacion debe ser {', '.join(AGRUPACIONES)}.")
    desde, hasta = _fecha(q, "desde", True), _fecha(q, "hasta", True)
    campo = CAMPO_HIST[variable]
    acumulada = variable == "agua_m3_dia"
    series = []
    for l in elegidos:
        _local(u, l)
        filas = db.intervalos_entre(l, desde, hasta)
        abierto = ctx.abiertos().get(l)
        if abierto and desde <= abierto["inicio_intervalo"] <= hasta and not any(
            f["inicio_intervalo"] == abierto["inicio_intervalo"] for f in filas
        ):
            filas.append(abierto)
        grupos: dict[str, list[float]] = {}
        for i in filas:
            if i.get(campo) is not None:
                grupos.setdefault(_clave_grupo(i["inicio_intervalo"], agrupacion), []).append(i[campo])
        puntos = [
            {
                "inicio": k,
                "promedio": None if acumulada else sum(vs) / len(vs),
                "maximo": None if acumulada else max(vs),
                "total": sum(vs) if acumulada else None,
            }
            for k, vs in sorted(grupos.items())
        ]
        if len(puntos) > 2000:
            raise ErrorApi(400, "RANGO_DEMASIADO_GRANDE", "Pide un rango menor o una agrupación mayor.")
        series.append({"local_id": l, "puntos": puntos})
    return {"variable": variable, "agrupacion": agrupacion, "series": series}


# ---------------- demo (§5, solo con DEMO=1) ----------------

def demo_enlace(ctx: Contexto, u: dict, cuerpo: dict) -> dict:
    if cuerpo.get("local_id"):
        _local(u, cuerpo["local_id"])  # un solo enlace por Edge: corta la sincronización de todos sus locales
    conectado = cuerpo.get("conectado")
    if not isinstance(conectado, bool):
        raise ErrorApi(400, "PARAMETROS", "conectado debe ser true o false.")
    ctx.enlace.cortar(not conectado)
    return {"conectado": conectado, "enlace": ctx.enlace.estado}


DEMO_PESO = 9  # lecturas inyectadas por cada lectura real del intervalo en curso


def demo_inyectar(u: dict, cuerpo: dict) -> dict:
    """Mete el valor como si viniera del ESP32 y evalúa las alertas al tiro.

    Energía y caudal se promedian en el intervalo: una sola lectura no lo mueve (120 a 40 kW
    + una a 60 kW = 40,17 kW). Por eso se guardan ~9 lecturas por cada lectura real que ya
    tenga el intervalo en curso, y el valor inyectado queda en ~90 % del promedio. Solo se
    cuentan las lecturas reales: si se cuentan también las de demo, cada clic crece x10.
    """
    local_id = _local(u, _texto(cuerpo, "local_id"))
    variable, valor = cuerpo.get("variable"), cuerpo.get("valor")
    if variable not in VARIABLES_DEMO or variable not in VARIABLES[local_id]:
        raise ErrorApi(400, "VARIABLE_INVALIDA", f"Variable no inyectable en {local_id}.")
    if isinstance(valor, bool) or not isinstance(valor, (int, float)):
        raise ErrorApi(400, "PARAMETROS", "valor debe ser un número.")
    ahora = int(time.time())
    inicio = reglas.inicio_de(ahora)
    device_id = f"demo-{local_id}"
    base = db.ultima_lectura(local_id) or {}
    lectura = {**{k: v for k, v in base.items() if k != "ts"}, "device_id": device_id, "ts": ahora, variable: valor}
    motivo = reglas.validar({**lectura, "seq": 0})
    if motivo:
        raise ErrorApi(400, "VALOR_FUERA_DE_RANGO", motivo)
    reales = db.contar_lecturas(local_id, inicio, inicio + config.INTERVALO_SEG, sin_demo=True)
    cantidad = max(1, DEMO_PESO * reales)
    seq0 = time.time_ns() // 1_000_000 * 100_000  # seq distintos aunque se inyecte dos veces en el mismo segundo
    db.guardar_lecturas(local_id, device_id,
                        [(seq0 + i, ahora, {**lectura, "seq": seq0 + i}) for i in range(cantidad)])
    r = reglas.calcular_intervalo(local_id, inicio)
    nuevas = [a for a in reglas.evaluar(local_id, r) if db.guardar_alerta(a)] if r else []
    for a in nuevas:
        log.warning("🚨 ALERTA %s (demo): %s (valor %s, umbral %s)", local_id, a["regla"], a["valor"], a["umbral"])
    return {"ok": True, "lecturas": cantidad, "alertas_nuevas": len(nuevas)}


# ---------------- enrutador ----------------

def _token(autorizacion: str) -> str:
    tipo, _, token = autorizacion.partition(" ")
    if tipo.lower() != "bearer" or not token.strip():
        raise ErrorApi(401, "NO_AUTENTICADO", "Inicia sesión para ver el dashboard.")
    return token.strip()


def despachar(ctx: Contexto, metodo: str, ruta: str, q: dict, cuerpo: dict, autorizacion: str):
    """Devuelve (código HTTP, cuerpo). `ruta` viene sin decodificar, ej. /api/alertas/local1%3Auv.../reconocer."""
    partes = [unquote(p) for p in ruta.strip("/").split("/")[1:]]  # sin el "api" inicial

    # Sin token: salud y pasos del login (usan la sesión temporal del desafío)
    if partes == ["health"]:
        return 200, {"ok": True}
    if metodo == "POST" and partes[:1] == ["auth"]:
        if partes == ["auth", "login"]:
            return 200, auth_local.login(_texto(cuerpo, "usuario"), _texto(cuerpo, "clave"))
        if partes == ["auth", "cambiar-clave"]:
            return 200, auth_local.cambiar_clave(_texto(cuerpo, "sesion"), _texto(cuerpo, "clave_nueva"))
        if partes == ["auth", "mfa", "registrar"]:
            return 200, auth_local.registrar_mfa(_texto(cuerpo, "sesion"))
        if partes == ["auth", "mfa", "verificar"]:
            return 200, auth_local.verificar_mfa(_texto(cuerpo, "sesion"), _texto(cuerpo, "codigo"))

    # Todo lo demás exige token
    token = _token(autorizacion)
    u = auth_local.validar_token(token)
    if metodo == "GET" and partes == ["auth", "yo"]:
        return 200, u
    if metodo == "POST" and partes == ["auth", "logout"]:
        auth_local.logout(token)
        return 200, {"ok": True}
    if metodo == "GET" and partes == ["estado"]:
        return 200, estado(ctx, u)
    if metodo == "GET" and partes == ["locales"]:
        return 200, locales(u)
    if metodo == "GET" and len(partes) == 3 and partes[0] == "locales" and partes[2] == "actual":
        return 200, actual(ctx, u, partes[1])
    if metodo == "GET" and partes == ["alertas"]:
        return 200, lista_alertas(u, q)
    if metodo == "POST" and len(partes) == 3 and partes[0] == "alertas" and partes[2] == "reconocer":
        return 200, reconocer(u, partes[1])
    if metodo == "GET" and partes == ["historico"]:
        return 200, historico(ctx, u, q)
    if config.DEMO and metodo == "POST" and partes == ["demo", "enlace"]:
        return 200, demo_enlace(ctx, u, cuerpo)
    if config.DEMO and metodo == "POST" and partes == ["demo", "inyectar"]:
        return 200, demo_inyectar(u, cuerpo)
    raise ErrorApi(404, "RUTA_NO_EXISTE", f"{metodo} {ruta}")


class Manejador(BaseHTTPRequestHandler):
    server_version = "InduplacEdge"
    sys_version = ""

    def log_message(self, formato, *args):
        log.debug("%s %s", self.address_string(), formato % args)

    def do_GET(self):
        self._atender("GET")

    def do_POST(self):
        self._atender("POST")

    def _atender(self, metodo: str) -> None:
        url = urlsplit(self.path)
        if url.path != "/api" and not url.path.startswith("/api/"):
            if metodo == "GET":
                return self._estatico(url.path)
            return self._json(404, ErrorApi(404, "RUTA_NO_EXISTE", url.path).cuerpo())
        try:
            cuerpo = self._leer_cuerpo() if metodo == "POST" else {}
            codigo, datos = despachar(self.server.ctx, metodo, url.path, parse_qs(url.query),
                                      cuerpo, self.headers.get("Authorization", ""))
        except ErrorApi as e:
            codigo, datos = e.http, e.cuerpo()
        except Exception:  # nunca devolver el stack al cliente
            log.exception("Error en %s %s", metodo, url.path)
            codigo, datos = 500, ErrorApi(500, "ERROR_INTERNO", "Error interno de la API local.").cuerpo()
        self._json(codigo, datos)

    def _leer_cuerpo(self) -> dict:
        try:
            largo = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            largo = -1
        if largo < 0 or largo > MAX_CUERPO:
            raise ErrorApi(413, "CUERPO_GRANDE", "Cuerpo de la petición inválido o demasiado grande.")
        if largo == 0:
            return {}
        try:
            datos = json.loads(self.rfile.read(largo))
        except (ValueError, UnicodeDecodeError):
            datos = None
        if not isinstance(datos, dict):
            raise ErrorApi(400, "JSON_INVALIDO", "El cuerpo debe ser un objeto JSON.")
        return datos

    def _enviar(self, codigo: int, tipo: str, datos: bytes, cache: str) -> None:
        self.send_response(codigo)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(datos)))
        self.send_header("Cache-Control", cache)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(datos)

    def _json(self, codigo: int, datos) -> None:
        self._enviar(codigo, "application/json; charset=utf-8", json.dumps(datos, ensure_ascii=False).encode(), "no-store")

    def _estatico(self, ruta: str) -> None:
        """Build del dashboard. Cualquier ruta que no sea un archivo devuelve index.html (SPA)."""
        raiz = config.DASHBOARD_DIR.resolve()
        index = raiz / "index.html"
        if not index.is_file():
            return self._json(503, ErrorApi(503, "SIN_DASHBOARD",
                                            "Falta el build del dashboard: en dashboard/ corre npm run build:planta.").cuerpo())
        destino = (raiz / unquote(ruta).lstrip("/")).resolve()
        if not destino.is_relative_to(raiz) or not destino.is_file():
            destino = index
        # Los archivos de assets/ llevan hash en el nombre: se pueden guardar en caché para siempre
        cache = "public, max-age=31536000, immutable" if destino.parent.name == "assets" else "no-cache"
        tipo = TIPOS.get(destino.suffix.lower(), "application/octet-stream")
        self._enviar(200, tipo, destino.read_bytes(), cache)


def crear_servidor(enlace, abiertos=None, host: str | None = None, puerto: int | None = None) -> ThreadingHTTPServer:
    srv = ThreadingHTTPServer((host or config.API_HOST, config.API_PORT if puerto is None else puerto), Manejador)
    srv.daemon_threads = True
    srv.ctx = Contexto(enlace, abiertos)
    return srv


def iniciar(enlace, abiertos=None) -> ThreadingHTTPServer:
    """Arranca la API en un hilo aparte (lo llama edge_gateway.py)."""
    srv = crear_servidor(enlace, abiertos)
    threading.Thread(target=srv.serve_forever, name="api-local", daemon=True).start()
    log.info("API local en http://%s:%d · dashboard %s · demo %s", config.API_HOST, config.API_PORT,
             "listo" if (config.DASHBOARD_DIR / "index.html").is_file() else "sin build", "ON" if config.DEMO else "off")
    return srv


if __name__ == "__main__":
    from sincronizacion import Enlace

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-7s %(name)s: %(message)s", datefmt="%H:%M:%S")
    servidor = crear_servidor(Enlace())
    log.info("API local sola (sin MQTT ni AWS) en http://%s:%d", config.API_HOST, config.API_PORT)
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        pass
