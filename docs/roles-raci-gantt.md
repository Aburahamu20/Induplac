# 👥 Roles, RACI y Carta Gantt — Nota 2

> **Autora:** Bárbara Saavedra (`barbaraantoniaa`). Tareas 9, 10 y 14 de [`EN-CURSO.md`](EN-CURSO.md).
> **Archivo original (con fórmulas y colores):** [`docs/nota-2/Induplac_Roles_Equipo.xlsx`](nota-2/Induplac_Roles_Equipo.xlsx). Esta página es una copia en texto para leerla en GitHub; si cambian algo, cámbienlo en los dos.
>
> Las observaciones del final (§5) **no** modifican el trabajo de Bárbara: son puntos para que el equipo los decida.

---

## 1. Roles del equipo (tarea 9)

| Integrante | Rol | Responsabilidades principales | Carpeta | Sprint de mayor carga |
|---|---|---|---|---|
| **Abraham Castro** | Jefe de proyecto, documentación y pruebas | Coordina el equipo y el repositorio, mantiene el README y la carpeta `docs/`, gestiona ramas y Pull Requests, escribe los casos de prueba y prepara la demo final. | `docs/`, `README.md`, `CONTRIBUTING.md` | Todos (transversal) |
| **Sebastián Fuentes** | Ingeniero IoT y simulación | Simulación en Wokwi, firmware del ESP32, sensores simulados (CT, caudalímetro, UV), formato del payload JSON, publicación MQTT y generación de datos ficticios. | `sensors/`, `simulation/` | Sprint 1 |
| **Lisandra González** | Edge y sincronización | Gateway (Raspberry Pi o servicio local), suscripción MQTT, SQLite, modo offline, healthcheck, estados ONLINE/OFFLINE/SYNCING/ERROR, lotes con UUIDv4 e idempotencia. | `edge/` | Sprint 1 y 3 |
| **Felipe Murúa** | Cloud, backend y ciberseguridad | AWS (API Gateway, Lambda, DynamoDB), reglas de alerta, IAM de mínimo privilegio, TLS, credenciales con `.env`, roles (RBAC) y cumplimiento de la Ley 19.628. | `backend/`, `infrastructure/` | Sprint 2 y 3 |
| **Bárbara Saavedra** | Frontend y dashboards | Dashboards React + TypeScript (Local 1, Local 2 y General), tarjetas de indicadores, gráficos, tabla comparativa día/semana/mes, antigüedad del dato y vista de alertas. | `dashboard/` | Sprint 2 |

### Tareas detalladas por integrante

| Integrante | Tareas | Sprint |
|---|---|---|
| Abraham | Coordinación del equipo y seguimiento del avance · Gestión de ramas y Pull Requests · Mantener README y `docs/` | Todos |
| Abraham | Redactar casos de prueba (5 pruebas de demostración) · Integración final y preparación de la demo | Sprint 3 |
| Sebastián | Montar simulación Wokwi (ESP32 Local 1 y Local 2) · Definir el payload JSON · Simular sensores CT (kW), caudalímetro (agua) y UV · Publicación MQTT por topic de cada local | Sprint 1 |
| Sebastián | Generar datos ficticios e históricos para el dashboard | Sprint 1 y 2 |
| Lisandra | Cliente MQTT del gateway (suscripción a topics) · Base SQLite local con campo `is_synced` | Sprint 1 |
| Lisandra | Modo offline y healthcheck · Sincronización por lotes con UUIDv4 · Estados ONLINE / OFFLINE / SYNCING / ERROR | Sprint 3 |
| Felipe | API Gateway + Lambda de ingesta · Tabla histórica en DynamoDB · Reglas de alerta (+20 % electricidad, UV ≥ 8, agua) | Sprint 2 |
| Felipe | IAM de mínimo privilegio y manejo de `.env` · TLS/MQTTS, RBAC y cumplimiento Ley 19.628 | Sprint 3 |
| Bárbara | Dashboard Local 1 (tarjetas, gráfico, alertas, estado) · Dashboard Local 2 · Dashboard General / Auditoría · Tabla comparativa y selector día/semana/mes | Sprint 2 |
| Bárbara | Indicador de antigüedad del dato y aviso de modo offline | Sprint 3 |

**Total:** 25 tareas (Abraham 5, Sebastián 5, Lisandra 5, Felipe 5, Bárbara 5).

---

## 2. Matriz RACI (tarea 10)

**R** = Responsable (hace el trabajo) · **A** = Aprobador (responde por el resultado; uno solo por tarea) · **C** = Consultado · **I** = Informado · **A/R** = hace el trabajo y responde por él.

| N.º | Tarea | Abraham<br>PM, docs y pruebas | Sebastián<br>IoT y simulación | Lisandra<br>Edge y sync | Felipe<br>Cloud y ciberseg. | Bárbara<br>Frontend |
|---|---|:-:|:-:|:-:|:-:|:-:|
| 1 | Dashboard React (Local 1, Local 2, General, tabla comparativa, panel de demo) | **A/R** | I | C | C | R |
| 2 | Contrato de telemetría (payload JSON, `device_id + seq`) | I | **A/R** | C | C | I |
| 3 | ESP32 en Wokwi (sensores, NTP, buffer de lecturas) | I | **A/R** | C | I | I |
| 4 | Broker MQTT (EMQX/HiveMQ), TLS y credenciales por dispositivo | I | **A/R** | C | C | I |
| 5 | Programa de la Raspberry Pi: recibir, validar y guardar en SQLite | I | C | **A/R** | C | I |
| 6 | Resúmenes de 15 min y alertas locales en el Edge | I | I | **A/R** | C | I |
| 7 | Modo offline, healthcheck y sincronización (lotes de 50, idempotencia) | I | I | **A/R** | C | I |
| 8 | API Gateway + Lambda de ingesta | I | I | C | **A/R** | I |
| 9 | Bases en la nube (DynamoDB y RDS PostgreSQL) | C | I | C | **A/R** | C |
| 10 | Reglas de alerta en Lambda (+20 % kW, UV ≥ 8, agua) | I | I | C | **A/R** | I |
| 11 | Cognito con MFA y roles (RBAC) | I | I | I | **A/R** | C |
| 12 | Seguridad de red y accesos (VLAN, VPN documentada, IAM, `.env`) | I | I | C | **A/R** | I |
| 13 | Cumplimiento Ley 19.628 (privacidad de HH) | **A** | I | I | R | I |
| 14 | Simulación de fallas (corte de red, valores absurdos, alertas) | **A** | R | C | C | C |
| 15 | Casos de prueba y ejecución de pruebas integrales | **A/R** | C | C | C | C |
| 16 | Documentación (README, `docs/`, notas de avance, EN-CURSO) | **A/R** | R | R | R | R |
| 17 | Revisión y merge de Pull Requests | **A/R** | C | C | C | C |
| 18 | Integración de punta a punta (ESP32 → Pi → AWS → Dashboard) | **A** | R | R | R | R |
| 19 | Demostración y presentación final | **A/R** | R | R | R | R |

**Control:** las 19 tareas tienen al menos un R y un solo A. ✅

| | Abraham | Sebastián | Lisandra | Felipe | Bárbara |
|---|:-:|:-:|:-:|:-:|:-:|
| Tareas como **R** | 5 | 7 | 6 | 9 | 4 |
| Tareas como **A** | 8 | 3 | 3 | 5 | 0 |

---

## 3. Carta Gantt (tarea 14)

Inicio: **lunes 19/10/2026** (semana 1). Cada semana va de lunes a viernes. ■ = semana de trabajo · ◆ = hito.

| ID | Tarea | Responsable | Inicio | Fin | Depende de | S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8 | S9 | S10 |
|---|---|---|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **1** | **Sprint 1 – Captura de datos** | | | | | | | | | | | | | | |
| 1.1 | Definir payload JSON (contrato de telemetría) | Sebastián | 19/10 | 23/10 | — | ■ |  |  |  |  |  |  |  |  |  |
| 1.2 | Diseño definitivo de dashboards (mockups) | Bárbara | 19/10 | 30/10 | — | ■ | ■ |  |  |  |  |  |  |  |  |
| 1.3 | Diseño de arquitectura AWS y política IAM | Felipe | 19/10 | 30/10 | — | ■ | ■ |  |  |  |  |  |  |  |  |
| 1.4 | Modelo de datos (docs/modelo-datos.md) | Abraham | 26/10 | 30/10 | 1.1 |  | ■ |  |  |  |  |  |  |  |  |
| 1.5 | Simulación Wokwi: ESP32 y sensores (kW, agua, UV) | Sebastián | 26/10 | 06/11 | 1.1 |  | ■ | ■ |  |  |  |  |  |  |  |
| 1.6 | Publicación MQTT por topic de cada local | Sebastián | 02/11 | 06/11 | 1.5 |  |  | ■ |  |  |  |  |  |  |  |
| 1.7 | Cliente MQTT del gateway (suscripción) | Lisandra | 26/10 | 30/10 | 1.1 |  | ■ |  |  |  |  |  |  |  |  |
| 1.8 | Base SQLite local con campo is_synced | Lisandra | 02/11 | 06/11 | 1.4, 1.7 |  |  | ■ |  |  |  |  |  |  |  |
| **2** | **Sprint 2 – Visualización** | | | | | | | | | | | | | | |
| 2.1 | Datos ficticios e históricos para el dashboard | Sebastián | 09/11 | 13/11 | 1.6 |  |  |  | ■ |  |  |  |  |  |  |
| 2.2 | Tabla histórica en DynamoDB | Felipe | 02/11 | 06/11 | 1.3 |  |  | ■ |  |  |  |  |  |  |  |
| 2.3 | API Gateway + Lambda de ingesta | Felipe | 09/11 | 20/11 | 2.2 |  |  |  | ■ | ■ |  |  |  |  |  |
| 2.4 | Reglas de alerta (+20 % kW, UV ≥ 8, agua) | Felipe | 23/11 | 27/11 | 2.3 |  |  |  |  |  | ■ |  |  |  |  |
| 2.5 | Dashboard Local 1 (tarjetas, gráfico, alertas) | Bárbara | 02/11 | 13/11 | 1.2 |  |  | ■ | ■ |  |  |  |  |  |  |
| 2.6 | Dashboard Local 2 (misma estructura) | Bárbara | 16/11 | 20/11 | 2.5 |  |  |  |  | ■ |  |  |  |  |  |
| 2.7 | Dashboard General / Auditoría | Bárbara | 23/11 | 27/11 | 2.5 |  |  |  |  |  | ■ |  |  |  |  |
| 2.8 | Tabla comparativa y selector día/semana/mes | Bárbara | 30/11 | 04/12 | 2.7, 2.1 |  |  |  |  |  |  | ■ |  |  |  |
| **3** | **Sprint 3 – Integración híbrida** | | | | | | | | | | | | | | |
| 3.1 | Envío online Edge → AWS | Lisandra | 23/11 | 27/11 | 1.8, 2.3 |  |  |  |  |  | ■ |  |  |  |  |
| 3.2 | Modo offline y healthcheck de conexión | Lisandra | 30/11 | 04/12 | 3.1 |  |  |  |  |  |  | ■ |  |  |  |
| 3.3 | Sincronización por lotes (UUIDv4) y estados del sistema | Lisandra | 07/12 | 11/12 | 3.2 |  |  |  |  |  |  |  | ■ |  |  |
| 3.4 | TLS/MQTTS e IAM de mínimo privilegio (.env) | Felipe | 30/11 | 04/12 | 2.3 |  |  |  |  |  |  | ■ |  |  |  |
| 3.5 | RBAC y verificación Ley 19.628 (HH anónimas) | Felipe | 07/12 | 11/12 | 3.4 |  |  |  |  |  |  |  | ■ |  |  |
| 3.6 | Antigüedad del dato y aviso de modo offline | Bárbara | 07/12 | 11/12 | 3.2, 2.8 |  |  |  |  |  |  |  | ■ |  |  |
| 3.7 | Escenarios de prueba de alertas (kW +20 %, UV ≥ 8) | Sebastián | 30/11 | 04/12 | 2.4 |  |  |  |  |  |  | ■ |  |  |  |
| 3.8 | Simulación de corte de Internet | Sebastián | 07/12 | 11/12 | 3.2 |  |  |  |  |  |  |  | ■ |  |  |
| **4** | **Gestión, pruebas y entrega** | | | | | | | | | | | | | | |
| 4.1 | Kickoff, plan de trabajo y organización del repo | Abraham | 19/10 | 23/10 | — | ■ |  |  |  |  |  |  |  |  |  |
| 4.2 | Documentación continua y revisión de Pull Requests | Abraham | 26/10 | 25/12 | — |  | ■ | ■ | ■ | ■ | ■ | ■ | ■ | ■ | ■ |
| 4.3 | Redactar casos de prueba (5 pruebas de demostración) | Abraham | 23/11 | 27/11 | 1.4 |  |  |  |  |  | ■ |  |  |  |  |
| 4.4 | Ejecución de pruebas integrales 1–5 | Abraham | 14/12 | 18/12 | 3.3, 3.8, 3.6 |  |  |  |  |  |  |  |  | ■ |  |
| 4.5 | Ensayo y presentación final | Abraham | 21/12 | 25/12 | 4.4 |  |  |  |  |  |  |  |  |  | ■ |
| **5** | **Hitos** | | | | | | | | | | | | | | |
| 5.1 | Payload JSON definido | Equipo | 19/10 | 23/10 | 1.1 | ◆ |  |  |  |  |  |  |  |  |  |
| 5.2 | Datos fluyen ESP32 → MQTT → Edge (SQLite) | Equipo | 02/11 | 06/11 | 1.8 |  |  | ◆ |  |  |  |  |  |  |  |
| 5.3 | Dashboards y alertas listos | Equipo | 30/11 | 04/12 | 2.8, 2.4 |  |  |  |  |  |  | ◆ |  |  |  |
| 5.4 | Modo offline y sincronización funcionando | Equipo | 07/12 | 11/12 | 3.3 |  |  |  |  |  |  |  | ◆ |  |  |
| 5.5 | Demostración final | Equipo | 21/12 | 25/12 | 4.5 |  |  |  |  |  |  |  |  |  | ◆ |

**Hitos:** ◆ Payload JSON definido (S1) · ◆ Datos fluyen ESP32 → MQTT → Edge (S3) · ◆ Dashboards y alertas listos (S7) · ◆ Modo offline y sincronización funcionando (S8) · ◆ **Demostración final (S10)**

---

## 4. Cómo editar

1. Abrir `docs/nota-2/Induplac_Roles_Equipo.xlsx` en Excel (las fechas, totales y la columna *Control* de la RACI se calculan solas).
2. Actualizar también las tablas de esta página.
3. Entregar el cambio por Pull Request, como todo lo demás ([`CONTRIBUTING.md`](../CONTRIBUTING.md)).

---

## 5. Observaciones para revisar en equipo

Agregadas al subir el archivo (Abraham, 2026-10-18). Son **preguntas, no correcciones**:

1. **La RACI tiene 19 actividades y la pauta pide de 6 a 10** ([`NOTA-2.md`](NOTA-2.md) §1). Opción: agrupar (por ejemplo 2+3+4 «Captura IoT», 5+6+7 «Edge», 8+9+10 «Backend», 15+18 «Pruebas e integración») y dejar la versión larga como anexo.
2. **Lo ya construido no coincide con los responsables asignados.** El broker (tarea 2 del tablero), el dashboard (1) y el Edge (4) los hizo Abraham, y el backend (5) Abraham con Felipe. Hay que decidir si los roles describen lo que pasó o quién se hace cargo desde ahora (por ejemplo, Lisandra como dueña del Edge para pruebas y demo).
3. **La Gantt planifica como futuro cosas que ya existen** (payload, broker, Lambda, DynamoDB, SQLite, modo offline). La pauta pide la Gantt **hasta la puesta en marcha** con lógica PMI: instalación, pruebas, seguridad, capacitación y puesta en marcha. Esta Gantt calza mejor como plan de sprints (tarea 13); se puede complementar con la Gantt de implementación de [`NOTA-2.md`](NOTA-2.md) §5.
4. **Faltan las fortalezas** de cada integrante, que la pauta pide explícitamente (roles y fortalezas valen 15 %).
5. **Términos que difieren de lo implementado:** el Edge usa los estados ONLINE / OFFLINE / SINCRONIZANDO (sin ERROR) y lotes con `batch_id` + upsert idempotente, no UUIDv4 ([`modo-offline.md`](modo-offline.md)). RDS PostgreSQL quedó fuera del MVP (alertas en DynamoDB).
