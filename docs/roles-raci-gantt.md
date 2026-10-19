# 👥 Roles, RACI y Carta Gantt — Nota 2

> **Autora:** Bárbara Saavedra (`barbaraantoniaa`). Tareas 9, 10 y 14 de [`EN-CURSO.md`](EN-CURSO.md).
> **Corregido el 18/10/2026** según lo construido en GitHub (tablero, notas de avance y código); los cambios están en §5.
> **Archivo original (con fórmulas y colores):** [`docs/nota-2/Induplac_Roles_Equipo.xlsx`](nota-2/Induplac_Roles_Equipo.xlsx). Esta página es una copia en texto para leerla en GitHub; si cambian algo, cámbienlo en los dos.

---

## 1. Roles del equipo (tarea 9)

| Integrante | Rol | Responsabilidades principales | Carpeta | Mayor carga | Fortalezas |
|---|---|---|---|---|---|
| **Abraham Castro** | Jefe de proyecto, integración y desarrollo (broker, Edge y dashboard) | Coordina el equipo y el repositorio (README, docs/, ramas y Pull Requests). Creó el broker EMQX, el dashboard React y el Edge Gateway en Python; armó el backend AWS junto a Felipe. Prepara los casos de prueba y la demo. | `docs/, dashboard/, edge/` | Todos (transversal) | _Por completar (cada integrante)_ |
| **Sebastián Fuentes** | Ingeniero IoT y simulación | Sketch del ESP32 en Wokwi (Local 1 y Local 2): sensores simulados (CT, caudalímetro, UV), NTP, buffer de lecturas y publicación del JSON por MQTT en el broker EMQX (device_id + seq + ts). Escenarios de prueba de alertas. | `sensors/, simulation/` | Sprint 2 y 3 | _Por completar (cada integrante)_ |
| **Lisandra González** | Pruebas del Edge y modo offline | Prueba el Edge Gateway (edge/) con el simulador y con Wokwi, ejecuta la simulación de corte de internet, verifica la sincronización al volver la conexión (ONLINE / OFFLINE / SINCRONIZANDO, lotes de 50, sin duplicados) y documenta las evidencias. En la implementación, despliega el Edge en la Raspberry Pi. | `edge/` | Sprint 3 | _Por completar (cada integrante)_ |
| **Felipe Murúa** | Cloud, backend y ciberseguridad | AWS en el Learner Lab: API Gateway, Lambda (Python), DynamoDB y S3 para publicar el dashboard; reglas de alerta; Cognito con MFA; IAM, TLS, clave de ingesta y cumplimiento de la Ley 19.628. | `backend/, infrastructure/` | Sprint 2 y 3 | _Por completar (cada integrante)_ |
| **Bárbara Saavedra** | Planificación y frontend | Roles, matriz RACI, planificación Scrum y PMI, y Carta Gantt (tareas 9, 10, 13 y 14). Apoya el dashboard: revisión de las vistas y capacitación de usuarios en la implementación. | `docs/, dashboard/` | Sprint 3 e implementación | _Por completar (cada integrante)_ |

### Tareas por integrante

| Integrante | Tarea | Sprint | Estado |
|---|---|---|---|
| Abraham | Coordinación del equipo, repositorio y Pull Requests | Todos | En curso |
| Abraham | Broker MQTT EMQX (TLS, usuario y Client ID por dispositivo) | Sprint 2 | Listo (PR #9) |
| Abraham | Dashboard React con datos simulados y conexión a la API | Sprint 2 y 3 | En curso |
| Abraham | Edge Gateway en Python: SQLite, intervalos de 15 min, alertas y sincronización | Sprint 3 | En curso |
| Abraham | Backend AWS junto a Felipe (Lambda, DynamoDB, API Gateway, S3) | Sprint 2 | Listo (falta re-deploy) |
| Abraham | Casos de prueba y ensayo de la demo | Sprint 3 | Pendiente |
| Sebastián | Sketch ESP32 en Wokwi (Local 1 y Local 2) | Sprint 2 y 3 | En curso |
| Sebastián | Sensores simulados: CT (kW), caudalímetro (agua) y UV | Sprint 3 | En curso |
| Sebastián | Publicación MQTT del JSON (device_id + seq + ts) en el broker | Sprint 3 | En curso |
| Sebastián | NTP y buffer de lecturas sin conexión | Sprint 3 | Pendiente |
| Sebastián | Escenarios de prueba de alertas (kW +20 %, UV ≥ 8, agua) | Sprint 3 | Pendiente |
| Lisandra | Probar el Edge con el simulador y con Wokwi | Sprint 3 | Pendiente |
| Lisandra | Simulación de corte de internet y evidencias del modo offline | Sprint 3 | Pendiente |
| Lisandra | Verificar la sincronización al volver la conexión (sin duplicados) | Sprint 3 | Pendiente |
| Lisandra | Despliegue del Edge en la Raspberry Pi | Implementación | Pendiente |
| Felipe | API Gateway + Lambda de ingesta y consulta | Sprint 2 | Listo |
| Felipe | Tablas en DynamoDB (intervalos y alertas) | Sprint 2 | Listo |
| Felipe | Reglas de alerta (+20 % kW, UV ≥ 8, agua y fugas) | Sprint 2 | Listo |
| Felipe | Dashboard publicado en S3 | Sprint 2 | Listo |
| Felipe | Re-deploy de la Lambda con alertas del Edge | Sprint 3 | Pendiente |
| Felipe | Cognito con MFA | Sprint 3 | Pendiente |
| Felipe | IAM, TLS, clave de ingesta y cumplimiento Ley 19.628 | Sprint 3 | En curso |
| Bárbara | Roles y responsabilidades del equipo | Sprint 3 | En revisión (PR #11) |
| Bárbara | Matriz RACI | Sprint 3 | En revisión (PR #11) |
| Bárbara | Planificación Scrum y fases PMI | Sprint 3 | En curso |
| Bárbara | Carta Gantt hasta la puesta en marcha | Sprint 3 | En revisión (PR #11) |
| Bárbara | Capacitación de usuarios del dashboard | Implementación | Pendiente |

---

## 2. Matriz RACI (tarea 10)

**R** = Responsable (hace el trabajo) · **A** = Aprobador (uno solo por actividad) · **C** = Consultado · **I** = Informado · **A/R** = hace el trabajo y responde por él.

| N.º | Actividad | Abraham Castro<br>Jefe de proyecto, broker, Edge y dashboard | Sebastián Fuentes<br>IoT y simulación | Lisandra González<br>Pruebas del Edge y modo offline | Felipe Murúa<br>Cloud y ciberseguridad | Bárbara Saavedra<br>Planificación y frontend |
|---|---|:-:|:-:|:-:|:-:|:-:|
| 1 | Captura IoT: ESP32 en Wokwi, payload JSON (device_id + seq + ts) y publicación MQTT | C | **A/R** | I | I | I |
| 2 | Broker MQTT EMQX (TLS, usuario y Client ID por dispositivo) | **A/R** | C | I | C | I |
| 3 | Edge Gateway: SQLite, intervalos de 15 min y alertas locales | **A/R** | C | C | C | I |
| 4 | Modo offline y sincronización (healthcheck, lotes de 50, idempotencia) y sus pruebas | **A/R** | I | R | C | I |
| 5 | Backend AWS: API Gateway, Lambda, DynamoDB, S3 y reglas de alerta | R | I | C | **A/R** | I |
| 6 | Dashboard React (vistas por sede, alertas, histórico, panel de demo) | **A/R** | I | I | C | C |
| 7 | Seguridad: Cognito con MFA, permisos por usuario, IAM, TLS, VPN documentada, Ley 19.628 | C | I | I | **A/R** | I |
| 8 | Planificación: roles, RACI, Scrum, PMI y Carta Gantt | C | C | C | C | **A/R** |
| 9 | Pruebas integrales y simulación de fallas (corte de red, valores absurdos, alertas) | **A** | R | R | C | C |
| 10 | Documentación, Pull Requests, demo y presentación final | **A/R** | R | R | R | R |

**Control:** las 10 actividades tienen al menos un R y un solo A. ✅

| | Abraham | Sebastián | Lisandra | Felipe | Bárbara |
|---|:-:|:-:|:-:|:-:|:-:|
| Actividades como **R** | 6 | 3 | 3 | 3 | 2 |
| Actividades como **A** | 6 | 1 | 0 | 2 | 1 |

---

## 3. Carta Gantt (tareas 13 y 14)

Semana 1 = **lunes 05/10/2026**. **S1–S3:** desarrollo del MVP con Scrum (ya en ejecución). **S4–S12:** implementación en Induplac con las fases PMI hasta la puesta en marcha. ■ = semana de trabajo · ◆ = hito.

| ID | Tarea | Responsable | Sprint / Fase | Inicio | Fin | Depende de | S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8 | S9 | S10 | S11 | S12 |
|---|---|---|---|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **1** | **Sprint 1 – Diseño y documentación** | | Sprint 1 | 05/10 | 23/10 | | | | | | | | | | | | | |
| 1.1 | Contexto, arquitectura y decisiones técnicas (docs/) | Abraham | Sprint 1 | 05/10 | 09/10 | — | ■ |  |  |  |  |  |  |  |  |  |  |  |
| 1.2 | Pauta Nota 2, roles, RACI, Scrum/PMI y Carta Gantt | Bárbara | Sprint 2 y 3 | 12/10 | 23/10 | 1.1 |  | ■ | ■ |  |  |  |  |  |  |  |  |  |
| **2** | **Sprint 2 – Captura y visualización** | | Sprint 2 | 12/10 | 23/10 | | | | | | | | | | | | | |
| 2.1 | Contrato de datos del dashboard y formato de telemetría | Abraham | Sprint 2 | 12/10 | 16/10 | 1.1 |  | ■ |  |  |  |  |  |  |  |  |  |  |
| 2.2 | Broker MQTT EMQX (TLS, usuario y Client ID por dispositivo) | Abraham | Sprint 2 | 12/10 | 16/10 | 2.1 |  | ■ |  |  |  |  |  |  |  |  |  |  |
| 2.3 | Dashboard React con datos simulados | Abraham | Sprint 2 | 12/10 | 23/10 | 2.1 |  | ■ | ■ |  |  |  |  |  |  |  |  |  |
| 2.4 | Backend AWS: API Gateway, Lambda, DynamoDB y S3 | Felipe | Sprint 2 | 12/10 | 23/10 | 2.1 |  | ■ | ■ |  |  |  |  |  |  |  |  |  |
| **3** | **Sprint 3 – Integración híbrida y demo** | | Sprint 3 | 12/10 | 23/10 | | | | | | | | | | | | | |
| 3.1 | ESP32 en Wokwi publicando por MQTT | Sebastián | Sprint 3 | 12/10 | 23/10 | 2.2 |  | ■ | ■ |  |  |  |  |  |  |  |  |  |
| 3.2 | Edge Gateway: SQLite, intervalos, alertas y sincronización | Abraham | Sprint 3 | 12/10 | 23/10 | 2.2, 2.4 |  | ■ | ■ |  |  |  |  |  |  |  |  |  |
| 3.3 | Pruebas del Edge y simulación de corte de internet | Lisandra | Sprint 3 | 19/10 | 23/10 | 3.2 |  |  | ■ |  |  |  |  |  |  |  |  |  |
| 3.4 | Cognito con MFA | Felipe | Sprint 3 | 19/10 | 23/10 | 2.4 |  |  | ■ |  |  |  |  |  |  |  |  |  |
| 3.5 | Casos de prueba y ensayo de la demo | Abraham | Sprint 3 | 19/10 | 23/10 | 3.1, 3.2 |  |  | ■ |  |  |  |  |  |  |  |  |  |
| **4** | **Implementación en Induplac (PMI)** | | PMI | 26/10 | 25/12 | | | | | | | | | | | | | |
| 4.1 | Inicio: validar alcance y criterios de éxito con Induplac | Abraham | Inicio | 26/10 | 30/10 | 3.5 |  |  |  | ■ |  |  |  |  |  |  |  |  |
| 4.2 | Planificación: diseño detallado, riesgos y compras (sensores, Raspberry Pi) | Bárbara | Planificación | 02/11 | 06/11 | 4.1 |  |  |  |  | ■ |  |  |  |  |  |  |  |
| 4.3 | Instalación de sensores y red (VLAN IoT, VPN) | Sebastián | Ejecución | 09/11 | 20/11 | 4.2 |  |  |  |  |  | ■ | ■ |  |  |  |  |  |
| 4.4 | Despliegue del Edge en la Raspberry Pi (RTC + NTP) | Lisandra | Ejecución | 09/11 | 20/11 | 4.2 |  |  |  |  |  | ■ | ■ |  |  |  |  |  |
| 4.5 | Backend, Cognito y dashboard en producción | Felipe | Ejecución | 09/11 | 20/11 | 4.2 |  |  |  |  |  | ■ | ■ |  |  |  |  |  |
| 4.6 | Pruebas de seguridad, corte de red y permisos | Felipe | Monitoreo y control | 23/11 | 27/11 | 4.3, 4.4, 4.5 |  |  |  |  |  |  |  | ■ |  |  |  |  |
| 4.7 | Piloto en Local 1 y capacitación de usuarios | Bárbara | Ejecución | 30/11 | 04/12 | 4.6 |  |  |  |  |  |  |  |  | ■ |  |  |  |
| 4.8 | Extensión a Local 2 | Sebastián | Ejecución | 07/12 | 11/12 | 4.7 |  |  |  |  |  |  |  |  |  | ■ |  |  |
| 4.9 | Monitoreo y control (revisión semanal de avance y riesgos) | Abraham | Monitoreo y control | 26/10 | 18/12 | — |  |  |  | ■ | ■ | ■ | ■ | ■ | ■ | ■ | ■ |  |
| 4.10 | Cierre: aceptación, documentación y lecciones aprendidas | Abraham | Cierre | 21/12 | 25/12 | 4.8 |  |  |  |  |  |  |  |  |  |  |  | ■ |
| **5** | **Hitos** | | Hitos | 12/10 | 18/12 | | | | | | | | | | | | | |
| 5.1 | Broker y backend en la nube operativos | Equipo | Hitos | 12/10 | 16/10 | 2.2, 2.4 |  | ◆ |  |  |  |  |  |  |  |  |  |  |
| 5.2 | Demostración del prototipo (miércoles 21/10) | Equipo | Hitos | 19/10 | 23/10 | 3.5 |  |  | ◆ |  |  |  |  |  |  |  |  |  |
| 5.3 | Acta de inicio con Induplac | Equipo | Hitos | 26/10 | 30/10 | 4.1 |  |  |  | ◆ |  |  |  |  |  |  |  |  |
| 5.4 | Pruebas aprobadas | Equipo | Hitos | 23/11 | 27/11 | 4.6 |  |  |  |  |  |  |  | ◆ |  |  |  |  |
| 5.5 | Puesta en marcha | Equipo | Hitos | 14/12 | 18/12 | 4.8 |  |  |  |  |  |  |  |  |  |  | ◆ |  |

**Hitos:** ◆ Broker y backend en la nube (S2) · ◆ **Demo del prototipo, mié 21/10 (S3)** · ◆ Acta de inicio con Induplac (S4) · ◆ Pruebas aprobadas (S8) · ◆ **Puesta en marcha (S11)**

---

## 4. Cómo editar

1. Abrir `docs/nota-2/Induplac_Roles_Equipo.xlsx` en Excel (las fechas, los totales y la columna *Control* de la RACI se calculan solas; las barras de la Gantt se colorean según el responsable).
2. Actualizar también las tablas de esta página.
3. Entregar el cambio por Pull Request, como todo lo demás ([`CONTRIBUTING.md`](../CONTRIBUTING.md)).

---

## 5. Cambios respecto a la versión original de Bárbara

Hechos el 18/10/2026 para que el documento calce con lo que está en el repositorio:

1. **Responsables según lo construido.** El broker EMQX (PR #9), el dashboard y el Edge los construyó Abraham, y el backend AWS Abraham con Felipe. Los roles de Abraham, Lisandra y Bárbara se ajustaron a eso.
2. **RACI de 19 a 10 actividades**, porque la pauta pide de 6 a 10. Se agruparon las actividades relacionadas (captura IoT, Edge, backend, seguridad, pruebas).
3. **Gantt en dos partes:** el plan de sprints del MVP (S1–S3, que es lo ya hecho y no un plan futuro) y la implementación en Induplac con fases PMI hasta la puesta en marcha (S4–S12), como pide la pauta.
4. **Términos alineados con el código:** estados ONLINE / OFFLINE / SINCRONIZANDO (sin ERROR), lotes con `batch_id` y upsert idempotente (no UUIDv4), identificador `device_id + seq + ts`. RDS PostgreSQL se quitó porque quedó fuera del MVP (las alertas están en DynamoDB).
5. **Columna de fortalezas** agregada en Roles (la pauta la pide; vale 15 %).

### Falta que decida el equipo
- [ ] Cada integrante escribe **su fortaleza** en la hoja Roles.
- [ ] **Lisandra:** confirmar el rol propuesto (pruebas del Edge, corte de internet y Raspberry Pi), porque todavía no tiene trabajo registrado en GitHub.
- [ ] **Bárbara:** confirmar el rol de planificación y frontend (roles, RACI, Scrum, PMI, Gantt y capacitación).
- [ ] Revisar las duraciones de la implementación (S4–S12).
