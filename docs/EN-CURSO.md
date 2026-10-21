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

## 🔥 Para hoy (2026-10-21) — Demo

1. **Felipe:** iniciar el Learner Lab temprano y revisar que RDS esté *Available*.
2. **30 min antes:** Wokwi (Sebastián) + Edge (Abraham) corriendo para tener datos frescos. Plan B: `edge/simular_esp32.py`.
3. Revisar: dashboard en S3, `/health` y `/config/umbrales`.
4. Ensayar el showcase: corte de red → alerta → reconexión sin duplicados.
5. ~~**Bárbara (con Claude):** revisar la lista de la nota de avance *2026-10-21 (madrugada)*~~ → hecho en el PR #25 (Gantt, RACI, tareas, Cloud, Scrum y conclusiones al día). Lo de Lisandra sigue pendiente.
6. Nota 2 pendiente: guion de la demo (18), PowerPoint (17), pipeline DevOps (12), informe (16) y la fortaleza de Lisandra.

La pauta completa de la Nota 2 y los borradores de roles, RACI y Gantt están en [`docs/NOTA-2.md`](NOTA-2.md).

---

## Tareas

| # | Tarea | Carpeta | Estado | Quién | Desde | Rama / PR | Notas |
|---|---|---|---|---|---|---|---|
| 1 | Dashboard React (monitor por sede, alertas, histórico, panel de simulación) con datos simulados | `dashboard/` | ✅ Listo | Abraham (con Claude) | 2026-10-14 | PR #18 | Publicado en S3 leyendo de AWS. Login con clave temporal, MFA TOTP y permisos por usuario. |
| 3 | Sketch ESP32 en Wokwi (sensores virtuales, NTP, JSON por MQTT) | `simulation/` | ✅ Listo | Sebastián Fuentes | 2026-10-16 | PR #16 | Publica al broker EMQX y el Edge recibe sus lecturas (probado el 20/10). Código en `simulation/wokwi-local1/`. |
| 4 | Agente Edge en Python (MQTT → SQLite → intervalos 15 min → alertas → sync) | `edge/` | ✅ Listo | Abraham (con Claude) | 2026-10-17 | PR #18 | Probado con Wokwi y con el simulador: alertas offline y cola de pendientes. Falta la API local para el dashboard de planta. |
| 5 | Backend AWS: Lambda de ingesta y alertas, DynamoDB, RDS, API | `backend/` | ✅ Listo | Abraham y Felipe Murúa | 2026-10-17 | PR #16, #18 | `induplac-api` + DynamoDB + S3; RDS con la configuración y Lambda `induplac-config` (`/config/umbrales`). Pendiente: que `induplac-api` lea los umbrales desde RDS. |
| 6 | Cognito con MFA (probar primero que el Learner Lab lo permita) | `backend/`, `dashboard/` | 🟡 En curso | Abraham y Felipe Murúa | 2026-10-20 | PR #16 | **Funciona en el Learner Lab** (user pool, clave temporal y MFA TOTP probados). Falta conectarlo al dashboard (después de la demo). |
| 8 | Identificador por lectura (`device_id + seq`) entre ESP32 y Edge | `simulation/`, `edge/` | ✅ Listo | Abraham y Sebastián | 2026-10-20 | PR #16, #18 | El ESP32 manda `device_id + seq + ts`; el Edge descarta duplicados con esa llave, también tras reinicios. |

---

## Nota 2 — Entregables

Pauta del profesor: ver [`docs/NOTA-2.md`](NOTA-2.md). Lo marcado con 🔥 es para hoy.

| # | Tarea | Pauta | Estado | Quién | Desde | Rama / PR | Notas |
|---|---|---|---|---|---|---|---|
| 9 | Roles del equipo: rol principal/secundario, fortalezas y responsabilidades de cada integrante | 2 | ✅ Listo | Bárbara Saavedra (`barbaraantoniaa`) | 2026-10-18 | PR #11 | En `docs/roles-raci-gantt.md` §1. Fortalezas escritas (21/10). **Falta:** la fortaleza y el rol de Lisandra. Vale 15 %. |
| 10 | Matriz RACI (6–10 actividades, cada una con R y un solo A) | 3 | ✅ Listo | Bárbara Saavedra (`barbaraantoniaa`) | 2026-10-18 | PR #11 | En `docs/roles-raci-gantt.md` §2 (10 actividades). |
| 11 | Modelo Cloud (híbrido + serverless/PaaS) y tabla de tecnologías con su aporte concreto | 6, 7 | ✅ Listo | Bárbara Saavedra (`barbaraantoniaa`) | 2026-10-19 | PR #13 | En `docs/cloud-tecnologias.md`. |
| 12 | Pipeline DevOps: diagrama + GitHub Actions que compile/pruebe en cada PR | 8 | 🔵 En revisión | Abraham (con Claude) | 2026-10-21 | `feature/pipeline-devops` | `docs/devops.md`, `ci.yml` (dashboard, Python + 15 pruebas del Edge, secretos) y `deploy.yml` (manual por el Learner Lab). |
| 13 | Planificación: Scrum del MVP (backlog, sprints) + PMI con las 5 fases | 9 | ✅ Listo | Bárbara Saavedra (`barbaraantoniaa`) | 2026-10-14 | PR #12 | En `docs/scrum-pmi.md`. PO: Abraham · SM: Bárbara (21/10). **Falta:** si hubo reuniones fijas (§4). |
| 14 | Carta Gantt hasta la puesta en marcha (responsables, duración, dependencias, hitos) | 10 | ✅ Listo | Bárbara Saavedra (`barbaraantoniaa`) | 2026-10-14 | PR #11 | En `docs/roles-raci-gantt.md` §3. RDS agregado el 19/10 (PR #15). Columna *Estado*, pipeline y MVP de punta a punta el 21/10 (PR #25). |
| 15 | Conclusiones y defensa: problema, beneficios, limitaciones, siguientes pasos | 12 | ✅ Listo | Bárbara Saavedra (`barbaraantoniaa`) | 2026-10-19 | PR #14 | En `docs/conclusiones.md` (incluye preguntas probables de la defensa). |
| 16 | Informe del proyecto actualizado | 13 | 🟡 En curso | Bárbara Saavedra (`barbaraantoniaa`) | 2026-10-21 | Claude Docs | Borrador como documento de Claude (se descarga en Word o PDF). Falta confirmar el formato con el profe y si existe el de la Nota 1. |
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
| RDS + Lambda `induplac-config`, Cognito probado y Wokwi conectado (tareas 3, 5 y 6) | Abraham y Felipe (con Claude), Sebastián | 2026-10-20 | PR #16 |
| Corrección: alertas en DynamoDB, cuentas en Cognito y RDS solo configuración | Abraham (con Claude) | 2026-10-21 | PR #17 |
| Código del Edge, dashboard y backend subido a `main` (tareas 1, 4 y 5) | Abraham (con Claude) | 2026-10-21 | PR #18 |
| Nota 2 al día con lo del 20/10: Gantt con Estado, RACI, tareas, Cloud, Scrum y conclusiones | Bárbara Saavedra (con Claude) | 2026-10-21 | PR #25 |
