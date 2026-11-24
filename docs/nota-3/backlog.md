# 🧩 Ágil y Lean: Product Backlog y tablero Kanban — Nota 3

> **Autora:** Bárbara Saavedra (`barbaraantoniaa`), Scrum Master. Tarea 37 de [`EN-CURSO.md`](../EN-CURSO.md) · criterio 5 de la pauta ([`nota-3.md`](../nota-3.md), IL 4.1, 15 %).
> **Product Owner:** Abraham Castro. Estado al **24/11/2026** (la foto del tablero de más abajo es del 14/11). La evidencia de cada historia es una tarea del tablero y sus Pull Requests en GitHub.

**En resumen:** el MVP se construyó con **Scrum** (sprints de una semana desde el 05/10) y se gestionó con un tablero **Kanban** en el repositorio. De las 21 historias de usuario del backlog, **16 están listas**, 3 en curso y 2 quedan fuera de esta etapa (al 24/11; el 14/11 eran 13 listas y 6 en curso o pendientes).

---

## 1. Product Backlog

Las historias están escritas desde quien usa el sistema en Induplac y ordenadas por prioridad con el método **MoSCoW**:

- **Must (Debe):** sin esto el sistema no resuelve el problema.
- **Should (Debería):** importante, pero el MVP funciona sin ello.
- **Could (Podría):** mejora deseable si queda tiempo.
- **Won't (No en esta etapa):** acordado dejarlo para después.

### Épicas

| Épica | Qué agrupa |
|---|---|
| E1 · Captura y conectividad | Sensores simulados, MQTT y el broker |
| E2 · Edge y modo offline | Lo que pasa en la planta, con o sin internet |
| E3 · Nube y alertas | Recepción, reglas de alerta y almacenamiento en AWS |
| E4 · Dashboard y consulta | Lo que ve cada usuario |
| E5 · Seguridad y acceso | Cuentas, permisos, MFA y auditoría |
| E6 · Calidad y DevOps | Pruebas, pipeline y despliegue |

### Historias de usuario

| ID | Historia de usuario | Épica | Prioridad | Criterio de aceptación | Estado | Evidencia |
|---|---|---|---|---|---|---|
| HU-01 | Como **jefe de planta**, quiero ver la energía, el agua y el UV de cada sede cada pocos minutos, para detectar anomalías el mismo día y no con la boleta. | E1, E4 | Must | El dashboard muestra los datos de Wokwi con menos de 15 min de atraso. | ✅ Listo | Tareas 1, 3, 4 y 5 · PR #16, #18 |
| HU-02 | Como **jefe de planta**, quiero una alerta cuando la energía supere en 20 % el promedio de esa hora, para encontrar máquinas encendidas fuera de turno. | E3 | Must | Con la perilla de energía sobre el umbral aparece la alerta de energía. | ✅ Listo | Tarea 4 · PR #18 · pruebas del CI |
| HU-03 | Como **operario en los patios**, quiero una alerta cuando el UV llegue a 8 o más, para protegerme a tiempo. | E3 | Must | Con UV ≥ 8 aparece la alerta UV, con o sin internet. | ✅ Listo | Tarea 4 · PR #18 |
| HU-04 | Como **jefe de mantenimiento**, quiero una alerta de posible fuga cuando hay consumo de agua fuera de horario, para cortarla antes de la factura. | E3 | Must | Caudal sobre el umbral entre 22:00 y 06:00 genera alerta de fuga. | ✅ Listo | Tarea 4 · PR #18 |
| HU-05 | Como **jefe de planta**, quiero seguir viendo los datos y las alertas aunque se corte internet, para no quedar a ciegas. | E2 | Must | Al cortar la conexión a AWS, el dashboard de planta sigue con datos y alertas (OFFLINE). | ✅ Listo | Tareas 4 y 22 · PR #18, #30 |
| HU-06 | Como **gerente**, quiero que al volver internet se suba todo lo pendiente sin perder ni duplicar datos, para confiar en los reportes. | E2, E3 | Must | Tras reconectar: SINCRONIZANDO → ONLINE y la misma cantidad de intervalos en la nube. | ✅ Listo | Tareas 4 y 8 · PR #16, #18 |
| HU-07 | Como **administrador**, quiero crear cuentas con clave temporal y MFA, para que solo entre personal autorizado. | E5 | Must | Un usuario nuevo debe cambiar la clave y registrar MFA en su primer ingreso. | ✅ Listo | Tareas 6 y 28 · PR #20 |
| HU-08 | Como **equipo de TI**, quiero que la API solo responda a quien tenga una sesión válida, para que nadie consulte datos sin permiso. | E5 | Must | Una consulta sin token válido es rechazada. | ✅ Listo | Tarea 20 (authorizer JWT, 02/11) |
| HU-09 | Como **equipo**, quiero que cada cambio pase pruebas automáticas y un escaneo de seguridad antes de unirse, para no romper lo que funciona. | E6 | Must | Un Pull Request con pruebas fallidas no se puede unir a `main`. | ✅ Listo | Tareas 12 y 32 · PR #59 · regla `proteger-main` |
| HU-10 | Como **administrador de sede**, quiero que cada usuario vea solo su sede y lo que su rol permite, para dar el acceso mínimo necesario. | E5 | Should | Un usuario de Planta no ve los datos de Oficinas. | ✅ Listo | Tarea 26 · PR #33 |
| HU-11 | Como **administrador**, quiero cambiar los umbrales de alerta desde el dashboard, sin tocar código. | E3, E4 | Should | Un umbral cambiado se aplica a las alertas siguientes en la nube. | ✅ Listo | Tareas 21 y 28 · PR #42 |
| HU-12 | Como **jefe**, quiero reconocer una alerta dejando un comentario, para que el equipo sepa que alguien la atendió. | E4 | Should | La alerta reconocida muestra quién, cuándo y el comentario. | ✅ Listo | Tarea 28 |
| HU-13 | Como **gerente**, quiero comparar el histórico entre sedes y períodos, para ver si las medidas de ahorro funcionan. | E4 | Should | La pantalla de histórico compara sedes y rangos de fechas. | ✅ Listo | Tarea 30 · PR #45–#58 |
| HU-14 | Como **administrador general**, quiero un registro que nadie pueda borrar de quién cambió qué, para auditar los cambios. | E5 | Should | Cada cambio queda en la auditoría y no existe opción para borrarlo. | 🟡 En curso | Tarea 27 lista (nube) · tarea 29 en curso (Edge) |
| HU-15 | Como **jefe de planta**, quiero que las alertas sin internet usen los mismos umbrales que la nube, para que no haya dos reglas distintas. | E2 | Should | El Edge descarga los umbrales al sincronizar y los usa offline. | 🟡 En curso | Tarea 44 |
| HU-16 | Como **jefe de mantenimiento**, quiero que la oficina también envíe sus datos, para comparar las dos sedes reales. | E1 | Should | El Local 2 aparece con datos propios en el dashboard. | 🟡 En curso | Tarea 23 |
| HU-17 | Como **equipo de TI de Induplac**, quiero configurar el Edge con Ansible, para instalarlo igual en cada sede sin errores manuales. | E6 | Should | El playbook deja el Edge listo y, al correrlo dos veces, no cambia nada. | ✅ Listo | Tarea 33 · PR #64 · capturas en `nota-3/img/ansible-*` |
| HU-18 | Como **jefe**, quiero que el MFA sea obligatorio para jefes y administradores y opcional para operarios, para equilibrar seguridad y facilidad. | E5 | Could | Un jefe sin MFA no puede entrar; un operario sí. | ✅ Listo | Tarea 31 · PR #35 |
| HU-19 | Como **jefe de planta**, quiero ver de un vistazo si una sede está al día, con datos antiguos o sin datos, para saber si confiar en lo que veo. | E4 | Could | Cada tarjeta muestra su estado y el aviso distingue servidor caído, sede sin datos y Edge sin nube. | ✅ Listo | Tarea 30 (parte 6) · PR #27 |
| HU-20 | Como **jefe de planta**, quiero recibir las alertas en el celular, para enterarme aunque no esté frente al computador. | E4 | Won't | — | Fuera de esta etapa | Decisión del 04/11: PWA después del rediseño |
| HU-21 | Como **gerente**, quiero comparar estaciones del año (esta primavera contra la anterior). | E4 | Won't | — | Fuera de esta etapa | Idea estacionada (notas de avance) |

**Cómo se priorizó:** primero lo que resuelve los tres problemas de Induplac (detección tardía, riesgo UV y ceguera sin internet), luego seguridad y acceso, y al final las mejoras de comodidad. Las historias Must del problema central (HU-01 a HU-06) se terminaron antes de la demo del 21/10. HU-07 y HU-09 se completaron en los sprints 4 y 5, y HU-08 entró al backlog después de la demo, cuando quedó anotado que la API todavía no validaba el token.

---

## 2. Sprints

Se trabajó en **sprints de una semana**. Cada sprint tuvo un objetivo, y lo terminado se integró por Pull Request.

| Sprint | Fechas | Objetivo | Resultado | Evidencia |
|---|---|---|---|---|
| 1 | 05–09/10 | Diseño y documentación | Arquitectura, 10 decisiones técnicas y tablero de tareas | PR #3–#7 |
| 2 | 12–16/10 | Captura y visualización | Broker MQTT, contrato de datos y base del dashboard | PR #8–#10 |
| 3 | 19–23/10 | Integración híbrida y demo | MVP de punta a punta (20/10), Cognito con MFA y pipeline DevOps | PR #11–#28 |
| 4 | 26/10–01/11 | Planta autónoma y nueva interfaz | API local del Edge, umbrales desde RDS y bocetos del dashboard aprobados (01/11) | PR #30, tareas 21, 22 y 25 |
| 5 | 02–08/11 | Roles, auditoría y DevSecOps | 4 roles por sede, auditoría, dashboard de 7 pantallas y escaneos de seguridad en el CI | PR #33–#59 |
| 6 | 09–15/11 | Preparar la Nota 3 | Pauta y reparto de la Nota 3, README y contexto al día | PR #61 |
| 7 | 16–22/11 | Entregables de la Nota 3 | Ansible, API REST, calidad, backlog y PowerPoint | Tareas 33 a 43 |

**Ceremonias y roles.** El Product Owner (Abraham) prioriza el backlog según la pauta del profesor y las necesidades de Induplac; la Scrum Master (Bárbara) mantiene la planificación y el tablero al día. La planificación de cada sprint se hizo al repartir las tareas en el grupo (por ejemplo, el reparto del 27/10 y el del 13/11), y la revisión, con la demo del 21/10 y la aprobación de los bocetos el 01/11.

---

## 3. El tablero Kanban: `EN-CURSO.md`

El archivo [`EN-CURSO.md`](../EN-CURSO.md) es nuestro tablero Kanban. Cada tarea es una tarjeta y su estado es la columna en la que está.

| Columna Kanban | Estado en el tablero | Regla |
|---|---|---|
| Por hacer | 🟢 Libre | Nadie la tiene; cualquiera puede tomarla. |
| En curso | 🟡 En curso | Quien la toma la **reserva primero** con su nombre, fecha y rama. |
| En revisión | 🔵 En revisión | Hay un Pull Request abierto esperando que otro integrante lo revise. |
| Listo | ✅ Listo | El PR se unió a `main` con el CI en verde y se anotó en la bitácora. |
| Bloqueado | ⛔ Bloqueado | No puede avanzar; se explica por qué. |

**Foto del tablero al 14/11/2026** (tareas técnicas y de la Nota 3):

| Por hacer 🟢 | En curso 🟡 | En revisión 🔵 | Listo ✅ (últimas) |
|---|---|---|---|
| 18 Guion de la demo | 20 Validar token en la API | 12 Pipeline DevOps | 21 Umbrales desde RDS |
| 33 Ansible | 23 Wokwi | 16 Informe | 22 API local del Edge |
| 34 API REST | 24 Documentación | 17 PowerPoint | 26 Roles por sede |
| 35 Backend | 29 Auditoría en el Edge | | 27 Auditoría en la nube |
| 36 5 Porqués | 31 MFA por rol | | 28 Endpoints nuevos |
| 38 Transferencia | 37 Backlog (esta tarea) | | 30 Dashboard de 7 pantallas |
| 40 Ishikawa | 39 Gestión del equipo | | 32 DevSecOps |
| 41 Plan de pruebas | 44 Umbrales en el Edge | | 45 README al día |
| 42 Gráfico de control | | | |
| 43 Evidencias | | | |

### Principios Lean que aplicamos

| Principio Lean | Cómo se ve en Induplac |
|---|---|
| **Eliminar desperdicio** | Reservar la tarea antes de empezar evita que dos personas (o dos IA) hagan lo mismo. |
| **Sistema pull (tirar)** | Nadie asigna trabajo a la fuerza: cada uno toma una tarjeta libre cuando puede. |
| **Lotes pequeños** | Cada cambio entra en un Pull Request chico (cerca de 60 desde el 08/10), fácil de revisar. |
| **Calidad desde el origen** | El CI prueba cada cambio y `main` rechaza lo que no pasa (regla `proteger-main`, 13/11). |
| **Mejora continua** | Las decisiones se corrigen cuando aparece algo mejor, por ejemplo mover las alertas de RDS a DynamoDB (21/10). |
| **Visualizar el flujo** | Cualquiera ve en un solo archivo qué está en curso, quién lo tiene y desde cuándo. |

**Límite de trabajo en curso (WIP).** Hoy hay 8 tarjetas en curso para 5 personas. La regla del tablero es que una tarea con más de 7 días sin cambios se conversa en el grupo antes de que otro la tome, para que nada quede detenido.

---

## 4. Qué cambió gracias a trabajar así

1. **Se detectaron huecos a tiempo:** HU-08 (validar el token en la API) quedó anotada como limitación después de la demo, entró al backlog y se priorizó como Must.
2. **El alcance se ajustó sin perder la demo:** la VPN y los sensores reales pasaron a diseño, para cumplir con la demo del 21/10.
3. **Ideas nuevas sin desordenar el sprint:** la app para celular (HU-20) y la comparación por estaciones (HU-21) quedaron en el backlog como Won't, en vez de interrumpir lo prioritario.
