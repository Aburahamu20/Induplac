"""
Crea las tablas de configuración de Induplac IoT en RDS PostgreSQL
y carga datos de ejemplo.

RDS guarda solo CONFIGURACIÓN (decisión 2026-10-19):
  - locales y dispositivos (catálogo)
  - umbrales de alerta por local y variable
  - permisos por usuario (enlazados al usuario de Cognito)
Las lecturas y las alertas siguen en DynamoDB; las cuentas y el MFA, en Cognito.

Uso (Windows, desde la carpeta donde está este archivo):
  py -m pip install "psycopg[binary]"
  py crear_tablas_rds.py

Pide el endpoint y la clave al correr (no se guardan en ningún lado).
Se puede correr varias veces: no duplica nada.
"""

import getpass

import psycopg

SQL = """
-- ---------- Catálogo ----------
CREATE TABLE IF NOT EXISTS locales (
    local_id     TEXT PRIMARY KEY,               -- 'local1', 'local2'
    nombre       TEXT NOT NULL,
    tipo         TEXT NOT NULL CHECK (tipo IN ('planta', 'oficinas'))
);

CREATE TABLE IF NOT EXISTS dispositivos (
    device_id    TEXT PRIMARY KEY,               -- 'esp32-local-01'
    local_id     TEXT NOT NULL REFERENCES locales(local_id),
    tipo         TEXT NOT NULL,                  -- 'esp32', 'edge'
    descripcion  TEXT,
    activo       BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------- Umbrales de alerta (CONTEXTO.md §8.2) ----------
CREATE TABLE IF NOT EXISTS umbrales (
    local_id     TEXT NOT NULL REFERENCES locales(local_id),
    variable     TEXT NOT NULL,                  -- 'energia_kw', 'agua_m3_dia', 'uv'
    advertencia  NUMERIC,                        -- amarillo
    alerta       NUMERIC NOT NULL,               -- rojo
    unidad       TEXT NOT NULL,
    actualizado  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (local_id, variable)
);

-- ---------- Permisos por usuario ----------
-- cognito_sub = ID del usuario en Cognito (Cognito dice QUIÉN es; esta tabla, QUÉ puede hacer)
CREATE TABLE IF NOT EXISTS permisos_usuario (
    cognito_sub  TEXT PRIMARY KEY,
    usuario      TEXT NOT NULL UNIQUE,
    rol          TEXT NOT NULL,                  -- plantilla: operario, jefe, administrador
    permisos     TEXT[] NOT NULL,                -- ver_actual, reconocer_alertas, ...
    sedes        TEXT[] NOT NULL,                -- locales que puede ver
    actualizado  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Datos de ejemplo ----------
INSERT INTO locales VALUES
    ('local1', 'Planta / Taller', 'planta'),
    ('local2', 'Oficinas / Administración', 'oficinas')
ON CONFLICT DO NOTHING;

INSERT INTO dispositivos (device_id, local_id, tipo, descripcion) VALUES
    ('esp32-local-01', 'local1', 'esp32', 'Sensores de planta: energía, agua, UV y producción'),
    ('esp32-local-02', 'local2', 'esp32', 'Sensores de oficinas: climatización, iluminación y agua'),
    ('edge-local-01',  'local1', 'edge',  'Edge Gateway de la planta (Raspberry Pi)'),
    ('edge-local-02',  'local2', 'edge',  'Edge Gateway de oficinas (Raspberry Pi)')
ON CONFLICT DO NOTHING;

INSERT INTO umbrales (local_id, variable, advertencia, alerta, unidad) VALUES
    ('local1', 'energia_kw',  45,  55,  'kW'),     -- respaldo fijo mientras no hay 4 semanas de historia
    ('local1', 'agua_m3_dia', 12,  14,  'm3/dia'),
    ('local1', 'uv',          6,   8,   'UVI'),
    ('local2', 'energia_kw',  45,  55,  'kW'),
    ('local2', 'agua_m3_dia', 2,   2.5, 'm3/dia')
ON CONFLICT DO NOTHING;

-- Los cognito_sub de ejemplo se reemplazan por los reales (Cognito -> Users -> usuario -> "User ID (Sub)")
INSERT INTO permisos_usuario (cognito_sub, usuario, rol, permisos, sedes) VALUES
    ('REEMPLAZAR-sub-jefe.prueba', 'jefe.prueba', 'jefe',
        ARRAY['ver_actual','ver_alertas','ver_historico','ver_general','reconocer_alertas'],
        ARRAY['local1','local2']),
    ('REEMPLAZAR-sub-admin.prueba', 'admin.prueba', 'administrador',
        ARRAY['ver_actual','ver_alertas','ver_historico','ver_general','reconocer_alertas','modificar_umbrales','gestionar_usuarios'],
        ARRAY['local1','local2'])
ON CONFLICT DO NOTHING;
"""


def main():
    host = input("Endpoint de RDS (induplac-db.xxxx.us-east-1.rds.amazonaws.com): ").strip()
    clave = getpass.getpass("Clave de induplac_admin (no se ve al escribir): ")

    print("Conectando...")
    with psycopg.connect(host=host, port=5432, dbname="induplac", user="induplac_admin",
                         password=clave, sslmode="require", connect_timeout=10) as conn:
        conn.execute(SQL)
        conn.commit()
        print("Tablas creadas y datos cargados.\n")

        for tabla in ("locales", "dispositivos", "umbrales", "permisos_usuario"):
            n = conn.execute(f"SELECT count(*) FROM {tabla}").fetchone()[0]
            print(f"  {tabla:<18} {n} filas")

        print("\nUmbrales:")
        for fila in conn.execute("SELECT local_id, variable, advertencia, alerta, unidad FROM umbrales ORDER BY 1, 2"):
            print("  ", *fila)


if __name__ == "__main__":
    main()
