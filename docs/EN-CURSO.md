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
3. Trabaja en tu propia rama (`feature/...`, `fix/...` o `docs/...`) y entrega todo por **Pull Request** con la plantilla (qué cambiaste, por qué, cómo probarlo). **Nadie hace commit directo en `main`**, salvo para reservar o cambiar estados en este archivo.
4. Al abrir el PR: estado **🔵 En revisión** con el link. Al hacer merge: **✅ Listo**, y una entrada en [`docs/notas-de-avance.md`](notas-de-avance.md). Avisa en el grupo.
5. Si una tarea lleva **más de 7 días** en curso sin cambios, pregunta en el grupo antes de tomarla.

**Estados:** 🟢 Libre · 🟡 En curso · 🔵 En revisión (PR abierto) · ✅ Listo · ⛔ Bloqueado (explicar por qué)

---

## 🔥 Para hoy (2026-10-14)

1. **Tarea 9:** definir roles, fortalezas y responsabilidades. **Es lo primero:** sin roles no hay RACI ni Gantt.
2. **Tarea 10:** matriz RACI con los roles definidos.
3. **Tarea 2:** crear el broker EMQX (Abraham).
4. Cada integrante **elige y reserva** al menos una tarea de la Nota 2 (tabla de abajo).

La pauta completa de la Nota 2 y los borradores de roles, RACI y Gantt están en [`docs/NOTA-2.md`](NOTA-2.md).

---

## Tareas

| # | Tarea | Carpeta | Estado | Quién | Desde | Rama / PR | Notas |
|---|---|---|---|---|---|---|---|
| 1 | Dashboard React (monitor por sede, alertas, histórico, panel de simulación) con datos simulados | `dashboard/` | 🟡 En curso | Abraham (con Claude) | 2026-10-14 | `feature/dashboard` | Primero la simulación del dashboard con datos ficticios; no depende del broker. |
| 3 | Sketch ESP32 en Wokwi (sensores virtuales, NTP, JSON por MQTT) | `simulation/` | 🟡 En curso | Sebastián Fuentes | 2026-10-16 | — | Necesita el broker (tarea 2) y acordar el JSON con quien haga el Edge (tarea 4). |
| 4 | Agente Edge en Python (MQTT → SQLite → intervalos 15 min → alertas → sync) | `edge/` | 🟡 En curso | Abraham (con Claude) | 2026-10-17 | `feature/edge` | Broker listo y probado: ver `docs/broker-mqtt.md` (PR #9). Debe exponer la API de `docs/api-dashboard.md`. |
| 5 | Backend AWS: Lambda de ingesta y alertas, DynamoDB, RDS, API | `backend/` | 🟡 En curso | Abraham y Felipe Murúa | 2026-10-17 | `feature/backend-aws` | Debe exponer la API de `docs/api-dashboard.md`. |
| 6 | Cognito con MFA (probar primero que el Learner Lab lo permita) | `backend/` | 🟢 Libre | | | | |
| 8 | Identificador por lectura (`device_id + seq`) entre ESP32 y Edge | `simulation/`, `edge/` | 🟢 Libre | | | | Definir junto con las tareas 3 y 4. |

---

## Nota 2 — Entregables

Pauta del profesor: ver [`docs/NOTA-2.md`](NOTA-2.md). Lo marcado con 🔥 es para hoy.

| # | Tarea | Pauta | Estado | Quién | Desde | Rama / PR | Notas |
|---|---|---|---|---|---|---|---|
| 9 | Roles del equipo: rol principal/secundario, fortalezas y responsabilidades de cada integrante | 2 | ✅ Listo | Bárbara Saavedra (`barbaraantoniaa`) | 2026-10-18 | PR #11 | En `docs/roles-raci-gantt.md` §1. **Falta:** que cada uno escriba su fortaleza y que Lisandra confirme su rol. Vale 15 %. |
| 10 | Matriz RACI (6–10 actividades, cada una con R y un solo A) | 3 | ✅ Listo | Bárbara Saavedra (`barbaraantoniaa`) | 2026-10-18 | PR #11 | En `docs/roles-raci-gantt.md` §2 (10 actividades). |
| 11 | Modelo Cloud (híbrido + serverless/PaaS) y tabla de tecnologías con su aporte concreto | 6, 7 | ✅ Listo | Bárbara Saavedra (`barbaraantoniaa`) | 2026-10-19 | PR #13 | En `docs/cloud-tecnologias.md`. |
| 12 | Pipeline DevOps: diagrama + GitHub Actions que compile/pruebe en cada PR | 8 | 🟢 Libre | | | | Si se implementa de verdad, sirve como evidencia. |
| 13 | Planificación: Scrum del MVP (backlog, sprints) + PMI con las 5 fases | 9 | ✅ Listo | Bárbara Saavedra (`barbaraantoniaa`) | 2026-10-14 | PR #12 | En `docs/scrum-pmi.md`. **Falta:** definir Product Owner y Scrum Master, y si hubo reuniones fijas (§4). |
| 14 | Carta Gantt hasta la puesta en marcha (responsables, duración, dependencias, hitos) | 10 | ✅ Listo | Bárbara Saavedra (`barbaraantoniaa`) | 2026-10-14 | PR #11 | En `docs/roles-raci-gantt.md` §3. RDS agregado el 19/10 (PR #15). |
| 15 | Conclusiones y defensa: problema, beneficios, limitaciones, siguientes pasos | 12 | ✅ Listo | Bárbara Saavedra (`barbaraantoniaa`) | 2026-10-19 | PR #14 | En `docs/conclusiones.md` (incluye preguntas probables de la defensa). |
| 16 | Informe del proyecto actualizado | 13 | 🟢 Libre | | | | Confirmar formato (¿Word?) y si existe el de la Nota 1. |
| 17 | Presentación PowerPoint (consolida todo, en el orden que pide el profe) | 1 | 🟢 Libre | | | | Al final; depende de casi todo. |
| 18 | Guion y ensayo de la demo del prototipo | 11 | 🟢 Libre | | | | Depende de las tareas 1 a 4. |

---

## Historial de tareas terminadas

| Tarea | Quién | Fecha | PR / commit |
|---|---|---|---|
| Integrar decisiones cloud del equipo en la documentación | Abraham (con Claude) | 2026-10-08 | PR #3 |
| Guía del Equipo (`docs/GUIA-EQUIPO.md`) | Abraham (con Claude) | 2026-10-13 | 8c5eae6 |
| Registrar respuestas del equipo (Wokwi, offline, agua, VPN) | Abraham (con Claude) | 2026-10-14 | e47d2f2 |
| Tablero EN-CURSO, AGENTS.md y reglas de Pull Request | Abraham (con Claude) | 2026-10-14 | PR #4 |
| Registrar EMQX Serverless como broker | Abraham (con Claude) | 2026-10-14 | PR #5 |
| Base del dashboard (Vite + React + TS + Tailwind) | Abraham (con Claude) | 2026-10-14 | PR #6 |
| Pauta de la Nota 2 y borradores de roles, RACI, PMI y Gantt | Abraham (con Claude) | 2026-10-14 | PR #7 |
| Contrato de datos del dashboard, login, permisos y hora sin internet (tarea 19) | Abraham (con Claude) | 2026-10-18 | PR #8 |
| Broker MQTT EMQX Serverless creado y probado (tarea 2) | Abraham (con Claude) | 2026-10-18 | PR #9 |
| README principal actualizado al diseño vigente (tarea 7) | Abraham (con Claude) | 2026-10-18 | PR #10 |
| Roles, RACI y Carta Gantt (tareas 9, 10 y 14) | Bárbara Saavedra | 2026-10-19 | PR #11 |
| Planificación Scrum del MVP + PMI (tarea 13) | Bárbara Saavedra (con Claude) | 2026-10-19 | PR #12 |
| Modelo Cloud y tecnologías con su aporte (tarea 11) | Bárbara Saavedra (con Claude) | 2026-10-19 | PR #13 |
| Conclusiones y defensa (tarea 15) | Bárbara Saavedra (con Claude) | 2026-10-19 | PR #14 |
| Gantt, RACI y cargos actualizados con RDS + Excel con tareas por integrante | Bárbara Saavedra (con Claude) | 2026-10-19 | PR #15 |
