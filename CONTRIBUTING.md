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

## 🚧 Antes de empezar: reservar la tarea

1. Revisa [`docs/EN-CURSO.md`](docs/EN-CURSO.md). Si la tarea está **🟡 En curso** por otra persona, no la tomes.
2. Si está libre, resérvala (nombre, fecha, rama, estado 🟡) y haz push. **Es el único cambio que se puede subir directo a `main`**, y solo tocando ese archivo.
3. Si trabajas con una IA, pídele que lea [`AGENTS.md`](AGENTS.md) antes de empezar.

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
4. Abre el Pull Request en GitHub. La plantilla se carga sola; complétala indicando:
   - Qué cambiaste (lista concreta).
   - Por qué (número de la tarea en `docs/EN-CURSO.md`).
   - Cómo probar o validar los cambios.
5. Agrega una entrada con fecha en [`docs/notas-de-avance.md`](docs/notas-de-avance.md) dentro del mismo PR.
6. Cambia la tarea a **🔵 En revisión** en `docs/EN-CURSO.md` y **avisa en el grupo** con el link al PR.
7. Espera la revisión y aprobación antes de fusionar (*merge*). Después del merge, marca la tarea como **✅ Listo**.
