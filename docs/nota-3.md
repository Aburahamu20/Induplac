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
| 1 | Problema y evolución del MVP (IL 1.6 · 10 %) | El problema, cómo se analizó y qué técnica se usó para llegar a sus causas (Design Thinking, 5 Porqués, Ishikawa u otra) | Problema y evolución en [`CONTEXTO.md`](CONTEXTO.md) y el README | ✅ [**5 Porqués** y evolución del MVP](nota-3/5-porques.md) (tarea 36): causa raíz + línea de tiempo `v0.1` → `v1.0` | — |
| 2 | Pipeline DevOps (IL 2.4 · 10 %) | Cómo se administra un cambio: requerimiento → desarrollo → Git → pruebas → validación → despliegue → operación → monitoreo → retroalimentación | [`devops.md`](devops.md): CI con pruebas, DevSecOps (PR #59), regla de `main`, despliegue con `/health` | **Ansible** (actividad 3.3.1) | ✅ Listo: CI con DevSecOps, `main` protegida, Ansible (tarea 33) y versiones con nombre (tarea 47) |
| 3 | Cliente-servidor y API REST (IL 3.3 · 10 %) | Cómo se envían y consultan los datos simulados; operaciones de envío y consulta | Endpoints en [`api-dashboard.md`](api-dashboard.md); arquitectura en [`arquitectura.md`](arquitectura.md) | ✅ Diagrama cliente-servidor, comandos de envío/consulta y las 5 capturas en [`nota-3/api-rest.md`](nota-3/api-rest.md) (tarea 34). Endpoints en [`api-dashboard.md`](api-dashboard.md) | — |
| 4 | Backend (IL 3.4 · 10 %) | Cómo recibe, valida, procesa, almacena y entrega la información, con la tecnología justificada | Lambdas en `backend/`, Edge en `edge/`; [`cloud-tecnologias.md`](cloud-tecnologias.md), [`decisiones-tecnicas.md`](decisiones-tecnicas.md) | ✅ [`nota-3/backend.md`](nota-3/backend.md): 5 pasos con capturas y por qué Lambda (tarea 35) | Felipe lo ensaya para el 25/11 |
| 5 | Ágil y Lean (IL 4.1 · 15 %) | Evidencia real: Product Backlog, historias de usuario, Sprint, Kanban, priorización, trabajo en proceso | [`scrum-pmi.md`](scrum-pmi.md), [`roles-raci-gantt.md`](roles-raci-gantt.md), [`EN-CURSO.md`](EN-CURSO.md) (nuestro Kanban), PRs en GitHub | **Product Backlog con historias de usuario priorizadas** y presentar EN-CURSO como Kanban | ✅ Listo (tarea 37). Scrum + PRINCE2 = PRINCE2 Agile ([`prince2.md`](nota-3/prince2.md)) |
| 6 | Transferencia tecnológica (IL 4.4 · 15 %) | Cómo el MVP pasa a una implementación real | Algo en [`conclusiones.md`](conclusiones.md) | ✅ [**Roadmap de transferencia**](nota-3/transferencia-tecnologica.md) (tarea 38): 8 etapas, ~13 semanas hasta la puesta en marcha, piloto en el Local 1 y metas | — |
| 7 | Gestión del equipo (IL 4.5 · 15 %) | Al menos una herramienta (lluvia de ideas, diagrama de afinidad, SIPOC u otra), qué información dio y cómo influyó en la solución | Roles y RACI en [`roles-raci-gantt.md`](roles-raci-gantt.md); decisiones del equipo en [`notas-de-avance.md`](notas-de-avance.md) | **SIPOC** o **afinidad** + qué decisiones cambió | ✅ Listo (tarea 39) |
| 8 | Herramientas de calidad (IL 4.6 · 15 %) | Usadas de verdad en el proyecto, no solo nombradas | Pruebas automáticas y quality gate en [`devops.md`](devops.md) | ✅ [**Plan de pruebas e inspección**](nota-3/plan-de-pruebas.md) (tarea 41): 112 pruebas en 17 requisitos + checklists. Quality gate en [`devops.md`](devops.md) | ✅ [**Ishikawa**](nota-3/ishikawa.md) (tarea 40): 18 causas en 6M con su control. ✅ [**PRINCE2**](nota-3/prince2.md) (tarea 49, pedido por el profe el 18/11): ordena todas las herramientas en un solo sistema de calidad. ✅ [**Gráfico de control**](nota-3/grafico-control.md) (tarea 42). El **diagrama de flujo** (pipeline y recorrido de un dato) también cuenta. Mostrar **cómo se usaron**, no solo nombrarlas |

> ⚠️ Los criterios 5 a 8 valen **60 % de la nota** y son los que menos tenemos.

## 3. Reparto (sugerido el 13/11, ajustar en el grupo)

| Integrante | Tareas |
|---|---|
| Abraham Castro | 33 Ansible · 34 API REST · 41 Plan de pruebas · 43 Evidencias · 49 PRINCE2 |
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

## 6. Notas para armar el PowerPoint (al final)

El PPT se arma al final, con todas las partes listas. Al armarlo:

- **Orden:** una sección por criterio, en el orden de la tabla de arriba, más la demo.
- **Criterio 1:** además de la técnica (5 Porqués), mostrar **cómo evolucionó el MVP**. La línea de tiempo sale de las versiones (`v0.1` diseño → `v0.2` demo del 21/10 → `v0.3` planta autónoma → `v0.4` roles, auditoría y umbrales → `v0.5` dashboard de 7 pantallas → `v0.6` DevSecOps → `v0.7` Ansible) y de los sprints de [`nota-3/backlog.md`](nota-3/backlog.md).
- **Criterio 2:** el diagrama del pipeline de [`devops.md`](devops.md) **con Ansible**, y la tabla que responde las 5 preguntas del PPT de preparación (quién cambió, si se probó, qué versión quedó, si quedó igual en todos los nodos y cómo saber si falló).
- **Criterio 3:** las dos operaciones **funcionando**: envío y consulta.
- **Criterio 8:** cada herramienta con **cómo se usó** en Induplac. Abrir la sección con **PRINCE2** (1 o 2 diapositivas, [`prince2.md`](nota-3/prince2.md) §8): el profe pidió enfocarse en eso, y el diagrama del tema Calidad muestra dónde va cada herramienta.
- **Diapositiva de cierre:** responder las 6 preguntas de la "idea central" del correo:

| El profe quiere ver… | Respuesta en Induplac |
|---|---|
| Cómo **recibe** datos | Wokwi → MQTT → Edge → `POST /intervalos` |
| Cómo los **procesa** | Validación en el Edge + reglas de alerta en el Edge y en la Lambda |
| Cómo los **almacena** | SQLite (planta), DynamoDB (datos y alertas), RDS (configuración) |
| Cómo los **consulta** | Dashboard → `GET /api/...` con token de Cognito, filtrado por rol y sede |
| Cómo **administra cambios** | Git + PR + CI con 6 controles + `main` protegida + versiones + Ansible + auditoría |
| Cómo **evolucionaría** a algo real | Roadmap de transferencia tecnológica (tarea 38) |

- **Lo de clases anteriores también cuenta:** la actividad 3.2.2 (DevSecOps, informe **entregado**) y la 3.3.1 (Ansible, tarea 33).

## 7. Después: examen

**Miércoles 16 de diciembre de 2026**, 19:01 a 21:51 h, sala PN-645 TALL, modalidad presentación. Lo de la Nota 3 se reutiliza.
