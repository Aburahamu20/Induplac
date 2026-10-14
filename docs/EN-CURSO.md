# 🚧 Tablero de Trabajo en Curso — Induplac IoT

> **Para qué sirve:** que nadie (persona o IA) rehaga algo que otro ya está haciendo.
> **Regla de oro:** antes de empezar una tarea, **reservarla aquí y hacer push**. Al terminar, marcarla como lista.

---

## Cómo usarlo

1. `git pull` para tener la versión más reciente de este archivo.
2. Busca la tarea en la tabla:
   - Si está **🟢 Libre**, reservala: pon tu nombre, la fecha, la rama y cambia el estado a **🟡 En curso**. Haz commit y **push de inmediato**, antes de empezar a trabajar.
   - Si está **🟡 En curso** por otra persona, **no la tomes**. Coordina con quien la tiene.
   - Si no existe, agrégala como fila nueva.
3. Trabaja en tu propia rama (`feat/...` o `docs/...`), nunca directo sobre lo que otro tiene reservado.
4. Al terminar: estado **✅ Listo**, link al PR o commit, y una entrada en [`docs/notas-de-avance.md`](notas-de-avance.md).
5. Si una tarea lleva **más de 7 días** en curso sin cambios, pregunta en el grupo antes de tomarla.

**Estados:** 🟢 Libre · 🟡 En curso · 🔵 En revisión (PR abierto) · ✅ Listo · ⛔ Bloqueado (explicar por qué)

---

## Tareas

| # | Tarea | Carpeta | Estado | Quién | Desde | Rama / PR | Notas |
|---|---|---|---|---|---|---|---|
| 1 | Dashboard React (monitor por sede, alertas, histórico, panel de simulación) con datos simulados | `dashboard/` | 🟡 En curso | Abraham (con Claude) | 2026-10-14 | `feat/dashboard` | Primero la simulación del dashboard con datos ficticios; no depende del broker. |
| 2 | Crear y configurar broker MQTT de la simulación | — | ⛔ Bloqueado | | | | Falta confirmar EMQX Serverless vs. HiveMQ (ver notas 2026-10-14). |
| 3 | Sketch ESP32 en Wokwi (sensores virtuales, NTP, JSON por MQTT) | `simulation/` | ⛔ Bloqueado | | | | Depende de la tarea 2. |
| 4 | Agente Edge en Python (MQTT → SQLite → intervalos 15 min → alertas → sync) | `edge/` | ⛔ Bloqueado | | | | Depende de la tarea 2. |
| 5 | Backend AWS: Lambda de ingesta y alertas, DynamoDB, RDS, API | `backend/` | 🟢 Libre | | | | |
| 6 | Cognito con MFA (probar primero que el Learner Lab lo permita) | `backend/` | 🟢 Libre | | | | |
| 7 | Actualizar secciones 14 y 15 del `README.md` al diseño vigente | raíz | 🟢 Libre | | | | Hoy muestran el diseño anterior. |
| 8 | Identificador por lectura (`device_id + seq`) entre ESP32 y Edge | `simulation/`, `edge/` | 🟢 Libre | | | | Definir junto con las tareas 3 y 4. |

---

## Historial de tareas terminadas

| Tarea | Quién | Fecha | PR / commit |
|---|---|---|---|
| Integrar decisiones cloud del equipo en la documentación | Abraham (con Claude) | 2026-10-08 | PR #3 |
| Guía del Equipo (`docs/GUIA-EQUIPO.md`) | Abraham (con Claude) | 2026-10-13 | 8c5eae6 |
| Registrar respuestas del equipo (Wokwi, offline, agua, VPN) | Abraham (con Claude) | 2026-10-14 | e47d2f2 |
