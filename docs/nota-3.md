# 🎓 Nota 3 — Qué pide el profe y quién hace qué

> **Presentación y entrega: miércoles 25 de noviembre de 2026.** Pauta enviada por el profesor Marco Perelli (Blackboard, 11/11/2026).
> Las tareas están en [`EN-CURSO.md`](EN-CURSO.md) (**33 a 43**, más la 17 y la 18). Antes de empezar una, resérvala (ver [`AGENTS.md`](../AGENTS.md)).
> La pauta de la entrega anterior está en [`pauta-entrega.md`](pauta-entrega.md).

---

## 1. Qué pide la pauta

**No es un proyecto nuevo.** Se toma el MVP, la arquitectura, la documentación y los avances que ya tenemos, y se agregan los contenidos de esta etapa: cliente-servidor, API REST, backend, DevOps, Ágil/Lean, transferencia tecnológica, gestión de equipos y herramientas de calidad. Lo hecho en las clases anteriores (actividades 3.2.2 y 3.3.1) también cuenta.

- **Exposición:** mínimo **15 minutos** por equipo. Hay que explicar técnicamente, **argumentar las decisiones** y demostrar dominio. No se espera algo superficial.
- **Demo en vivo** del flujo: datos IoT simulados → cliente/gateway → API REST → backend → procesamiento → almacenamiento → reglas/alertas → consulta → dashboard.
- **Datos:** siempre ficticios o simulados. Nada de datos ni sistemas reales de Induplac.
- **Entregables:** el **PowerPoint completo**, la **grabación** de la presentación y las **evidencias** del funcionamiento y de las decisiones técnicas.
- **Idea central:** mostrar cómo la solución recibe, procesa, almacena y consulta los datos, cómo administra los cambios y cómo podría pasar a una implementación real.

## 2. Criterios, peso y estado

| # | Criterio (IL · peso) | Qué hay que mostrar | Qué ya tenemos | Qué falta | Tarea |
|---|---|---|---|---|---|
| 1 | Problema y evolución del MVP (IL 1.6 · 10 %) | El problema, cómo se analizó y qué técnica se usó para llegar a sus causas (Design Thinking, 5 Porqués, Ishikawa u otra) | Problema y evolución en [`CONTEXTO.md`](CONTEXTO.md) y el README | Aplicar **5 Porqués** | 36 |
| 2 | Pipeline DevOps (IL 2.4 · 10 %) | Cómo se administra un cambio: requerimiento → desarrollo → Git → pruebas → validación → despliegue → operación → monitoreo → retroalimentación | [`devops.md`](devops.md): CI con pruebas, DevSecOps (PR #59), regla de `main`, despliegue con `/health` | **Ansible** (actividad 3.3.1) | 33 |
| 3 | Cliente-servidor y API REST (IL 3.3 · 10 %) | Cómo se envían y consultan los datos simulados; operaciones de envío y consulta | Endpoints en [`api-dashboard.md`](api-dashboard.md); arquitectura en [`arquitectura.md`](arquitectura.md) | **Diagrama cliente-servidor** + **demo con curl o Postman** | 34 |
| 4 | Backend (IL 3.4 · 10 %) | Cómo recibe, valida, procesa, almacena y entrega la información, con la tecnología justificada | Lambdas en `backend/`, Edge en `edge/`; [`cloud-tecnologias.md`](cloud-tecnologias.md), [`decisiones-tecnicas.md`](decisiones-tecnicas.md) | Explicación en 5 pasos + **por qué Lambda y no Flask/FastAPI** | 35 |
| 5 | Ágil y Lean (IL 4.1 · 15 %) | Evidencia real: Product Backlog, historias de usuario, Sprint, Kanban, priorización, trabajo en proceso | [`scrum-pmi.md`](scrum-pmi.md), [`roles-raci-gantt.md`](roles-raci-gantt.md), [`EN-CURSO.md`](EN-CURSO.md) (nuestro Kanban), PRs en GitHub | **Product Backlog con historias de usuario priorizadas** y presentar EN-CURSO como Kanban | 37 |
| 6 | Transferencia tecnológica (IL 4.4 · 15 %) | Cómo el MVP pasa a una implementación real | Algo en [`conclusiones.md`](conclusiones.md) | **Roadmap:** validación → piloto → pruebas → documentación → capacitación → puesta en marcha → soporte → mejora continua | 38 |
| 7 | Gestión del equipo (IL 4.5 · 15 %) | Al menos una herramienta (lluvia de ideas, diagrama de afinidad, SIPOC u otra), qué información dio y cómo influyó en la solución | Roles y RACI en [`roles-raci-gantt.md`](roles-raci-gantt.md); decisiones del equipo en [`notas-de-avance.md`](notas-de-avance.md) | **SIPOC** o **afinidad** + qué decisiones cambió | 39 |
| 8 | Herramientas de calidad (IL 4.6 · 15 %) | Usadas de verdad en el proyecto, no solo nombradas | Pruebas automáticas y quality gate en [`devops.md`](devops.md) | **Ishikawa**, **plan de pruebas/inspección**, **gráfico de control** | 40, 41, 42 |

> ⚠️ Los criterios 5 a 8 valen **60 % de la nota** y son los que menos tenemos.

## 3. Reparto (sugerido el 13/11, ajustar en el grupo)

| Integrante | Tareas |
|---|---|
| Abraham Castro | 33 Ansible · 34 API REST · 41 Plan de pruebas · 43 Evidencias |
| Felipe Murúa | 33 Ansible · 34 API REST (demo) · 35 Backend |
| Sebastián Fuentes | 23 Wokwi para la demo · 42 Gráfico de control |
| Bárbara Saavedra | 37 Ágil y Lean · 39 Gestión del equipo · 17 PowerPoint |
| Lisandra González | 36 5 Porqués · 38 Transferencia tecnológica · 40 Ishikawa |
| Todos | 18 Guion y ensayo de la demo · 17 PowerPoint · grabación |

## 4. Fechas

| Hasta | Qué |
|---|---|
| 16/11 | Lo técnico cerrado: Ansible, tareas 20, 23 y 31, demo probada de punta a punta |
| 19/11 | Criterios 1 y 5 a 8 listos (cada uno con su archivo en `docs/nota-3/`) |
| 22/11 | PowerPoint armado, una sección por criterio en el orden de la tabla |
| 24/11 | Ensayo cronometrado (≥ 15 min), grabación y carpeta de evidencias |
| **25/11** | **Presentación** |

## 5. Cómo entregar cada parte

- Cada criterio va en su archivo dentro de **`docs/nota-3/`** (por ejemplo `docs/nota-3/5-porques.md`, `docs/nota-3/backlog.md`). Las imágenes van en `docs/nota-3/img/`.
- **Rama + Pull Request siempre:** desde el 13/11, `main` está protegida (ruleset `proteger-main`) y no acepta commits directos. Ver [`AGENTS.md`](../AGENTS.md).
- Todo con datos ficticios y relacionado con **nuestro** Induplac: nada genérico copiado.
- Al terminar: entrada en [`notas-de-avance.md`](notas-de-avance.md) y aviso en el grupo con el link al PR.

## 6. Después: examen

**Miércoles 16 de diciembre de 2026**, 19:01 a 21:51 h, sala PN-645 TALL, modalidad presentación. Lo de la Nota 3 se reutiliza.
