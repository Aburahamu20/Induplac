# 🎯 Nota 2 — Pauta y borradores

> Resumen de lo que pide el profesor Marco Antonio Perelli para la Nota 2, y borradores de roles, RACI y Gantt para que el equipo los ajuste.
> **Las tareas para repartir están en [`docs/EN-CURSO.md`](EN-CURSO.md)** (tareas 9 a 18).
>
> ⚠️ Los roles, la RACI y la Gantt de este documento son **borradores**. La propuesta con nombres de Bárbara está en [`roles-raci-gantt.md`](roles-raci-gantt.md) (Excel en `docs/nota-2/`); falta que el equipo la valide.

---

## 1. Qué pide la pauta

**No es un proyecto nuevo.** Se usa el mismo MVP, arquitectura, documentación y decisiones, y se agrega lo necesario para una propuesta completa y fundamentada. Lo que se evalúa es **justificar las decisiones técnicas** y la **coherencia** entre problema, arquitectura y solución, no la cantidad de tecnologías nombradas.

| # | Entregable | Tarea | Estado |
|---|---|---|---|
| 1 | Presentación PowerPoint (problema, propuesta, alcance del MVP, funcionamiento) | 17 | ❌ |
| 2 | Equipo y roles: fortalezas, responsabilidades y participación | 9 | 🟡 `roles-raci-gantt.md`; **faltan las fortalezas** de cada uno |
| 3 | Matriz RACI | 10 | ✅ `roles-raci-gantt.md` (10 actividades) |
| 4 | Arquitectura técnica: recorrido del dato desde la captura hasta la visualización | — | ✅ `CONTEXTO.md`, `GUIA-EQUIPO.md` |
| 5 | Comunicación IoT: dispositivos, gateway, redes y protocolos, justificados | — | ✅ `CONTEXTO.md`, `infrastructure/README.md` |
| 6 | Cloud y Backend: recepción, procesamiento, almacenamiento, visualización y **modelo Cloud** | 11 | ✅ `cloud-tecnologias.md` + backend funcionando |
| 7 | Tecnologías y su aporte concreto | 11 | ✅ `cloud-tecnologias.md` |
| 8 | Pipeline DevOps básico (desarrollo → prueba → validación → despliegue) | 12 | ❌ |
| 9 | Planificación: ágil (MVP) + gestión de proyectos (implementación) | 13 | 🟡 `scrum-pmi.md`; **faltan** Product Owner y Scrum Master |
| 10 | Carta Gantt hasta pruebas, integración, seguridad, capacitación y puesta en marcha | 14 | ✅ `roles-raci-gantt.md` + Excel |
| 11 | Demostración del prototipo con datos ficticios | 1–4, 18 | 🟡 Prototipo funcionando de punta a punta (20/10); **falta el guion** |
| 12 | Conclusiones y defensa: problema, beneficios, limitaciones, siguientes pasos | 15 | ✅ `conclusiones.md` |
| 13 | Informe del proyecto actualizado | 16 | ❌ Confirmar formato |

**Orden que pide para la presentación:** Problema → MVP → Scrum → Arquitectura IoT → Comunicaciones → Cloud/Backend → Seguridad → DevOps → Roles/RACI → PMI/Carta Gantt → Prototipo funcional → Conclusiones.

### Lo que agregó la clase de PMI, roles y RACI
- **Ponderación:** roles y fortalezas **15 %** (IL 1.5); planificación ágil + PMI/Gantt **15 %** (IL 4.3).
- **PMI = gestión predictiva (PMBOK v6)** con 5 grupos de procesos: inicio, planificación, ejecución, monitoreo y control, y cierre. Se usa para **planificar la implementación real**, no para rehacer el proyecto.
- **Scrum, RACI y Gantt responden preguntas distintas:** Scrum explica cómo construimos el MVP; la RACI, quién hace qué; la Gantt, cuándo ocurre cada cosa y de qué depende.
- **RACI:** 6 a 10 actividades. Cada una con al menos un **R** y **un solo A**. Revisar que no haya tareas sin dueño ni con varios responsables finales.
- **Gantt:** responsables, duración, dependencias y al menos los hitos principales, hasta la puesta en marcha, más una explicación breve de la lógica PMI.
- **Entregables de la clase:** tabla de integrantes con rol principal y responsabilidades, justificación de cómo se repartió el trabajo, y la RACI revisada.

---

## 2. Roles (borrador, tarea 9)

> Propuesta con nombres: [`roles-raci-gantt.md`](roles-raci-gantt.md) §1.

El profe sugiere 4 roles para equipos de 4. **Somos 5**, así que se propone un quinto rol, **Seguridad y DevOps**, porque la pauta pide seguridad y pipeline DevOps como puntos propios y así ambos tienen dueño.

| Rol | Responsabilidades concretas | Integrante (principal / secundario) | Fortaleza |
|---|---|---|---|
| **Líder de proyecto (PM) e integración** | Coordina al equipo, mantiene la Gantt, los riesgos y las decisiones; consolida la presentación y el informe; integra las partes del MVP. | | |
| **IoT y conectividad** | Simulación ESP32 en Wokwi, broker EMQX, gateway Edge, VLANs, diseño de la VPN, continuidad offline. | | |
| **Cloud y backend** | API, Lambdas, DynamoDB y RDS, reglas de alertas, sincronización con el Edge. | | |
| **Frontend y calidad** | Dashboard, casos de prueba, evidencias y guion de la demo. | | |
| **Seguridad y DevOps** | Cognito con MFA, seguridad en 5 capas, pipeline (GitHub Actions), control de Pull Requests. | | |

> Una persona puede tener un rol secundario. Lo importante es declararlo y cumplirlo.

---

## 3. Matriz RACI (borrador, tarea 10)

> Propuesta con nombres: [`roles-raci-gantt.md`](roles-raci-gantt.md) §2.

**R** = ejecuta · **A** = responde por el resultado (uno solo) · **C** = se consulta · **I** = se informa

| Actividad | PM / Integración | IoT / Red | Cloud / Backend | Frontend / QA | Seguridad / DevOps |
|---|:-:|:-:|:-:|:-:|:-:|
| Definir alcance y criterios de éxito | **A** | C | C | C | I |
| Diseñar arquitectura IoT y red | C | **A/R** | C | I | C |
| Configurar broker y simulación en Wokwi | I | **A/R** | C | I | C |
| Desarrollar agente Edge (offline y sincronización) | I | **A/R** | R | C | C |
| Desarrollar backend y modelo de datos | I | C | **A/R** | C | C |
| Desarrollar dashboard y pruebas | I | C | C | **A/R** | C |
| Implementar seguridad (MFA, TLS, permisos) y pipeline DevOps | C | C | R | C | **A/R** |
| Integrar el MVP, la demo, la Gantt y la entrega final | **A/R** | R | R | R | R |

Revisión: las 8 actividades tienen un R y un solo A. ✅

---

## 4. Planificación ágil + PMI (borrador, tarea 13)

**Ágil (cómo construimos el MVP):** Scrum con backlog y sprints (ver README, sección 19: Sprint 1 captura de datos, Sprint 2 visualización, Sprint 3 integración híbrida). El tablero `EN-CURSO.md` y los Pull Requests funcionan como seguimiento del sprint.

**PMI (cómo se implementaría en Induplac):**

| Fase PMI | En Induplac |
|---|---|
| **Inicio** | Confirmar objetivo, alcance, interesados (gerencia, jefes, operarios) y criterios de éxito con la empresa. |
| **Planificación** | Tareas, responsables (RACI), tiempos (Gantt), riesgos, comunicaciones, compras (sensores reales, Raspberry Pi). |
| **Ejecución** | Instalar sensores y red, desplegar Edge, backend y dashboard, piloto, capacitación. |
| **Monitoreo y control** | Revisión semanal de avance, cambios, fallas, calidad, seguridad e hitos. |
| **Cierre** | Aceptación por la empresa, entrega de documentación, lecciones aprendidas. |

---

## 5. Carta Gantt (borrador, tarea 14)

> Versión con responsables y fechas: [`roles-raci-gantt.md`](roles-raci-gantt.md) §3.

Implementación **hipotética** desde el prototipo actual hasta la puesta en marcha. Duraciones por ajustar.

| # | Actividad | Fase PMI | Responsable (A) | Duración | Depende de | S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8 |
|---|---|---|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| 1 | Validar alcance y criterios con Induplac | Inicio | PM | 1 sem | — | ■ | | | | | | | |
| 2 | Diseño detallado, riesgos y compras | Planificación | PM | 1 sem | 1 | ■ | ■ | | | | | | |
| 3 | Instalación IoT y red (sensores, VLANs, VPN) | Ejecución | IoT | 2 sem | 2 | | ■ | ■ | | | | | |
| 4 | Backend y dashboard en producción | Ejecución | Cloud / Frontend | 2 sem | 2 | | | ■ | ■ | | | | |
| 5 | Pruebas y seguridad (corte de red, MFA, permisos) | Ejecución / Control | Seguridad | 1 sem | 3, 4 | | | | | ■ | | | |
| 6 | Piloto en Local 1 y capacitación | Ejecución | Frontend / PM | 1 sem | 5 | | | | | | ■ | | |
| 7 | Extensión a Local 2 | Ejecución | IoT | 1 sem | 6 | | | | | | | ■ | |
| 8 | Monitoreo y control | Control | PM | transversal | — | ■ | ■ | ■ | ■ | ■ | ■ | ■ | ■ |
| 9 | Cierre: aceptación, documentación y lecciones | Cierre | PM | 1 sem | 7 | | | | | | | | ■ |

**Hitos:** ◆ Acta de inicio (S1) · ◆ Red y sensores operativos (S3) · ◆ Pruebas aprobadas (S5) · ◆ **Puesta en marcha** (S8)

---

## 6. Pendiente de confirmar
- [ ] Fecha de entrega o presentación de la Nota 2.
- [ ] Validar la propuesta de roles de Bárbara y agregar la fortaleza de cada uno.
- [ ] Formato del informe (¿Word?) y si existe el de la Nota 1 para actualizarlo.
