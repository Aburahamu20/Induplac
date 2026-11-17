# 🚧 Tablero de Trabajo en Curso — Induplac IoT

> **Para qué sirve:** que nadie (persona o IA) rehaga algo que otro ya está haciendo.
> **Regla de oro:** antes de empezar una tarea, **reservarla aquí y hacer push**. Al terminar, marcarla como lista.

---

## Cómo usarlo

1. `git pull` para tener la versión más reciente de este archivo.
2. Busca la tarea en la tabla:
   - Si está **🟢 Libre**, resérvala antes de empezar: pon tu nombre, la fecha y la rama, crea tu rama, cambia la tarea a 🟡 como **primer commit**, haz push y abre el PR de inmediato (puede ser *draft*) para que el equipo vea la reserva. Desde el 13/11 `main` está protegida y rechaza commits directos; si no puedes abrir el PR, pídele la reserva a Abraham (admin).
   - Si está **🟡 En curso** por otra persona, **no la tomes**. Coordina con quien la tiene.
   - Si no existe, agrégala como fila nueva.
3. Trabaja en tu propia rama (`feature/...`, `fix/...` o `docs/...`) y entrega todo por **Pull Request** con la plantilla (qué cambiaste, por qué, cómo probarlo). **Nadie hace commit directo en `main`** (la regla `proteger-main` lo bloquea).
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
6. Pendiente: guion de la demo (18), PowerPoint (17), pipeline DevOps (12), informe (16) y la fortaleza de Lisandra.

La pauta completa y los borradores de roles, RACI y Gantt están en [`docs/pauta-entrega.md`](pauta-entrega.md).

---

## Tareas

> **Reparto (2026-10-27):** Abraham y Felipe ven toda la configuración de AWS y las tareas 20 a 22; Sebastián, Wokwi; Bárbara y Lisandra, la documentación.

| # | Tarea | Carpeta | Estado | Quién | Desde | Rama / PR | Notas |
|---|---|---|---|---|---|---|---|
| 1 | Dashboard React (monitor por sede, alertas, histórico, panel de simulación) con datos simulados | `dashboard/` | ✅ Listo | Abraham (con Claude) | 2026-10-14 | PR #18 | Publicado en S3 leyendo de AWS. Login con clave temporal, MFA TOTP y permisos por usuario. |
| 3 | Sketch ESP32 en Wokwi (sensores virtuales, NTP, JSON por MQTT) | `simulation/` | ✅ Listo | Sebastián Fuentes | 2026-10-16 | PR #16 | Publica al broker EMQX y el Edge recibe sus lecturas (probado el 20/10). Código en `simulation/wokwi-local1/`. |
| 4 | Agente Edge en Python (MQTT → SQLite → intervalos 15 min → alertas → sync) | `edge/` | ✅ Listo | Abraham (con Claude) | 2026-10-17 | PR #18 | Probado con Wokwi y con el simulador: alertas offline y cola de pendientes. |
| 5 | Backend AWS: Lambda de ingesta y alertas, DynamoDB, RDS, API | `backend/` | ✅ Listo | Abraham y Felipe Murúa | 2026-10-17 | PR #16, #18 | `induplac-api` + DynamoDB + S3; RDS con la configuración y Lambda `induplac-config` (`/config/umbrales`). Pendiente: que `induplac-api` lea los umbrales desde RDS. |
| 6 | Cognito con MFA (probar primero que el Learner Lab lo permita) | `backend/`, `dashboard/` | ✅ Listo | Abraham y Felipe Murúa | 2026-10-20 | PR #16, #20 | Dashboard en S3 con login de Cognito y MFA (21/10). Grupos `administrador`, `jefe` y `operario` con las cuentas del equipo. |
| 8 | Identificador por lectura (`device_id + seq`) entre ESP32 y Edge | `simulation/`, `edge/` | ✅ Listo | Abraham y Sebastián | 2026-10-20 | PR #16, #18 | El ESP32 manda `device_id + seq + ts`; el Edge descarta duplicados con esa llave, también tras reinicios. |
| 20 | Validar el token de Cognito en la API: authorizer JWT en API Gateway (`/api/*` y `/config/*`), token en el dashboard y reconocer alertas solo jefe/admin | `backend/`, `dashboard/` | ✅ Listo | Abraham y Felipe Murúa | 2026-10-27 | — | `/intervalos` (clave del Edge) y `/health` quedan sin authorizer. **02/11:** authorizer `cognito-jwt` puesto en `ANY /api/{proxy+}` (con `OPTIONS /api/{proxy+}` sin authorizer para CORS) y reconocer alertas solo jefe/admin de su sede (tarea 27). Falta: `/config/*` (Fase 3, junto a umbrales). **17/11:** `/config/*` revisado en API Gateway (GET y PUT con `cognito-jwt`, OPTIONS sin authorizer); sin token responde `401`; Felipe confirmó que Umbrales guarda bien. |
| 21 | Umbrales desde RDS: `induplac-config` los copia a DynamoDB al cambiarlos e `induplac-api` los lee de ahí (valores por defecto si no hay) | `backend/` | ✅ Listo | Abraham y Felipe Murúa | 2026-10-27 | PR #42 (dentro de la tarea 28, parte 4) | Desplegado y probado con datos reales el 04/11 (la auditoría registra "Copió 5 umbrales de RDS a DynamoDB"). El Edge todavía usa umbrales fijos: ver tarea 44. |
| 22 | API local del Edge: mismos endpoints de `api-dashboard.md` leyendo SQLite + servir el build del dashboard de planta, con login local | `edge/` | ✅ Listo | Abraham y Felipe Murúa | 2026-10-27 | [PR #30](https://github.com/Aburahamu20/Induplac/pull/30) | API local + login de planta con MFA y panel de demo. Pendiente: usuarios desde RDS. |
| 23 | Simulación en Wokwi | `simulation/` | 🟡 En curso | Sebastián Fuentes | 2026-10-27 | — | Alcance por definir con Sebastián. |
| 24 | Documentación del proyecto al día | `docs/` | ✅ Listo | Bárbara Saavedra y Lisandra González | 2026-10-27 | [PR #63](https://github.com/Aburahamu20/Induplac/pull/63) | Alcance (14/11): los documentos de Bárbara al día con lo construido hasta el 14/11 (`cloud-tecnologias`, `conclusiones`, `scrum-pmi`, `roles-raci-gantt`). |
| 25 | Pruebas en el Learner Lab para los bocetos aprobados: atributo `custom:sede` en Cognito, crear/desactivar usuarios desde Lambda (LabRole) y PITR + protección contra borrado en DynamoDB | `backend/` | ✅ Listo | Abraham y Felipe Murúa | 2026-11-01 | — | Probado el 02/11 en la consola del lab de Felipe: `custom:sede` creado (String, mutable); usuario de prueba creado, con sede, en grupo `operario` y desactivado; PITR (35 días) y protección contra eliminación activados en una tabla de prueba. El grupo de usuarios exige email y hoy tiene MFA obligatorio para todos. Falta confirmar con código que la Lambda (LabRole) pueda usar las funciones admin de Cognito. |
| 26 | Roles nuevos en Cognito: `admin-general`, `admin-sede`, `jefe`, `operario` + sede por usuario | `backend/` `dashboard/` | ✅ Listo | Abraham y Felipe Murúa | 2026-11-02 | [PR #33](https://github.com/Aburahamu20/Induplac/pull/33) | Fase 1. 4 grupos en Cognito y `custom:sede` (`planta`/`oficinas`/`todas`, solo lectura). Desplegado en S3 y probado con los 4 casos el 02/11. Grupo `administrador` borrado. Pendiente: decidir MFA (todos o solo jefes/admins); validar grupo y sede en la API (Fase 3, tarea 28). |
| 27 | Auditoría: tabla `induplac-auditoria` (solo agregar, hash encadenado, PITR) + `GET /api/auditoria` filtrado por sede | `backend/` | ✅ Listo | Abraham y Felipe Murúa | 2026-11-02 | PR #36, #37, #38 | Fases 2 y 3. Authorizer JWT en `ANY /api/{proxy+}`; tabla con PITR y protección contra eliminación. Probado en AWS el 02/11: reconocer una alerta guarda el registro (usuario, acción, hash) y la cabecera de la cadena. Falta: pantalla de auditoría (tarea 30) y auditar umbrales/usuarios (tarea 28). |
| 28 | Endpoints nuevos: reconocer alerta con comentario, usuarios (crear/desactivar/reenviar) y simulación de umbrales | `backend/` | ✅ Listo | Abraham y Felipe Murúa | 2026-11-03 | PR #39, #40, #41, #42, #43 | Fase 3 completa: (1) datos filtrados por sede; (2) usuarios; (3) reconocer con comentario, una sola vez; (4) umbrales: RDS manda + copia en DynamoDB `induplac-umbrales`, simulación, `/config/*` con authorizer. Probado en AWS el 03/11: se copiaron los umbrales, la simulación funciona y el cambio de umbral queda en RDS, en la copia y en la auditoría. También se arregló la conexión a RDS (scramp, PR #43) y el CORS de API Gateway ahora permite PUT y PATCH. |
| 29 | Edge: auditoría local en SQLite que se sube al reconectar | `edge/` | 🟡 En curso | Abraham y Felipe Murúa | 2026-11-03 | PR #44 (mergeado) | Fase 4. Código listo y con pruebas (Edge: 61, nube: 46). Falta: deploy de `lambdas` y prueba de punta a punta con el Edge corriendo (cortar el enlace, reconocer, reconectar y ver `origen = edge` en `induplac-auditoria`), para hacerla en el ensayo de la demo. |
| 30 | Dashboard: llevar los bocetos aprobados al React (menú nuevo, 7 pantallas por rol) | `dashboard/` | ✅ Listo | Abraham y Felipe Murúa | 2026-11-03 | PR #45–#58 | Fase 5 completa: menú, histórico, umbrales, usuarios, auditoría y estado de las sedes, más letra más grande. Probado en la nube el 04/11 con datos y cuentas reales. Bocetos: canvas de Claude Design (respaldo versión 1793325632-2eca). Siguiente: PWA (instalable + push de alertas). |
| 31 | MFA por rol: obligatorio para jefes y admins, opcional para operarios (Cognito en modo Opcional + el dashboard obliga el registro) | `dashboard/` | ✅ Listo | Abraham y Felipe Murúa | 2026-11-02 | [PR #35](https://github.com/Aburahamu20/Induplac/pull/35) (mergeado) | Desplegado (Deploy #2) y user pool en Opcional el 02/11. **Probado el 17/11** por Abraham y Felipe con cuentas nuevas `jefe` y `operario`: funciona según lo esperado. |
| 44 | Edge: descargar los umbrales de la nube al sincronizar (hoy usa los suyos, fijos) y usarlos para las alertas offline | `edge/` | 🟡 En curso | Abraham Castro | 2026-11-14 | — | Pendiente de empezar. La copia vigente está en `GET /api/umbrales` (ver `backend/lambda_api/umbrales.py`); con la última copia guardada en SQLite si no hay internet. |

---

## Entregables

Pauta del profesor: ver [`docs/pauta-entrega.md`](pauta-entrega.md). Lo marcado con 🔥 es para hoy.

| # | Tarea | Pauta | Estado | Quién | Desde | Rama / PR | Notas |
|---|---|---|---|---|---|---|---|
| 9 | Roles del equipo: rol principal/secundario, fortalezas y responsabilidades de cada integrante | 2 | ✅ Listo | Bárbara Saavedra (`barbaraantoniaa`) | 2026-10-18 | PR #11 | En `docs/roles-raci-gantt.md` §1. Fortalezas escritas (21/10). **Falta:** la fortaleza y el rol de Lisandra. Vale 15 %. |
| 10 | Matriz RACI (6–10 actividades, cada una con R y un solo A) | 3 | ✅ Listo | Bárbara Saavedra (`barbaraantoniaa`) | 2026-10-18 | PR #11 | En `docs/roles-raci-gantt.md` §2 (10 actividades). |
| 11 | Modelo Cloud (híbrido + serverless/PaaS) y tabla de tecnologías con su aporte concreto | 6, 7 | ✅ Listo | Bárbara Saavedra (`barbaraantoniaa`) | 2026-10-19 | PR #13 | En `docs/cloud-tecnologias.md`. |
| 12 | Pipeline DevOps: diagrama + GitHub Actions que compile/pruebe en cada PR | 8 | 🔵 En revisión | Abraham (con Claude) | 2026-10-21 | `feature/pipeline-devops` | `docs/devops.md`, `ci.yml` (dashboard, Python + 15 pruebas del Edge, secretos) y `deploy.yml` (manual por el Learner Lab). |
| 13 | Planificación: Scrum del MVP (backlog, sprints) + PMI con las 5 fases | 9 | ✅ Listo | Bárbara Saavedra (`barbaraantoniaa`) | 2026-10-14 | PR #12 | En `docs/scrum-pmi.md`. PO: Abraham · SM: Bárbara (21/10). **Falta:** si hubo reuniones fijas (§4). |
| 14 | Carta Gantt hasta la puesta en marcha (responsables, duración, dependencias, hitos) | 10 | ✅ Listo | Bárbara Saavedra (`barbaraantoniaa`) | 2026-10-14 | PR #11 | En `docs/roles-raci-gantt.md` §3. RDS agregado el 19/10 (PR #15). Columna *Estado*, pipeline y MVP de punta a punta el 21/10 (PR #25). |
| 15 | Conclusiones y defensa: problema, beneficios, limitaciones, siguientes pasos | 12 | ✅ Listo | Bárbara Saavedra (`barbaraantoniaa`) | 2026-10-19 | PR #14 | En `docs/conclusiones.md` (incluye preguntas probables de la defensa). |
| 16 | Informe del proyecto actualizado | 13 | ✅ Listo | Bárbara Saavedra (`barbaraantoniaa`) | 2026-10-21 | Claude Docs + Word | Entregado al profesor (Nota 2), confirmado por Bárbara el 14/11. |
| 17 | Presentación PowerPoint (consolida todo, en el orden que pide el profe) | 1 | 🔵 En revisión | Bárbara Saavedra (`barbaraantoniaa`) | 2026-10-21 | Claude Slides | 10 diapositivas con notas para quien presenta; se descarga en .pptx o PDF. Bárbara la comparte con el grupo. |
| 18 | Guion y ensayo de la demo del prototipo | 11 | 🔵 Guion listo, falta el ensayo | Bárbara Saavedra (`barbaraantoniaa`) | 2026-11-17 | [PR #68](https://github.com/Aburahamu20/Induplac/pull/68) | [PR #68](https://github.com/Aburahamu20/Induplac/pull/68). Guion en `docs/nota-3/guion-demo.md`. Ensayo el 24/11 con todo el equipo. |
| 32 | DevSecOps (Nota 3, actividad 3.2.2): revisión de dependencias, SAST y DAST con ZAP en el CI + quality gate | 8 | ✅ Listo | Abraham (con Claude) | 2026-11-05 | [PR #59](https://github.com/Aburahamu20/Induplac/pull/59) | npm audit, pip-audit, Bandit + Semgrep y ZAP baseline contra el build del dashboard. |
| 33 | Nota 3 · Ansible (actividad 3.3.1): inventario con el Edge, ping, playbook baseline e idempotencia, con capturas | Pipeline (2) | ✅ Listo | Abraham Castro y Felipe Murúa | 2026-11-17 | [PR #64](https://github.com/Aburahamu20/Induplac/pull/64) | Playbook corrido en las 2 EC2 (17/11): ping OK, 1ª pasada `changed=9`, 2ª `changed=0`. Capturas en `docs/nota-3/img/ansible-*.png`. |
| 34 | Nota 3 · API REST: diagrama cliente-servidor + demo de envío y consulta con curl/Postman | API REST (3) | 🟢 Libre | | | | Sugerido: Abraham y Felipe. Detalle en [`nota-3.md`](nota-3.md). |
| 35 | Nota 3 · Backend: recibe → valida → procesa → almacena → entrega, y por qué Lambda | Backend (4) | 🟢 Libre | | | | Sugerido: Felipe. Detalle en [`nota-3.md`](nota-3.md). |
| 36 | Nota 3 · 5 Porqués del problema de Induplac | Problema (1) | 🟢 Libre | | | | Sugerido: Lisandra. Detalle en [`nota-3.md`](nota-3.md). |
| 37 | Nota 3 · Product Backlog con historias de usuario priorizadas + EN-CURSO como Kanban | Ágil/Lean (5) | ✅ Listo | Bárbara Saavedra (`barbaraantoniaa`) | 2026-11-14 | [PR #62](https://github.com/Aburahamu20/Induplac/pull/62) | `docs/nota-3/backlog.md`: 21 historias de usuario con MoSCoW, 7 sprints y EN-CURSO como Kanban con principios Lean. |
| 38 | Nota 3 · Roadmap de transferencia tecnológica (validación a mejora continua) | Transferencia (6) | 🟢 Libre | | | | Sugerido: Lisandra. Detalle en [`nota-3.md`](nota-3.md). |
| 39 | Nota 3 · SIPOC o diagrama de afinidad + qué decisiones cambió | Gestión del equipo (7) | ✅ Listo | Bárbara Saavedra (`barbaraantoniaa`) | 2026-11-14 | [PR #62](https://github.com/Aburahamu20/Induplac/pull/62) | `docs/nota-3/gestion-equipo.md`: lluvia de ideas (07/10) + diagrama de afinidad de 6 temas y las decisiones que cambió. |
| 40 | Nota 3 · Diagrama de Ishikawa (causa-efecto) | Calidad (8) | 🟢 Libre | | | | Sugerido: Lisandra. Detalle en [`nota-3.md`](nota-3.md). |
| 41 | Nota 3 · Plan de pruebas e inspección (desde las pruebas del CI) | Calidad (8) | 🟡 En curso | Abraham (con Claude) | 2026-11-17 | `docs/plan-de-pruebas` | Sugerido: Abraham. Detalle en [`nota-3.md`](nota-3.md). |
| 42 | Nota 3 · Gráfico de control con los datos simulados de consumo | Calidad (8) | 🟢 Libre | | | | Sugerido: Sebastián. Detalle en [`nota-3.md`](nota-3.md). |
| 43 | Nota 3 · Carpeta de evidencias (CI, ZAP, Ansible, API, dashboard) + grabación | Entregables | 🟢 Libre | | | | Sugerido: Abraham + todos. Detalle en [`nota-3.md`](nota-3.md). |
| 45 | README al día (estado, dashboard de 7 pantallas, roles, tecnologías con DevSecOps, roadmap, contribución) + CONTEXTO §6-7 | Entregables | ✅ Listo | Abraham (con Claude) | 2026-11-14 | [PR #61](https://github.com/Aburahamu20/Induplac/pull/61) | Para la Nota 3: es lo primero que ve el profe en el repo. |
| 46 | Guía del equipo al día (para quien sabe poco del proyecto): roles, dashboard, demo, estado, DevOps explicado simple, API y backend, y preguntas de la Nota 3 | Entregables | ✅ Listo | Abraham (con Claude) | 2026-11-17 | [PR #65](https://github.com/Aburahamu20/Induplac/pull/65) | Estaba al 14/10. Base para que todos puedan defender la Nota 3. |
| 47 | Pipeline: Ansible en el diagrama, versiones con nombre (v0.1 a v0.7) y volver a una versión anterior, reflexión de Ansible y notas para el PPT de la Nota 3 | Pipeline (2) | ✅ Listo | Abraham (con Claude) | 2026-11-17 | [PR #67](https://github.com/Aburahamu20/Induplac/pull/67) | Lo que pide el PPT de preparación de la Nota 3 (diapositivas 11, 18 y 19). |
| 48 | CI: excepción acotada para la vulnerabilidad GHSA-fc5q-39xc-vjpf de `picomatch` (dentro de Vite, sin versión corregida) | `.github/` | ✅ Listo | Abraham (con Claude) | 2026-11-17 | [PR #70](https://github.com/Aburahamu20/Induplac/pull/70) | El control de dependencias bloqueaba todos los PR. Se quita cuando salga `picomatch` > 4.0.7. |

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
| Pauta de la entrega y borradores de roles, RACI, PMI y Gantt | Abraham (con Claude) | 2026-10-14 | PR #7 |
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
| Documentación al día con lo del 20/10: Gantt con Estado, RACI, tareas, Cloud, Scrum y conclusiones | Bárbara Saavedra (con Claude) | 2026-10-21 | PR #25 |
| API local del Edge y login de planta (tarea 22) | Abraham (con Claude) | 2026-10-29 | PR #30 |
| Informe del proyecto de la Nota 2, entregado (tarea 16) | Bárbara Saavedra (con Claude) | 2026-11-14 | Claude Docs + Word |
| Nota 3 · Product Backlog, sprints y Kanban (tarea 37) + lluvia de ideas y diagrama de afinidad (tarea 39) | Bárbara Saavedra (con Claude) | 2026-11-14 | PR #62 |
| Documentación de Bárbara al día con lo construido hasta el 14/11 (tarea 24) | Bárbara Saavedra (con Claude) | 2026-11-14 | PR #63 |
