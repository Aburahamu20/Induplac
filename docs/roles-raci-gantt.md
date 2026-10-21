# 👥 Roles, RACI y Carta Gantt — Nota 2

> **Autora:** Bárbara Saavedra (`barbaraantoniaa`). Tareas 9, 10 y 14 de [`EN-CURSO.md`](EN-CURSO.md).
> **Actualizado el 21/10/2026:** Gantt con columna *Estado*, pipeline DevOps y MVP de punta a punta (ver §5).
> **Archivo original (con fórmulas y colores):** [`docs/nota-2/Induplac_Roles_Equipo.xlsx`](nota-2/Induplac_Roles_Equipo.xlsx). Esta página es una copia en texto para leerla en GitHub; si cambian algo, cámbienlo en los dos.

---

## 1. Roles del equipo (tarea 9)

| Integrante | Rol | Responsabilidades principales | Carpeta | Mayor carga | Fortalezas |
|---|---|---|---|---|---|
| **Abraham Castro** | Jefe de proyecto, integración y desarrollo (broker, Edge y dashboard) | Coordina el equipo y el repositorio (README, docs/, ramas y Pull Requests). Creó el broker EMQX, el dashboard React y el Edge Gateway en Python; arma el backend AWS y la base RDS junto a Felipe. Prepara los casos de prueba y la demo. | `docs/, dashboard/, edge/` | Todos (transversal) | Redes e integración de sistemas: diseña la arquitectura completa (red, broker, Edge y nube) y coordina el repositorio y el trabajo del equipo. |
| **Sebastián Fuentes** | Ingeniero IoT y simulación | Sketch del ESP32 en Wokwi (Local 1 y Local 2): sensores simulados (CT, caudalímetro, UV), NTP, buffer de lecturas y publicación del JSON por MQTT (device_id + seq + ts). Escenarios de prueba de alertas. | `sensors/, simulation/` | Sprint 2 y 3 | Electrónica y prototipado IoT: arma el circuito y el firmware del ESP32 (sensores, MQTT con TLS, buffer offline) y resuelve problemas de hardware simulado. |
| **Lisandra González** | Pruebas del Edge y modo offline | Prueba el Edge Gateway con el simulador y con Wokwi, ejecuta la simulación de corte de internet, verifica la sincronización al volver la conexión (sin duplicados) y documenta las evidencias. En la implementación, despliega el Edge en la Raspberry Pi. | `edge/` | Sprint 3 | _Pendiente (se define con ella el 21/10)_ |
| **Felipe Murúa** | Cloud, backend y ciberseguridad | AWS en el Learner Lab: API Gateway, Lambda (Python), DynamoDB, RDS PostgreSQL (permisos, umbrales y catálogo) y S3 para publicar el dashboard; reglas de alerta; Cognito con MFA; IAM, TLS y cumplimiento de la Ley 19.628. | `backend/, infrastructure/` | Sprint 2 y 3 | Cloud y seguridad en AWS: configura y administra los servicios (Lambda, RDS, Cognito con MFA, security groups) cuidando el costo y el acceso mínimo. |
| **Bárbara Saavedra** | Planificación y frontend | Roles, matriz RACI, planificación Scrum y PMI, Carta Gantt, modelo Cloud, tecnologías y conclusiones. Apoya el dashboard (revisión de vistas) y la capacitación de usuarios en la implementación. | `docs/, dashboard/` | Sprint 3 e implementación | Planificación y documentación: organiza el proyecto con RACI, Carta Gantt, Scrum y PMI, y traduce lo técnico a documentos claros. |

### Roles Scrum (MVP)

| Rol Scrum | Integrante | Qué hace |
|---|---|---|
| Product Owner | **Abraham Castro** | Prioriza qué se hace primero según la pauta y las necesidades de la empresa. |
| Scrum Master | **Bárbara Saavedra** | Cuida que el equipo avance, quita bloqueos y mantiene el tablero al día. |
| Equipo de desarrollo | Los 5 integrantes | Construyen y prueban cada parte del MVP. |

### Tareas por integrante

| Integrante | Tarea | Sprint | Estado |
|---|---|---|---|
| Abraham | Coordinación del equipo, repositorio y Pull Requests | Todos | En curso |
| Abraham | Broker MQTT EMQX (TLS, usuario y Client ID por dispositivo) | Sprint 2 | Listo (PR #9) |
| Abraham | Dashboard React con datos simulados y conexión a la API | Sprint 2 y 3 | Listo (PR #18) |
| Abraham | Edge Gateway en Python: SQLite, intervalos de 15 min, alertas y sincronización | Sprint 3 | Listo (PR #18) |
| Abraham | Backend AWS y base RDS junto a Felipe | Sprint 2 y 3 | Listo (PR #16) |
| Abraham | Login del dashboard con Cognito y MFA | Sprint 3 | Listo (PR #20, probado el 21/10) |
| Abraham | Pipeline DevOps: GitHub Actions (CI en cada PR y despliegue a AWS) | Sprint 3 | Listo (PR #21) |
| Abraham | Casos de prueba y ensayo de la demo | Sprint 3 | En curso |
| Sebastián | Sketch ESP32 en Wokwi: Local 1 | Sprint 2 y 3 | Listo (PR #16) |
| Sebastián | Sketch ESP32 en Wokwi: Local 2 | Sprint 3 | Pendiente |
| Sebastián | Sensores simulados: CT (kW), caudalímetro (agua) y UV | Sprint 3 | Listo (PR #16) |
| Sebastián | Publicación MQTT del JSON (device_id + seq + ts) en el broker | Sprint 3 | Listo (PR #16) |
| Sebastián | NTP y buffer de lecturas sin conexión | Sprint 3 | Listo (PR #16) |
| Sebastián | Escenarios de prueba de alertas (kW +20 %, UV ≥ 8, agua) | Sprint 3 | En curso |
| Lisandra | Probar el Edge con el simulador y con Wokwi | Sprint 3 | Pendiente |
| Lisandra | Simulación de corte de internet y evidencias del modo offline | Sprint 3 | Pendiente |
| Lisandra | Verificar la sincronización al volver la conexión (sin duplicados) | Sprint 3 | Pendiente |
| Lisandra | Despliegue del Edge en la Raspberry Pi | Implementación | Pendiente |
| Felipe | API Gateway + Lambda de ingesta y consulta | Sprint 2 | Listo |
| Felipe | Tablas en DynamoDB (intervalos y alertas) | Sprint 2 | Listo |
| Felipe | Reglas de alerta (+20 % kW, UV ≥ 8, agua y fugas) | Sprint 2 | Listo |
| Felipe | Dashboard publicado en S3 | Sprint 2 | Listo |
| Felipe | RDS PostgreSQL: permisos, umbrales y catálogo + Lambda induplac-config | Sprint 3 | Listo (PR #16) |
| Felipe | Re-deploy de la Lambda con alertas del Edge | Sprint 3 | Listo (20/10) |
| Felipe | Cognito con MFA (user pool, clave temporal y MFA TOTP) | Sprint 3 | Listo: probado en AWS |
| Felipe | IAM, TLS, clave de ingesta y cumplimiento Ley 19.628 | Sprint 3 | En curso |
| Bárbara | Roles y responsabilidades del equipo | Sprint 3 | Listo (PR #11) |
| Bárbara | Matriz RACI | Sprint 3 | Listo (PR #11) |
| Bárbara | Planificación Scrum y fases PMI | Sprint 3 | Listo (PR #12) |
| Bárbara | Carta Gantt hasta la puesta en marcha | Sprint 3 | Listo (PR #11, actualizada PR #15) |
| Bárbara | Modelo Cloud y tecnologías con su aporte | Sprint 3 | Listo (PR #13) |
| Bárbara | Conclusiones y defensa | Sprint 3 | Listo (PR #14) |
| Bárbara | Actualización de la Nota 2 con lo construido el 20/10 | Sprint 3 | Listo (PR #25) |
| Bárbara | Capacitación de usuarios del dashboard | Implementación | Pendiente |
---

## 2. Matriz RACI (tarea 10)

**R** = hace el trabajo · **A** = responde por el resultado (uno solo por actividad) · **C** = se consulta · **I** = se informa · **A/R** = hace el trabajo y responde por él.

| N.º | Actividad | Abraham Castro<br>Jefe de proyecto | Sebastián Fuentes<br>IoT y simulación | Lisandra González<br>Pruebas Edge y offline | Felipe Murúa<br>Cloud y ciberseguridad | Bárbara Saavedra<br>Planificación y frontend |
|---|---|:-:|:-:|:-:|:-:|:-:|
| 1 | Captura IoT: ESP32 en Wokwi, payload JSON (device_id + seq + ts) y publicación MQTT | C | **A/R** | I | I | I |
| 2 | Broker MQTT EMQX (TLS, usuario y Client ID por dispositivo) | **A/R** | C | I | C | I |
| 3 | Edge Gateway: SQLite, intervalos de 15 min y alertas locales | **A/R** | C | C | C | I |
| 4 | Modo offline y sincronización (healthcheck, lotes de 50, idempotencia) y sus pruebas | **A/R** | I | R | C | I |
| 5 | Backend AWS: API Gateway, Lambdas (ingesta e induplac-config), DynamoDB, RDS PostgreSQL, S3 y reglas de alerta | R | I | C | **A/R** | I |
| 6 | Dashboard React (vistas por sede, alertas, histórico, panel de demo) | **A/R** | I | I | C | C |
| 7 | Seguridad: Cognito con MFA, permisos por usuario, IAM, TLS, VPN documentada, Ley 19.628 | C | I | I | **A/R** | I |
| 8 | Planificación: roles, RACI, Scrum, PMI y Carta Gantt | C | C | C | C | **A/R** |
| 9 | Pruebas integrales y simulación de fallas (corte de red, valores absurdos, alertas) | **A** | R | R | C | C |
| 10 | Documentación, Pull Requests, pipeline DevOps (GitHub Actions), demo y presentación final | **A/R** | R | R | R | R |

**Control:** las 10 actividades tienen al menos un R y un solo A. ✅

| | Abraham | Sebastián | Lisandra | Felipe | Bárbara |
|---|:-:|:-:|:-:|:-:|:-:|
| Actividades como **R** (incluye A/R) | 6 | 3 | 3 | 3 | 2 |
| Actividades como **A** (incluye A/R) | 6 | 1 | 0 | 2 | 1 |

---

## 3. Carta Gantt (tareas 13 y 14)

Semana 1 = **lunes 05/10/2026**. **S1–S3:** desarrollo del MVP con Scrum (ya en ejecución). **S4–S12:** implementación en Induplac con las fases PMI hasta la puesta en marcha. ■ = semana de trabajo · ◆ = hito.

| ID | Tarea | Responsable | Sprint / Fase | Inicio | Fin | Depende de | Estado | S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8 | S9 | S10 | S11 | S12 |
|---|---|---|---|---|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **1** | **Sprint 1 – Diseño y documentación** | | Sprint 1 | | | | | | | | | | | | | | | | |
| 1.1 | Contexto, arquitectura y decisiones técnicas (docs/) | Abraham | Sprint 1 | 05/10 | 09/10 | — | Listo | ■ |  |  |  |  |  |  |  |  |  |  |  |
| 1.2 | Pauta Nota 2, roles, RACI, Scrum/PMI, Cloud, conclusiones y Carta Gantt | Bárbara | Sprint 2 y 3 | 12/10 | 23/10 | 1.1 | Listo |  | ■ | ■ |  |  |  |  |  |  |  |  |  |
| **2** | **Sprint 2 – Captura y visualización** | | Sprint 2 | | | | | | | | | | | | | | | | |
| 2.1 | Contrato de datos del dashboard y formato de telemetría | Abraham | Sprint 2 | 12/10 | 16/10 | 1.1 | Listo |  | ■ |  |  |  |  |  |  |  |  |  |  |
| 2.2 | Broker MQTT EMQX (TLS, usuario y Client ID por dispositivo) | Abraham | Sprint 2 | 12/10 | 16/10 | 2.1 | Listo |  | ■ |  |  |  |  |  |  |  |  |  |  |
| 2.3 | Dashboard React (datos simulados y API de AWS) | Abraham | Sprint 2 y 3 | 12/10 | 23/10 | 2.1 | Listo |  | ■ | ■ |  |  |  |  |  |  |  |  |  |
| 2.4 | Backend AWS: API Gateway, Lambda, DynamoDB y S3 | Felipe y Abraham | Sprint 2 y 3 | 12/10 | 23/10 | 2.1 | Listo |  | ■ | ■ |  |  |  |  |  |  |  |  |  |
| **3** | **Sprint 3 – Integración híbrida y demo** | | Sprint 3 | | | | | | | | | | | | | | | | |
| 3.1 | ESP32 en Wokwi publicando por MQTT (Local 1 listo; Local 2 pendiente) | Sebastián | Sprint 2 y 3 | 12/10 | 23/10 | 2.2 | En curso |  | ■ | ■ |  |  |  |  |  |  |  |  |  |
| 3.2 | Edge Gateway: SQLite, intervalos, alertas y sincronización | Abraham | Sprint 2 y 3 | 12/10 | 23/10 | 2.2, 2.4 | Listo |  | ■ | ■ |  |  |  |  |  |  |  |  |  |
| 3.3 | RDS PostgreSQL: permisos, umbrales y catálogo + Lambda induplac-config | Felipe y Abraham | Sprint 3 | 19/10 | 23/10 | 2.4 | Listo |  |  | ■ |  |  |  |  |  |  |  |  |  |
| 3.4 | Cognito con MFA y login del dashboard | Felipe y Abraham | Sprint 3 | 19/10 | 23/10 | 2.4, 3.3 | Listo |  |  | ■ |  |  |  |  |  |  |  |  |  |
| 3.5 | Pruebas del Edge y simulación de corte de internet | Lisandra | Sprint 3 | 19/10 | 23/10 | 3.2 | Pendiente |  |  | ■ |  |  |  |  |  |  |  |  |  |
| 3.6 | Casos de prueba y ensayo de la demo | Abraham | Sprint 3 | 19/10 | 23/10 | 3.1, 3.2, 3.3 | En curso |  |  | ■ |  |  |  |  |  |  |  |  |  |
| 3.7 | Pipeline DevOps: GitHub Actions (CI en cada PR y despliegue a AWS) | Abraham | Sprint 3 | 19/10 | 23/10 | 2.3, 3.2 | Listo |  |  | ■ |  |  |  |  |  |  |  |  |  |
| **4** | **Implementación en Induplac (PMI)** | | PMI | | | | | | | | | | | | | | | | |
| 4.1 | Inicio: validar alcance y criterios de éxito con Induplac | Abraham | Inicio | 26/10 | 30/10 | 3.6 | Planificado |  |  |  | ■ |  |  |  |  |  |  |  |  |
| 4.2 | Planificación: diseño detallado, riesgos y compras (sensores, Raspberry Pi, RTC) | Bárbara | Planificación | 02/11 | 06/11 | 4.1 | Planificado |  |  |  |  | ■ |  |  |  |  |  |  |  |
| 4.3 | Instalación de sensores y red (VLAN IoT y de operarios, VPN) | Sebastián | Ejecución | 09/11 | 20/11 | 4.2 | Planificado |  |  |  |  |  | ■ | ■ |  |  |  |  |  |
| 4.4 | Despliegue del Edge en la Raspberry Pi (RTC + NTP) | Lisandra | Ejecución | 09/11 | 20/11 | 4.2 | Planificado |  |  |  |  |  | ■ | ■ |  |  |  |  |  |
| 4.5 | Backend, RDS, Cognito y dashboard en producción | Felipe | Ejecución | 09/11 | 20/11 | 4.2 | Planificado |  |  |  |  |  | ■ | ■ |  |  |  |  |  |
| 4.6 | Pruebas de seguridad, corte de red y permisos | Felipe | Monitoreo y control | 23/11 | 27/11 | 4.3, 4.4, 4.5 | Planificado |  |  |  |  |  |  |  | ■ |  |  |  |  |
| 4.7 | Piloto en Local 1 y capacitación de usuarios | Bárbara | Ejecución | 30/11 | 04/12 | 4.6 | Planificado |  |  |  |  |  |  |  |  | ■ |  |  |  |
| 4.8 | Extensión a Local 2 | Sebastián | Ejecución | 07/12 | 11/12 | 4.7 | Planificado |  |  |  |  |  |  |  |  |  | ■ |  |  |
| 4.9 | Monitoreo y control (revisión semanal de avance y riesgos) | Abraham | Monitoreo y control | 26/10 | 18/12 | — | Planificado |  |  |  | ■ | ■ | ■ | ■ | ■ | ■ | ■ | ■ |  |
| 4.10 | Cierre: aceptación, documentación y lecciones aprendidas | Abraham | Cierre | 21/12 | 25/12 | 4.8 | Planificado |  |  |  |  |  |  |  |  |  |  |  | ■ |
| **5** | **Hitos** | | Hitos | | | | | | | | | | | | | | | | |
| 5.1 | Broker y backend en la nube operativos | Equipo | Hito | 16/10 | 16/10 | 2.2, 2.4 | Cumplido |  | ◆ |  |  |  |  |  |  |  |  |  |  |
| 5.2 | MVP funcionando de punta a punta (Wokwi → EMQX → Edge → AWS) | Equipo | Hito | 20/10 | 20/10 | 3.1, 3.2, 3.3 | Cumplido |  |  | ◆ |  |  |  |  |  |  |  |  |  |
| 5.3 | Demostración del prototipo (miércoles 21/10) | Equipo | Hito | 21/10 | 21/10 | 3.6 | Hoy |  |  | ◆ |  |  |  |  |  |  |  |  |  |
| 5.4 | Acta de inicio con Induplac | Equipo | Hito | 30/10 | 30/10 | 4.1 | Planificado |  |  |  | ◆ |  |  |  |  |  |  |  |  |
| 5.5 | Pruebas aprobadas | Equipo | Hito | 27/11 | 27/11 | 4.6 | Planificado |  |  |  |  |  |  |  | ◆ |  |  |  |  |
| 5.6 | Puesta en marcha | Equipo | Hito | 14/12 | 14/12 | 4.8 | Planificado |  |  |  |  |  |  |  |  |  |  | ◆ |  |

**Hitos:** ◆ Broker y backend en la nube (S2, cumplido) · ◆ **MVP de punta a punta, 20/10 (S3, cumplido)** · ◆ **Demo del prototipo, mié 21/10 (S3)** · ◆ Acta de inicio con Induplac (S4) · ◆ Pruebas aprobadas (S8) · ◆ **Puesta en marcha (S11)**

**Estado:** Listo / Cumplido = terminado · En curso / Hoy = en desarrollo · Pendiente = atrasado o sin empezar · Planificado = implementación futura.

**Lógica PMI:** S1–S3 es el desarrollo del MVP con Scrum. S4–S12 es la implementación en Induplac con las 5 fases PMI: inicio (S4), planificación (S5), ejecución (S6–S10), monitoreo y control (transversal) y cierre (S12).

---

## 4. Cómo editar

1. Abrir `docs/nota-2/Induplac_Roles_Equipo.xlsx` en Excel. En la hoja **Carta Gantt**, cambiar la fecha de inicio (celda E2) o el **Inicio** y la **Duración** de cada tarea (en azul): las fechas de fin, las barras y sus colores por responsable se recalculan solos. En la hoja **RACI**, la columna *Control* y los totales también se calculan solos, igual que el resumen de la hoja **Tareas por integrante**.
2. Las celdas amarillas (fortalezas, Product Owner, Scrum Master) las completa el equipo. Al 21/10 solo falta la fortaleza de Lisandra.
3. Actualizar también las tablas de esta página.
4. Entregar el cambio por Pull Request, como todo lo demás ([`CONTRIBUTING.md`](../CONTRIBUTING.md)).

---

## 5. Historial de cambios

**18/10/2026** — ajustes para que el documento calce con el repositorio:
1. **Responsables según lo construido:** broker EMQX (PR #9), dashboard y Edge de Abraham; backend AWS de Abraham con Felipe.
2. **RACI de 19 a 10 actividades**, porque la pauta pide de 6 a 10.
3. **Gantt en dos partes:** sprints del MVP (S1–S3) e implementación con fases PMI (S4–S12).
4. **Términos alineados con el código:** estados ONLINE / OFFLINE / SINCRONIZANDO, lotes con `batch_id` y upsert idempotente, identificador `device_id + seq + ts`.
5. **Columna de fortalezas** en Roles (la pauta la pide; vale 15 %).

**21/10/2026** — Roles Scrum definidos: **Product Owner** Abraham (decide qué entra al MVP y en qué orden) y **Scrum Master** Bárbara (planificación, seguimiento y quitar bloqueos).

**21/10/2026** — Estados de *Tareas por integrante* al día tras la sesión del 20/10 (PR #16 y #18): dashboard, Edge, backend con RDS, Wokwi Local 1 y Cognito probado. Las tareas de Lisandra siguen pendientes.

**19/10/2026** — RDS PostgreSQL vuelve al MVP:
1. Nueva tarea **3.3 RDS PostgreSQL** (Felipe, Sprint 3). Se mantiene apagado y se enciende para la demo del miércoles y para configuraciones.
2. RDS agregado a la actividad 5 de la RACI, a las responsabilidades y tareas de Felipe y Abraham y a la tarea 4.5 de la implementación.
3. Tareas del Sprint 3 renumeradas (3.3 → 3.6); Cognito ahora depende también de RDS (permisos por usuario).
4. Reparto de datos: **alertas en DynamoDB** (siempre encendido, así funcionan con RDS apagado), **cuentas en Cognito** y en **RDS solo configuración** (permisos, umbrales y catálogo).
5. Agregada la tabla de **roles Scrum** (Product Owner y Scrum Master por definir).
6. **Tareas por integrante** al día: estados de Bárbara actualizados (PR #11 a #15) y resumen automático por persona en el Excel.

**21/10/2026** — Nota 2 al día con lo construido el 20/10:
1. Carta Gantt con columna **Estado** (lo planificado contra lo cumplido en S1–S3).
2. Nueva tarea **3.7 Pipeline DevOps** (Abraham, listo, PR #21) y nuevo hito **5.2 MVP funcionando de punta a punta (20/10)**; los hitos siguientes se renumeran (demo 5.3, puesta en marcha 5.6).
3. Responsables compartidos **Felipe y Abraham** en el backend (2.4), RDS + Lambda `induplac-config` (3.3) y Cognito (3.4).
4. Wokwi (3.1): Local 1 listo y Local 2 pendiente; en *Tareas por integrante* quedan como dos filas.
5. RACI: el pipeline DevOps se suma a la actividad 10 y la Lambda `induplac-config` a la actividad 5.
6. *Tareas por integrante*: pipeline DevOps y login con Cognito (PR #20) en las de Abraham.

### Falta que decida el equipo
- [x] Fortalezas escritas (21/10/2026). **Pendiente:** la de Lisandra.
- [ ] **Lisandra:** confirmar el rol propuesto.
- [x] **Product Owner:** Abraham · **Scrum Master:** Bárbara (21/10/2026).
- [ ] Revisar las duraciones de la implementación (S4–S12).
