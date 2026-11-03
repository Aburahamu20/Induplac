"""
Auditoría de Induplac: registros que solo se agregan, encadenados por hash.

Tabla DynamoDB `induplac-auditoria` (PK `sede`, SK `id`, PITR y protección
contra eliminación). Cada registro guarda el hash del anterior de su misma sede,
así que si alguien borra o cambia un registro desde la consola la cadena se
rompe y `verificar` lo detecta (el dashboard muestra "Auditoría alterada").

Cabecera de la cadena: un ítem por sede con `sede = "cadena"` e `id = <sede>`,
con el hash y el id del último registro. Agregar un registro y mover la
cabecera se hace en UNA transacción condicionada al hash anterior, así dos
escrituras al mismo tiempo no pueden dejar la cadena bifurcada.

Este módulo no importa boto3 arriba para poder probarlo sin AWS
(backend/lambda_api/tests/test_auditoria.py usa un repositorio en memoria).
"""

import hashlib
import json
import secrets
from datetime import datetime, timedelta, timezone

GENESIS = "0" * 64  # "hash anterior" del primer registro de cada sede
CABECERA = "cadena"
SEDES = ("local1", "local2", "general")  # general: acciones que no son de una sede
MAX_POR_SEDE = 1000

# Campos que entran al hash, en este orden (el hash no se incluye a sí mismo)
CAMPOS = ("sede", "id", "ts", "usuario", "rol", "accion", "objeto", "detalle", "origen", "hash_anterior")


class Conflicto(Exception):
    """Otra escritura movió la cabecera de la cadena: hay que reintentar."""


def iso_ms(dt):
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def leer_ts(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def calcular_hash(reg):
    base = json.dumps({c: reg.get(c) for c in CAMPOS}, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(base.encode("utf-8")).hexdigest()


def registrar(repo, sede, usuario, rol, accion, objeto, detalle=None, ahora=None, intentos=5, origen="nube"):
    """Agrega un registro al final de la cadena de `sede` y lo devuelve."""
    if sede not in SEDES:
        raise ValueError(f"Sede de auditoría inválida: {sede}")
    for _ in range(intentos):
        cab = repo.leer_cabeza(sede)
        anterior = cab["ultimo_hash"] if cab else GENESIS
        t = ahora or datetime.now(timezone.utc)
        # El id empieza con la hora: debe quedar después del último para que
        # el orden por id sea el mismo orden de la cadena
        if cab and iso_ms(t) <= cab["ultimo_ts"]:
            t = leer_ts(cab["ultimo_ts"]) + timedelta(milliseconds=1)
        ts = iso_ms(t)
        reg = {
            "sede": sede,
            "id": f"{ts}#{secrets.token_hex(4)}",
            "ts": ts,
            "usuario": usuario,
            "rol": rol,
            "accion": accion,
            "objeto": objeto,
            "detalle": json.dumps(detalle or {}, sort_keys=True, ensure_ascii=False, default=str),
            "origen": origen,
            "hash_anterior": anterior,
        }
        reg["hash"] = calcular_hash(reg)
        try:
            repo.escribir(reg, anterior if cab else None)
            return reg
        except Conflicto:
            continue
    raise RuntimeError("No se pudo registrar la auditoría: demasiadas escrituras simultáneas.")


def verificar(repo, sede, registros, hasta_el_final):
    """Revisa la cadena de `registros` (en orden ascendente). Devuelve la lista de problemas.

    hasta_el_final: True si el rango llega hasta ahora y no se cortó; entonces
    también se compara con la cabecera para detectar que borraron los últimos.
    """
    problemas = []
    if registros:
        previo = repo.anterior(sede, registros[0]["id"])
        esperado = previo["hash"] if previo else GENESIS
        for r in registros:
            if calcular_hash(r) != r.get("hash"):
                problemas.append({"id": r["id"], "tipo": "modificado", "mensaje": "El registro fue cambiado después de guardarse."})
            if r.get("hash_anterior") != esperado:
                problemas.append({"id": r["id"], "tipo": "faltante", "mensaje": "Falta o se cambió el registro anterior a este."})
            esperado = r.get("hash")
    if hasta_el_final:
        cab = repo.leer_cabeza(sede)
        if cab:
            if registros and registros[-1]["id"] > cab["ultimo_id"]:
                problemas.append({"id": registros[-1]["id"], "tipo": "fuera_de_cadena", "mensaje": "Hay registros que no están en la cadena."})
            elif registros and registros[-1]["id"] == cab["ultimo_id"] and registros[-1].get("hash") != cab["ultimo_hash"]:
                problemas.append({"id": cab["ultimo_id"], "tipo": "modificado", "mensaje": "El último registro no coincide con la cabecera."})
            elif not registros or registros[-1]["id"] < cab["ultimo_id"]:
                if repo.existe(sede, cab["ultimo_id"]) is False:
                    problemas.append({"id": cab["ultimo_id"], "tipo": "faltante", "mensaje": "Se borró el último registro."})
    return problemas


def consultar(repo, sedes, desde, hasta, ahora=None):
    """Registros de `sedes` entre `desde` y `hasta` (datetime), con la verificación por sede."""
    ahora = ahora or datetime.now(timezone.utc)
    hasta_el_final = hasta >= ahora - timedelta(seconds=5)
    todos, integridad, truncado = [], {}, False
    for sede in sedes:
        regs = repo.consultar(sede, iso_ms(desde), iso_ms(hasta) + "~", MAX_POR_SEDE + 1)
        corto = len(regs) > MAX_POR_SEDE
        regs = regs[:MAX_POR_SEDE]
        truncado = truncado or corto
        problemas = verificar(repo, sede, regs, hasta_el_final and not corto)
        integridad[sede] = {"estado": "alterada" if problemas else "ok", "problemas": problemas}
        todos += regs
    todos.sort(key=lambda r: r["id"], reverse=True)
    for r in todos:
        try:
            r["detalle"] = json.loads(r.get("detalle") or "{}")
        except ValueError:
            pass  # si alguien lo dejó ilegible, se muestra tal cual (y la cadena ya lo marcó)
    return {"registros": todos, "integridad": integridad, "truncado": truncado}


class RepoDynamo:
    """Repositorio real: tabla DynamoDB (boto3 se importa solo aquí)."""

    def __init__(self, tabla):
        from boto3.dynamodb.conditions import Key

        self.t = tabla
        # Ojo: el cliente de un resource de boto3 convierte solo los valores de
        # Python a tipos de DynamoDB. Si se le pasan ya convertidos ({"S": ...})
        # los convierte otra vez y quedan como MAP (error real del 02/11).
        self.c = tabla.meta.client
        self.Key = Key

    def leer_cabeza(self, sede):
        return self.t.get_item(Key={"sede": CABECERA, "id": sede}, ConsistentRead=True).get("Item")

    def escribir(self, reg, hash_previo):
        # Nombres con # porque DynamoDB tiene palabras reservadas (ej. "total" lo es)
        cond = "attribute_not_exists(#uh)" if hash_previo is None else "#uh = :p"
        valores = {":h": reg["hash"], ":i": reg["id"], ":t": reg["ts"], ":uno": 1}
        if hash_previo is not None:
            valores[":p"] = hash_previo
        try:
            self.c.transact_write_items(TransactItems=[
                {"Update": {
                    "TableName": self.t.name,
                    "Key": {"sede": CABECERA, "id": reg["sede"]},
                    "UpdateExpression": "SET #uh = :h, #ui = :i, #ut = :t ADD #tot :uno",
                    "ConditionExpression": cond,
                    "ExpressionAttributeNames": {"#uh": "ultimo_hash", "#ui": "ultimo_id", "#ut": "ultimo_ts", "#tot": "total"},
                    "ExpressionAttributeValues": valores,
                }},
                {"Put": {
                    "TableName": self.t.name,
                    "Item": dict(reg),
                    "ConditionExpression": "attribute_not_exists(#id)",
                    "ExpressionAttributeNames": {"#id": "id"},
                }},
            ])
        except self.c.exceptions.TransactionCanceledException as e:
            raise Conflicto() from e

    def consultar(self, sede, desde_id, hasta_id, limite):
        items, args = [], {
            "KeyConditionExpression": self.Key("sede").eq(sede) & self.Key("id").between(desde_id, hasta_id),
            "ScanIndexForward": True,
        }
        while len(items) < limite:
            r = self.t.query(**args)
            items += r["Items"]
            if "LastEvaluatedKey" not in r:
                break
            args["ExclusiveStartKey"] = r["LastEvaluatedKey"]
        return items[:limite]

    def anterior(self, sede, id_):
        r = self.t.query(
            KeyConditionExpression=self.Key("sede").eq(sede) & self.Key("id").lt(id_),
            ScanIndexForward=False,
            Limit=1,
        )
        return r["Items"][0] if r["Items"] else None

    def existe(self, sede, id_):
        return "Item" in self.t.get_item(Key={"sede": sede, "id": id_}, ProjectionExpression="id")
