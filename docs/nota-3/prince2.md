# 👑 PRINCE2 aplicado a Induplac — Nota 3

> **Autor:** Abraham Castro (con Claude). Tarea 49 de [`EN-CURSO.md`](../EN-CURSO.md) · criterio 8 de la pauta ([`nota-3.md`](../nota-3.md), herramientas de calidad, IL 4.6, 15 %) y apoyo al criterio 5 (Ágil y Lean).
> Origen: clase **3.4.1 "Asegurando la calidad de los productos y servicios desarrollados"** (18/11/2026). El profe pidió **enfocarse en PRINCE2**. Estado al **19/11/2026**.

**En resumen:** PRINCE2 es un método para **controlar** un proyecto por etapas, con roles claros y la calidad revisada en cada entrega. No lo agregamos como algo nuevo: le pone **nombre y orden** a lo que ya veníamos haciendo. **Scrum** es cómo **construimos** dentro de cada etapa, y **PRINCE2** es cómo **controlamos** el proyecto completo. Juntos son lo que se conoce como **PRINCE2 Agile**.

---

## 1. PRINCE2 explicado simple (para el equipo)

**PRINCE2** = *PRojects IN Controlled Environments* (proyectos en entornos controlados).

Piensa en construir una casa para un cliente:

- No se construye todo de una y se muestra al final. Se avanza **por etapas** (fundaciones, muros, techo) y al terminar cada una el **cliente revisa y decide** si se sigue.
- Cada persona sabe **qué le toca** (el arquitecto diseña, el maestro de obras dirige, los obreros construyen).
- El cliente **no supervisa cada ladrillo**. Pone límites ("máximo tanto de plata, termina en tal fecha") y solo lo llaman si algo se sale de esos límites. Eso es **gestionar por excepción**.
- Cada parte se **revisa contra lo que se pidió** antes de darla por terminada. Eso es la **calidad**.

En Induplac pasa lo mismo: el **profe** revisa en cada Nota, cada uno tiene su parte, y nada entra a `main` sin pasar las pruebas y la revisión de un compañero.

### Cómo se arma PRINCE2

| Pieza | Qué es | Cuántos |
|---|---|---|
| **Principios** | Las reglas que **siempre** se cumplen. Si falta uno, no es PRINCE2. | 7 |
| **Temas** (en la edición 2023 se llaman **prácticas**) | Lo que hay que cuidar **todo el tiempo**: caso de negocio, organización, calidad, planes, riesgos, cambios y progreso. | 7 |
| **Procesos** | **Qué se hace en cada momento**, desde que nace el proyecto hasta que se cierra. | 7 |
| **Roles** | Quién decide, quién dirige y quién construye. | Junta, director, equipo y apoyo |

> 💡 **Si el profe pregunta por la versión:** el PPT de la clase usa los nombres de la 6.ª edición. La **7.ª edición (2023)** mantiene los 7 principios y los 7 procesos, cambia "temas" por **"prácticas"** (el tema *Cambio* pasa a llamarse *Problemas*) y agrega **Personas** como elemento central.

---

## 2. Los 7 principios en Induplac (con evidencia)

| # | Principio | Qué significa | Cómo lo cumplimos en Induplac | Evidencia |
|---|---|---|---|---|
| 1 | **Justificación comercial continua** | El proyecto debe tener sentido para la empresa durante todo el camino, no solo al inicio. | El problema (la medición del consumo existe para pagar la boleta, no para operar, así que nadie reacciona a tiempo) se analizó con 5 Porqués y se revisó en cada Nota. Las tecnologías se eligieron también por costo: Lambda solo cobra cuando se usa y RDS se mantiene apagado. | [`5-porques.md`](5-porques.md), [`cloud-tecnologias.md`](../cloud-tecnologias.md) |
| 2 | **Aprender de la experiencia** | Registrar lo aprendido y usarlo en lo que viene. | Bitácora con cada decisión, problema y corrección. Las causas del Ishikawa salieron de **problemas reales** que tuvimos. | [`notas-de-avance.md`](../notas-de-avance.md), [`ishikawa.md`](ishikawa.md) |
| 3 | **Roles y responsabilidades definidos** | Cada uno sabe qué le toca y de qué responde. | Roles del equipo, matriz RACI (un solo responsable final por actividad) y reparto por criterio de la Nota 3. | [`roles-raci-gantt.md`](../roles-raci-gantt.md), [`nota-3.md`](../nota-3.md) §3 |
| 4 | **Gestión por etapas** | Avanzar por etapas con una revisión al final de cada una. | Sprints semanales agrupados en etapas que cierran con una evaluación del profe (ver §4). | [`backlog.md`](backlog.md), [`scrum-pmi.md`](../scrum-pmi.md) |
| 5 | **Gestión por excepción** | Se fijan límites (tiempo, costo, alcance, calidad). Dentro de ellos el equipo decide solo; si algo se sale, se escala. | Las tareas del día a día las resuelve quien las tiene. Lo que cambiaba el plan se llevó al equipo como **excepción** (ver la tabla de abajo). | [`decisiones-tecnicas.md`](../decisiones-tecnicas.md), [`notas-de-avance.md`](../notas-de-avance.md) |
| 6 | **Enfoque en productos** | Definir **qué se entrega** y **cuándo está bien hecho** antes de construirlo. | Historias de usuario con criterios de aceptación, contrato de datos de la API antes de programar y criterio de aceptación de cada cambio (CI + revisión). | [`backlog.md`](backlog.md), [`api-dashboard.md`](../api-dashboard.md), [`plan-de-pruebas.md`](plan-de-pruebas.md) §3 |
| 7 | **Adaptar al proyecto** | Usar PRINCE2 a la medida, no todo el papeleo. | Somos 5 personas en un ramo: no hay actas formales. Los "documentos" de PRINCE2 son archivos del repo y las aprobaciones son Pull Requests. | Este archivo, §3 y §5 |

### Excepciones reales (principio 5)

Cada una se salía de lo planificado, así que **no la decidió una persona sola**: se llevó al equipo, se decidió y quedó registrada.

| Excepción | Qué pasó | Qué se decidió |
|---|---|---|
| **Broker MQTT** | HiveMQ no tenía un plan gratis permanente. | Cambio a **EMQX Serverless** (tarea 2). |
| **RDS PostgreSQL** | Estaba fuera del MVP, pero se necesitaba la configuración (permisos y umbrales). | Vuelve al MVP **solo para configuración** y apagado cuando no se usa. |
| **Edge en el PC** | La demo dependía del PC de Abraham. | El Edge pasa a correr como servicio en **2 EC2 (una por sede)**, instalado con Ansible. |
| **VPN** | Implementarla no cabía en el tiempo ni en el Learner Lab. | Queda **solo como diseño**. |

---

## 3. Los 7 procesos: qué hicimos en cada uno

| # | Proceso PRINCE2 | Qué pide | Qué hicimos en Induplac |
|---|---|---|---|
| 1 | **Puesta en marcha** (*Starting up*) | Un mandato con la necesidad y un resumen del proyecto. ¿Vale la pena empezar? | La **pauta del profe** fue el mandato. Con ella escribimos el contexto y el problema de Induplac. |
| 2 | **Dirigir el proyecto** (*Directing*) | La junta autoriza el inicio, cada etapa y el cierre, y da dirección cuando hace falta. | El **profe** revisa en cada evaluación y entrega pautas nuevas. El **equipo** aprueba los cambios grandes en el grupo (por ejemplo, los bocetos del dashboard, aprobados el 01/11). |
| 3 | **Iniciar el proyecto** (*Initiating*) | Planificar: enfoques de riesgo, cambios, calidad y comunicación, más el **PID** (documentación de inicio). | Nuestro **PID** es el conjunto [`CONTEXTO.md`](../CONTEXTO.md) + [`arquitectura.md`](../arquitectura.md) + [`decisiones-tecnicas.md`](../decisiones-tecnicas.md) + [`roles-raci-gantt.md`](../roles-raci-gantt.md). El enfoque de cambios es rama + PR, y el de comunicación, el grupo del equipo y el README. |
| 4 | **Controlar una etapa** (*Controlling a Stage*) | Repartir **paquetes de trabajo**, revisar el avance, registrar problemas y riesgos, y escalar lo que se sale de los límites. | Cada **tarea de [`EN-CURSO.md`](../EN-CURSO.md)** es un paquete de trabajo, con dueño, fecha y estado. La bitácora es el informe de avance. Una tarea sin avance por más de 7 días se conversa en el grupo. |
| 5 | **Gestionar la entrega de productos** (*Managing Product Delivery*) | Aceptar, hacer y entregar un paquete de trabajo. | **Reservar** la tarea (🟡) → trabajar en una **rama** → abrir un **PR** (🔵) → pasar el **CI** y la **revisión** → **merge** (✅). |
| 6 | **Gestionar el límite de una etapa** (*Managing a Stage Boundary*) | Revisar cómo terminó la etapa, actualizar el plan y planificar la siguiente. Si algo se salió, hacer un **plan de excepción**. | Antes de cada evaluación revisamos la pauta contra lo hecho y armamos el plan de la etapa siguiente. Por ejemplo, [`nota-3.md`](../nota-3.md) tiene criterios, peso, qué falta, reparto y fechas. El paso del Edge a las EC2 fue un plan de excepción. |
| 7 | **Cerrar el proyecto** (*Closing*) | Entregar, evaluar y dejar las lecciones aprendidas. | Pasa con el **examen (16/12)**. Se entrega el [roadmap de transferencia](transferencia-tecnologica.md) (cómo seguiría en Induplac), las [conclusiones](../conclusiones.md) y las lecciones de la bitácora. |

---

## 4. Nuestras etapas

| Etapa | Sprints | Qué se construyó | Cómo se cerró (límite de etapa) |
|---|---|---|---|
| **1. Inicio** | Sprint 1 (05–09/10) | Contexto, arquitectura y decisiones técnicas. | Plan del MVP y reparto de tareas. |
| **2. MVP** | Sprints 2–3 (12–23/10) | Broker, Edge con modo offline, backend en AWS, Cognito y dashboard. | **Demo del 21/10** y entrega de la **Nota 2**. |
| **3. Mejoras y Nota 3** | Sprints 4–7 (26/10–22/11) | Roles por sede, auditoría, dashboard de 7 pantallas, DevSecOps, Ansible y herramientas de calidad. | **Presentación del 25/11** (Nota 3). |
| **4. Cierre** | Hasta el 16/12 | Ajustes según la retroalimentación de la Nota 3. | **Examen** y cierre del proyecto. |

> Las versiones con nombre de Git (`v0.1` a `v0.7`, en [`devops.md`](../devops.md)) marcan lo que quedó al terminar cada parte.

---

## 5. Roles PRINCE2 ↔ nuestro equipo

| Rol PRINCE2 | Qué hace | En Induplac |
|---|---|---|
| **Junta del proyecto: ejecutivo** | Dueño del proyecto. Decide si se sigue y responde por la justificación. | **Profesor Marco Perelli** (evalúa y autoriza cada etapa). |
| **Junta: usuario principal** | Representa a quienes van a usar el resultado. | **Induplac**, con usuarios ficticios: jefes de planta y operarios. Lo representan las historias de usuario. |
| **Junta: proveedor principal** | Representa a quienes construyen. | **El equipo**, con AWS, EMQX y GitHub como plataformas. |
| **Director del proyecto** | Planifica, supervisa y lleva el día a día dentro de los límites. | **Abraham Castro** (Product Owner: prioriza y decide qué entra al MVP). |
| **Jefe de equipo** | Dirige el trabajo técnico de su parte. | Por área: **Abraham y Felipe** (AWS, backend y Edge), **Sebastián** (Wokwi), **Bárbara y Lisandra** (documentación). |
| **Apoyo del proyecto** (administrador) | Lleva el tablero, la planificación y los documentos al día. | **Bárbara Saavedra** (Scrum Master: Gantt, RACI y tablero). |
| **Aseguramiento del proyecto** | Revisa de forma independiente que se cumpla lo prometido. | El **CI con 6 controles** y la **revisión de cada PR por otro integrante**. |
| **Autoridad de cambios** | Aprueba o rechaza cambios. | La regla **`proteger-main`**: nada entra sin CI en verde y sin revisión. |

> En PRINCE2 Agile, el Product Owner y el Scrum Master no desaparecen: Scrum organiza el trabajo **dentro** del equipo y PRINCE2 lo conecta con quien **evalúa y decide** (la junta).

---

## 6. El tema Calidad: cómo encajan nuestras herramientas

Este es el corazón para el **criterio 8**. PRINCE2 ordena la calidad en **dos partes**: **planificar** qué es "bien hecho" y **controlar** que se cumpla. Nuestras herramientas calzan en cada paso:

```text
 PLANIFICAR LA CALIDAD                               CONTROLAR LA CALIDAD
 ─────────────────────                               ────────────────────
 Expectativas del cliente ─► Criterios de ─► Enfoque de ─► Control ─► Registro de ─► Aceptación
 (qué espera Induplac)       aceptación      calidad       (probar e  calidad        (merge /
                                                           inspeccionar)              evaluación)
```

| Paso PRINCE2 | Qué es | Nuestra herramienta |
|---|---|---|
| **Expectativas de calidad** | Lo que el cliente espera, en sus palabras. | *"Que una alerta llegue a tiempo a quien debe actuar"*, *"que no se pierdan datos sin internet"*, *"que cada uno vea solo lo suyo"*. Salen de las historias de usuario ([`backlog.md`](backlog.md)). |
| **Criterios de aceptación** | Medibles: cuándo algo está bien hecho. | Criterio de aceptación de cada cambio: 100 % de pruebas OK, sin secretos, sin vulnerabilidades altas, etc. ([`plan-de-pruebas.md`](plan-de-pruebas.md) §3). |
| **Enfoque de gestión de calidad** | Cómo y cuándo se revisa, y quién lo hace. | El **plan de pruebas e inspección**: 17 requisitos, cada uno con sus pruebas y responsables ([`plan-de-pruebas.md`](plan-de-pruebas.md)). |
| **Control de calidad** | Probar e inspeccionar cada producto. | **CI** en cada PR: 112 pruebas automáticas, SAST, DAST con ZAP y revisión de dependencias. Además, **checklists de inspección** al revisar un PR, al desplegar y antes de la demo. |
| **Registro de calidad** | Dónde queda anotado **qué se revisó, cuándo y con qué resultado**. | La **matriz requisito → pruebas → resultado** ([`plan-de-pruebas.md`](plan-de-pruebas.md) §4), el **historial de checks de cada PR** en GitHub y los reportes de ZAP en [`evidencias/`](evidencias/). |
| **Análisis de causas** | Cuando algo puede fallar, buscar por qué. | **Ishikawa**: 18 causas en 6M sobre "las alertas no llegan a tiempo", cada una con su control ([`ishikawa.md`](ishikawa.md)). |
| **Seguimiento en el tiempo** | Ver si el proceso se mantiene estable. | **Gráfico de control** con los datos simulados de consumo (tarea 42). |
| **Aceptación** | El cliente acepta el producto. | **Merge a `main`** (aceptación de cada paquete) y la **evaluación del profe** (aceptación de cada etapa). |

**Por qué importa:** sin PRINCE2, el Ishikawa, el plan de pruebas y el gráfico de control parecen herramientas sueltas. Con PRINCE2 se ve que forman **un solo sistema de calidad**: primero definimos qué es "bien hecho", después lo controlamos en cada cambio y dejamos registro.

---

## 7. Lo que no aplicamos completo (y por qué)

PRINCE2 pide adaptarse al proyecto (principio 7), así que lo decimos con honestidad:

- **No hay actas ni informes formales.** Los reemplazan los PR, la bitácora y el tablero, que quedan en el repo con fecha y autor.
- **El caso de negocio no tiene números reales de Induplac**, porque los datos son ficticios (Ley 19.628). Se justifica con el problema y con el costo de las tecnologías.
- **La junta no es una junta de verdad.** El profe evalúa, pero no aprueba presupuesto. En una implementación real, la junta sería la gerencia de Induplac (ver el [roadmap de transferencia](transferencia-tecnologica.md)).

---

## 8. Para la presentación (1 o 2 diapositivas, dentro del criterio 8)

**Diapositiva 1: PRINCE2 en Induplac**

- **PRINCE2** = proyectos en entornos controlados: **por etapas**, con **roles claros** y la **calidad revisada** en cada entrega.
- Lo usamos junto con Scrum (**PRINCE2 Agile**): Scrum para **construir**, PRINCE2 para **controlar**.
- **Etapas** que cierran con la evaluación del profe (demo 21/10 → Nota 3 25/11 → examen 16/12).
- **Gestión por excepción:** el broker, RDS y el Edge en EC2 se decidieron como excepciones del plan.

**Diapositiva 2: el sistema de calidad**

- El diagrama de §6: expectativas → criterios de aceptación → plan de pruebas → CI e inspección → registro → aceptación.
- Las herramientas en su lugar: **Ishikawa** (causas), **plan de pruebas** (control y registro) y **gráfico de control** (seguimiento).

### Preguntas probables

**¿Por qué PRINCE2 si ya usan Scrum?**
> Scrum organiza el trabajo semana a semana, pero no dice cómo se controla el proyecto completo ni quién autoriza cada etapa. PRINCE2 agrega eso: etapas con revisión, roles de decisión y un sistema de calidad. Se complementan; eso es PRINCE2 Agile.

**¿Y el PMI que aparece en la planificación?**
> PMI lo usamos para planificar la **implementación real** en Induplac (fases, Gantt). PRINCE2 se enfoca en el **control** del proyecto, y ahí brilla el tema Calidad. No se contradicen: PMI es una guía de buenas prácticas y PRINCE2 es un método con procesos y roles definidos.

**¿Qué es gestionar por excepción en su proyecto?**
> Cada uno resuelve su tarea sin pedir permiso. Pero si algo cambia el plan, como el broker o el Edge en EC2, se lleva al equipo, se decide y queda registrado.

**¿Cuál es su registro de calidad?**
> La matriz del plan de pruebas (qué requisito, qué pruebas, qué resultado) y el historial de checks de cada Pull Request en GitHub. Ahí queda qué se revisó, cuándo y con qué resultado.
