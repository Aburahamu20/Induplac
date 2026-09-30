# Guía de Contribución — Induplac IoT

¡Bienvenidos al repositorio de **Induplac IoT**! Para asegurar un flujo de desarrollo ordenado, profesional y colaborativo entre los integrantes del equipo, seguimos las siguientes directrices.

---

## 🌿 Flujo de Trabajo en Git

1. **La rama `main` es sagrada:**
   - No se realizan commits directos sobre la rama `main`.
   - Todos los cambios se integran mediante **Pull Requests (PR)** previamente revisados.
2. **Creación de ramas temáticas:**
   - Las ramas deben nombrarse según el tipo de trabajo:
     - `feature/nombre-de-la-funcionalidad` (ej. `feature/dashboard-local1`, `feature/mqtt-wokwi`)
     - `fix/descripcion-del-bug` (ej. `fix/sqlite-sync-error`)
     - `docs/nombre-del-documento` (ej. `docs/ciberseguridad`)
3. **Formato de Commits (Conventional Commits):**
   - Utilizar mensajes claros con prefijos convencionales:
     - `feat:` Nueva funcionalidad o módulo.
     - `fix:` Corrección de errores.
     - `docs:` Cambios o incorporaciones a la documentación.
     - `refactor:` Mejoras en la estructura del código sin cambiar comportamiento.
     - `test:` Casos de prueba y validaciones.

---

## 🔒 Política de Seguridad y Secretos

> [!CAUTION]
> **Prohibido subir credenciales o archivos de entorno al repositorio.**

- **Nunca** incluir en commits:
  - Archivos `.env` con credenciales de AWS o contraseñas de bases de datos.
  - Certificados TLS o llaves privadas (`.pem`, `.key`).
  - Archivos de bases de datos locales (`.sqlite`, `.db`).
- Todo secret o variable sensible debe definirse mediante variables de entorno locales referenciadas en un archivo de plantilla `.env.example`.

---

## 📋 Proceso para Enviar un Pull Request

1. Actualiza tu rama con los últimos cambios de `main`:
   ```bash
   git checkout feature/tu-rama
   git pull origin main
   ```
2. Realiza tus cambios y haz commits atómicos y descriptivos.
3. Haz push a tu rama en GitHub:
   ```bash
   git push -u origin feature/tu-rama
   ```
4. Abre el Pull Request en GitHub indicando:
   - Resumen de los cambios realizados.
   - Motivación o problema que resuelve.
   - Cómo probar o validar los cambios.
5. Espera la revisión y aprobación antes de fusionar (*merge*).
