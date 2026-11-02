"""Pruebas de la auditoría encadenada (sin AWS: repositorio en memoria)."""

import os
import sys
import unittest
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import auditoria as A  # noqa: E402


class RepoMemoria:
    def __init__(self):
        self.items = {}  # (sede, id) -> registro
        self.cabezas = {}
        self.forzar_conflicto = 0

    def leer_cabeza(self, sede):
        c = self.cabezas.get(sede)
        return dict(c) if c else None

    def escribir(self, reg, hash_previo):
        if self.forzar_conflicto:
            self.forzar_conflicto -= 1
            # otra escritura se adelantó: mueve la cabecera
            A.registrar(self, reg["sede"], "otro", "jefe", "x", "y")
            raise A.Conflicto()
        actual = self.cabezas.get(reg["sede"])
        if (actual is None) != (hash_previo is None) or (actual and actual["ultimo_hash"] != hash_previo):
            raise A.Conflicto()
        self.items[(reg["sede"], reg["id"])] = dict(reg)
        self.cabezas[reg["sede"]] = {"ultimo_hash": reg["hash"], "ultimo_id": reg["id"], "ultimo_ts": reg["ts"]}

    def consultar(self, sede, desde, hasta, limite):
        return [dict(v) for (s, i), v in sorted(self.items.items()) if s == sede and desde <= i <= hasta][:limite]

    def anterior(self, sede, id_):
        prev = [v for (s, i), v in sorted(self.items.items()) if s == sede and i < id_]
        return dict(prev[-1]) if prev else None

    def existe(self, sede, id_):
        return (sede, id_) in self.items


T0 = datetime(2026, 11, 2, 12, 0, tzinfo=timezone.utc)


def cargar(repo, n=5, sede="local1"):
    return [A.registrar(repo, sede, f"u{i}", "jefe", "alerta.reconocida", f"local1:energia_kw:{i}",
                        {"i": i}, ahora=T0 + timedelta(minutes=i)) for i in range(n)]


def estado(repo, sede="local1", desde=T0 - timedelta(days=1), hasta=None):
    r = A.consultar(repo, [sede], desde, hasta or T0 + timedelta(hours=1), ahora=T0 + timedelta(hours=1))
    return r["integridad"][sede]


class TestAuditoria(unittest.TestCase):
    def test_cadena_sana(self):
        repo = RepoMemoria()
        regs = cargar(repo)
        self.assertEqual(regs[0]["hash_anterior"], A.GENESIS)
        self.assertEqual(regs[1]["hash_anterior"], regs[0]["hash"])
        self.assertEqual(estado(repo)["estado"], "ok")

    def test_modificar_un_registro(self):
        repo = RepoMemoria()
        regs = cargar(repo)
        repo.items[("local1", regs[2]["id"])]["usuario"] = "intruso"
        e = estado(repo)
        self.assertEqual(e["estado"], "alterada")
        self.assertIn("modificado", [p["tipo"] for p in e["problemas"]])

    def test_borrar_uno_del_medio(self):
        repo = RepoMemoria()
        regs = cargar(repo)
        del repo.items[("local1", regs[2]["id"])]
        self.assertEqual(estado(repo)["estado"], "alterada")

    def test_borrar_el_primero(self):
        repo = RepoMemoria()
        regs = cargar(repo)
        del repo.items[("local1", regs[0]["id"])]
        self.assertEqual(estado(repo)["estado"], "alterada")

    def test_borrar_el_ultimo(self):
        repo = RepoMemoria()
        regs = cargar(repo)
        del repo.items[("local1", regs[-1]["id"])]
        e = estado(repo)
        self.assertEqual(e["estado"], "alterada")
        self.assertIn("Se borró el último registro.", [p["mensaje"] for p in e["problemas"]])

    def test_rango_parcial_usa_el_anterior(self):
        repo = RepoMemoria()
        cargar(repo)
        # solo los últimos 2 registros: el primero se valida contra el que queda antes del rango
        self.assertEqual(estado(repo, desde=T0 + timedelta(minutes=3))["estado"], "ok")

    def test_rango_vacio_hasta_ahora(self):
        repo = RepoMemoria()
        cargar(repo)
        self.assertEqual(estado(repo, desde=T0 + timedelta(minutes=30))["estado"], "ok")

    def test_sedes_separadas(self):
        repo = RepoMemoria()
        cargar(repo, 3, "local1")
        r2 = cargar(repo, 2, "local2")
        self.assertEqual(r2[0]["hash_anterior"], A.GENESIS)
        r = A.consultar(repo, ["local1", "local2"], T0 - timedelta(days=1), T0 + timedelta(hours=1), T0 + timedelta(hours=1))
        self.assertEqual(len(r["registros"]), 5)
        self.assertEqual({v["estado"] for v in r["integridad"].values()}, {"ok"})
        self.assertGreater(r["registros"][0]["id"], r["registros"][-1]["id"])  # más reciente primero
        self.assertEqual(r["registros"][0]["detalle"], {"i": 2})  # local1, minuto 2

    def test_conflicto_reintenta_y_no_bifurca(self):
        repo = RepoMemoria()
        cargar(repo, 2)
        repo.forzar_conflicto = 1
        A.registrar(repo, "local1", "u9", "admin-sede", "alerta.reconocida", "z", ahora=T0 + timedelta(minutes=10))
        self.assertEqual(estado(repo)["estado"], "ok")
        self.assertEqual(len(repo.items), 4)

    def test_misma_hora_sigue_en_orden(self):
        repo = RepoMemoria()
        a = A.registrar(repo, "local1", "u", "jefe", "x", "1", ahora=T0)
        b = A.registrar(repo, "local1", "u", "jefe", "x", "2", ahora=T0)  # reloj igual (o atrasado)
        self.assertGreater(b["id"], a["id"])
        self.assertEqual(estado(repo)["estado"], "ok")

    def test_sede_invalida(self):
        with self.assertRaises(ValueError):
            A.registrar(RepoMemoria(), "cadena", "u", "jefe", "x", "y")


if __name__ == "__main__":
    unittest.main()
