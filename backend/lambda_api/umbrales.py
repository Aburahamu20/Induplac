"""
Umbrales de alerta (CONTEXTO §8.2): catálogo, valores por defecto, validación y
lectura de la copia en DynamoDB.

Dónde viven (decisión 2026-11-03):
  - RDS (tabla `umbrales`) es la fuente: ahí se editan, vía induplac-config.
  - Al guardar, induplac-config copia el valor a la tabla DynamoDB
    `induplac-umbrales` (PK local_id, SK variable). induplac-api lee esa copia,
    porque está fuera de la VPC y no llega a RDS. Si RDS está apagado, las
    alertas siguen funcionando con la última copia.
  - Si una variable no tiene copia, se usan los valores por defecto de aquí.

Lo comparten las dos Lambdas (el deploy copia este archivo a induplac-config).
"""

import time
from decimal import Decimal

# Qué se puede configurar. con_advertencia=False: solo hay umbral de alerta.
VARIABLES = {
    "energia_pct": {"nombre": "Energía sobre el promedio de 4 semanas", "unidad": "%", "max": 200,
                    "con_advertencia": True, "locales": ["local1", "local2"]},
    "energia_kw": {"nombre": "Energía (respaldo sin 4 semanas de historia)", "unidad": "kW", "max": 1000,
                   "con_advertencia": True, "locales": ["local1", "local2"]},
    "agua_m3_dia": {"nombre": "Agua consumida en el día", "unidad": "m³/día", "max": 1000,
                    "con_advertencia": True, "locales": ["local1", "local2"]},
    "agua_m3h": {"nombre": "Posible fuga: caudal fuera de horario", "unidad": "m³/h", "max": 100,
                 "con_advertencia": False, "locales": ["local1", "local2"]},
    "uv": {"nombre": "Índice UV en el patio de carga", "unidad": "UVI", "max": 20,
           "con_advertencia": True, "locales": ["local1"]},
}

DEFECTO = {
    ("local1", "energia_pct"): (10, 20), ("local2", "energia_pct"): (10, 20),
    ("local1", "energia_kw"): (45, 55), ("local2", "energia_kw"): (45, 55),
    ("local1", "agua_m3_dia"): (12, 14), ("local2", "agua_m3_dia"): (2, 2.5),
    ("local1", "agua_m3h"): (None, 0.3), ("local2", "agua_m3h"): (None, 0.05),
    ("local1", "uv"): (6, 8),
}

# Consumo normal de agua por día: solo referencia para la tarjeta (no se edita aquí)
AGUA_NORMAL = {"local1": 10, "local2": 1.5}


def validar(local_id, variable, advertencia, alerta):
    """Devuelve (advertencia, alerta) como float/None, o lanza ValueError con un mensaje claro."""
    meta = VARIABLES.get(variable)
    if not meta or local_id not in meta["locales"]:
        raise ValueError(f"La variable '{variable}' no existe para {local_id}.")

    def numero(nombre, v):
        if v is None or v == "":
            return None
        try:
            x = float(v)
        except (TypeError, ValueError):
            raise ValueError(f"{nombre} debe ser un número.")
        if x < 0 or x > meta["max"]:
            raise ValueError(f"{nombre} debe estar entre 0 y {meta['max']} {meta['unidad']}.")
        return x

    a, r = numero("La advertencia", advertencia), numero("La alerta", alerta)
    if r is None:
        raise ValueError("Falta el umbral de alerta.")
    if not meta["con_advertencia"]:
        a = None
    elif a is not None and a >= r:
        raise ValueError("La advertencia tiene que ser menor que la alerta.")
    return a, r


def a_dynamo(x):
    return None if x is None else Decimal(str(x))


class Umbrales:
    """Lee la copia de DynamoDB con un caché corto (la Lambda se reutiliza entre peticiones)."""

    def __init__(self, tabla, ttl=60):
        self.t = tabla
        self.ttl = ttl
        self._datos, self._leido = None, 0.0

    def _cargar(self):
        if self._datos is None or time.time() - self._leido > self.ttl:
            datos = {}
            try:
                r = self.t.scan()
                items = r["Items"]
                while "LastEvaluatedKey" in r:
                    r = self.t.scan(ExclusiveStartKey=r["LastEvaluatedKey"])
                    items += r["Items"]
                for i in items:
                    datos[(i["local_id"], i["variable"])] = i
            except Exception as e:  # sin la tabla o sin permiso: se usan los valores por defecto
                print("Aviso: no se pudo leer induplac-umbrales:", repr(e))
            self._datos, self._leido = datos, time.time()
        return self._datos

    def get(self, local_id, variable):
        """{'advertencia', 'alerta', 'origen'} con float; origen = 'copia' o 'defecto'."""
        i = self._cargar().get((local_id, variable))
        if i and i.get("alerta") is not None:
            adv = i.get("advertencia")
            return {"advertencia": None if adv is None else float(adv), "alerta": float(i["alerta"]),
                    "origen": "copia", "actualizado": i.get("actualizado"), "actualizado_por": i.get("actualizado_por")}
        adv, alerta = DEFECTO[(local_id, variable)]
        return {"advertencia": adv, "alerta": alerta, "origen": "defecto", "actualizado": None, "actualizado_por": None}

    def alerta(self, local_id, variable):
        return self.get(local_id, variable)["alerta"]

    def advertencia(self, local_id, variable):
        return self.get(local_id, variable)["advertencia"]

    def lista(self, locales):
        return [
            {"local_id": l, "variable": v, "nombre": m["nombre"], "unidad": m["unidad"],
             "con_advertencia": m["con_advertencia"], **self.get(l, v)}
            for l in sorted(locales) for v, m in VARIABLES.items() if l in m["locales"]
        ]

    def olvidar(self):
        self._datos = None
