# 🗓️ Planificación: Scrum del MVP + PMI de la implementación

> **Autora:** Bárbara Saavedra (`barbaraantoniaa`). Tarea 13 de [`EN-CURSO.md`](EN-CURSO.md) · punto 9 de la pauta ([`pauta-entrega.md`](pauta-entrega.md)).
> Se complementa con la Carta Gantt de [`roles-raci-gantt.md`](roles-raci-gantt.md) §3: **S1–S3 = Scrum** y **S4–S12 = PMI**.

**Idea central:** Scrum explica **cómo construimos el prototipo (MVP)**; PMI explica **cómo se implementaría de verdad en Induplac**.

---

## 1. Planificación ágil del MVP (Scrum)

**¿Por qué Scrum?** El prototipo tiene muchas partes que dependen unas de otras (sensores, broker, Edge, nube y dashboard) y requisitos que fueron cambiando con las decisiones del equipo. Scrum permite avanzar en ciclos cortos, mostrar algo funcionando en cada uno y corregir a tiempo.

### Roles de Scrum

| Rol Scrum | Quién | Qué hace |
|---|---|---|
| Product Owner | **Abraham Castro** | Prioriza qué se hace primero según la pauta y las necesidades de la empresa. En el proyecto decidió qué entra al MVP y qué queda como diseño (RDS de uso puntual, VPN y VLANs solo diseño, Cognito para la demo). |
| Scrum Master | **Bárbara Saavedra** | Cuida que el equipo avance, quita bloqueos y mantiene el tablero al día. En el proyecto llevó la planificación (Scrum, PMI, Gantt) y el seguimiento de las tareas. |
| Equipo de desarrollo | Abraham, Sebastián, Lisandra, Felipe y Bárbara | Construyen y prueban cada parte del MVP. |

### Sprints (05/10 – 23/10/2026)

| Sprint | Objetivo | Resultado esperado |
|---|---|---|
| Sprint 1 (05–09/10) | Diseño y documentación | Contexto, arquitectura y decisiones técnicas en el repositorio. |
| Sprint 2 (12–16/10) | Captura y visualización | Broker MQTT funcionando, backend en AWS y dashboard con datos simulados. |
| Sprint 3 (19–23/10) | Integración híbrida y demo | ESP32 en Wokwi, Edge con modo offline, RDS PostgreSQL, Cognito y **demo el miércoles 21/10**. |

### Herramientas de seguimiento

- **Backlog y tablero:** [`docs/EN-CURSO.md`](EN-CURSO.md), cada tarea con dueño y estado (libre, en curso, en revisión, listo).
- **Revisión del trabajo:** cada cambio entra por un Pull Request que revisa otro integrante.
- **Chequeos automáticos (CI):** en cada Pull Request, GitHub Actions compila el dashboard y corre las pruebas del Edge antes de la revisión humana ([`devops.md`](devops.md)).
- **Bitácora:** [`docs/notas-de-avance.md`](notas-de-avance.md) registra lo terminado en cada fecha.

---

## 2. Gestión de la implementación (PMI, 5 fases)

**¿Por qué PMI aquí?** Instalar el sistema en una empresa real tiene fechas, compras, riesgos y capacitación que hay que planificar de antemano; eso se gestiona mejor de forma predictiva (PMBOK v6).

| Fase PMI | Qué se hace en Induplac | Entregable | Semanas |
|---|---|---|---|
| **1. Inicio** | Validar con la empresa objetivo, alcance, interesados (gerencia, jefes, operarios) y criterios de éxito. | Acta de inicio | S4 |
| **2. Planificación** | Diseño detallado, riesgos, compras (sensores reales, Raspberry Pi), RACI y Gantt. | Plan del proyecto | S5 |
| **3. Ejecución** | Instalar sensores y red, desplegar Edge, backend y dashboard, piloto en Local 1, capacitación y extensión a Local 2. | Sistema instalado y usuarios capacitados | S6–S10 |
| **4. Monitoreo y control** | Revisión semanal de avance y riesgos; pruebas de seguridad, corte de red y permisos. | Pruebas aprobadas | S4–S11 |
| **5. Cierre** | Aceptación por la empresa, entrega de documentación y lecciones aprendidas. | Acta de cierre | S12 |

---

## 3. Cómo se relacionan

Scrum entrega el **prototipo funcionando** (hito: demo del 21/10). Ese prototipo es el punto de partida de la fase de **Inicio** del PMI. La Carta Gantt muestra las dos partes seguidas: S1–S3 con Scrum y S4–S12 con PMI.

---

## 4. Falta que decida el equipo

- [x] **Product Owner:** Abraham · **Scrum Master:** Bárbara (definido el 21/10/2026). Son personas distintas, como pide Scrum.
- [ ] Si hubo reuniones fijas (en clases o por el grupo) para nombrarlas como revisión de sprint o reunión diaria.
- [x] Agregar **RDS PostgreSQL** a la Gantt y a las tareas de Felipe y Abraham (hecho el 19/10/2026, PR #15).
