"""
Pruebas automáticas del Edge (corren en GitHub Actions en cada Pull Request).

Revisan lo que se muestra en la demo: validación de lecturas, descarte de
duplicados y reglas de alerta (CONTEXTO §8.2). Solo usan la biblioteca estándar
y una base SQLite temporal, sin broker ni AWS.

Correr local (desde la carpeta edge/):  py -m unittest discover -s tests -v
"""

import os
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

# Base temporal: nunca toca el edge.db real
os.environ["DB"] = os.path.join(tempfile.mkdtemp(), "prueba.db")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import db  # noqa: E402
import reglas  # noqa: E402


def utc(y, mo, d, h, mi=0) -> int:
    return int(datetime(y, mo, d, h, mi, tzinfo=timezone.utc).timestamp())


# Martes 2026-10-20: 14:00 UTC = 11:00 en Chile (horario laboral); 06:00 UTC = 03:00 en Chile (noche)
DIA = reglas.iso(utc(2026, 10, 20, 14))
NOCHE = reglas.iso(utc(2026, 10, 20, 6))

LECTURA = {
    "device_id": "esp32-local-01", "seq": 1, "ts": utc(2026, 10, 20, 14),
    "energia_kw": 38.0, "agua_m3h": 0.8, "agua_m3_acum": 12.5, "uv_index": 5.0,
    "produccion_acum": 3, "personal_activo": 18,
}


def variables(alertas):
    return {a["variable"] for a in alertas}


class Validacion(unittest.TestCase):
    def test_lectura_valida(self):
        self.assertIsNone(reglas.validar(LECTURA))

    def test_sin_seq_se_rechaza(self):
        self.assertIsNotNone(reglas.validar({**LECTURA, "seq": None}))

    def test_fuera_de_rango_se_rechaza(self):
        self.assertIn("uv_index", reglas.validar({**LECTURA, "uv_index": 20}))
        self.assertIn("energia_kw", reglas.validar({**LECTURA, "energia_kw": -5}))

    def test_hora_del_esp32_si_es_creible(self):
        recibido = LECTURA["ts"] + 2
        self.assertEqual(reglas.hora_lectura(LECTURA, recibido), LECTURA["ts"])

    def test_sin_ntp_usa_la_hora_de_llegada(self):
        recibido = LECTURA["ts"]
        self.assertEqual(reglas.hora_lectura({**LECTURA, "ts": 0}, recibido), recibido)

    def test_intervalo_de_15_minutos(self):
        ts = utc(2026, 10, 20, 14, 7)
        self.assertEqual(reglas.inicio_de(ts), utc(2026, 10, 20, 14, 0))


class Duplicados(unittest.TestCase):
    def test_misma_lectura_dos_veces_se_descarta(self):
        args = ("local1", "esp32-dup", 7, utc(2026, 10, 20, 15), LECTURA)
        self.assertTrue(db.guardar_lectura(*args))
        self.assertFalse(db.guardar_lectura(*args))

    def test_esp32_reiniciado_repite_seq_pero_no_se_pierde(self):
        self.assertTrue(db.guardar_lectura("local1", "esp32-rei", 0, utc(2026, 10, 20, 16), LECTURA))
        self.assertTrue(db.guardar_lectura("local1", "esp32-rei", 0, utc(2026, 10, 20, 17), LECTURA))


class Alertas(unittest.TestCase):
    def evaluar(self, inicio, **valores):
        r = {"inicio_intervalo": inicio, "energia_kw": 38.0, "agua_m3h": 0.5, "agua_m3": 0.1, "uv_max": 3.0}
        r.update(valores)
        return reglas.evaluar("local1", r)

    def test_valores_normales_sin_alertas(self):
        self.assertEqual(self.evaluar(DIA), [])

    def test_uv_8_o_mas_genera_alerta(self):
        self.assertIn("uv_index", variables(self.evaluar(DIA, uv_max=9.1)))

    def test_uv_7_9_no_genera_alerta(self):
        self.assertNotIn("uv_index", variables(self.evaluar(DIA, uv_max=7.9)))

    def test_energia_sobre_55_kw_sin_historia(self):
        self.assertIn("energia_kw", variables(self.evaluar(DIA, energia_kw=62.2)))

    def test_fuga_de_agua_de_noche(self):
        self.assertIn("agua_m3h", variables(self.evaluar(NOCHE, agua_m3h=1.3)))

    def test_mismo_caudal_de_dia_no_es_fuga(self):
        self.assertNotIn("agua_m3h", variables(self.evaluar(DIA, agua_m3h=1.3)))

    def test_alerta_tiene_id_para_no_duplicarse(self):
        a = [x for x in self.evaluar(DIA, uv_max=9.1) if x["variable"] == "uv_index"][0]
        self.assertEqual(a["id"], f"local1:uv_index:{DIA}")


if __name__ == "__main__":
    unittest.main()
