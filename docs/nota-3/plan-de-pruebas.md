# 🧪 Plan de pruebas e inspección — Induplac IoT

> **Tarea 41 · Criterio 8 de la Nota 3 (herramientas de calidad, 15 %).** Responsable: Abraham Castro.
> La pauta pide no solo nombrar las herramientas de calidad, sino **mostrar cómo se usaron**. Este plan dice **qué se prueba, cómo, cuándo, quién y qué resultado se acepta**, y la sección 6 muestra cómo se aplicó de verdad en el proyecto.
> Resultados al **17/11/2026**: **112 pruebas automáticas, 112 OK**.

---

## 1. Para qué sirve

Un plan de pruebas e inspección responde una pregunta simple: **¿cómo sabemos que Induplac funciona y que un cambio no rompió nada?** Sin plan, cada uno prueba "a ojo" lo que se le ocurre. Con plan:

- Cada requisito importante (validar lecturas, alertas, modo offline, permisos, auditoría) tiene **pruebas concretas** asociadas.
- Las pruebas corren **solas en cada Pull Request** (CI), así que nadie se las salta.
- Lo que no se puede automatizar se revisa con **listas de inspección** (checklists) en momentos fijos: al revisar un PR, al desplegar y antes de la demo.

## 2. Niveles de prueba

| Nivel | Qué revisa | Cómo | Cuándo | Herramienta |
|---|---|---|---|---|
| **1. Unitarias** | Una pieza sola: una regla de alerta, la validación de una lectura, un permiso | Código que llama a la función con datos de prueba y compara el resultado | En cada PR (automático) | `unittest` (Python) |
| **2. Integración con dobles** | Varias piezas juntas: la API del Edge con su base de datos, la Lambda con DynamoDB y RDS **simulados** | Se levanta el servidor real del Edge o la Lambda con bases falsas en memoria | En cada PR (automático) | `unittest` + dobles de DynamoDB, RDS y Cognito |
| **3. Seguridad automática** | Secretos, librerías vulnerables, código inseguro, la app funcionando | Herramientas que analizan el código y el dashboard | En cada PR (automático) | `gitleaks`, `audit-ci`/`pip-audit`, Bandit, Semgrep, OWASP ZAP |
| **4. Build** | Que el dashboard compile sin errores de tipos ni de estilo | Compilación completa | En cada PR (automático) | `oxlint`, `tsc`, `vite build` |
| **5. Inspección manual** | Lo que se ve y se usa: pantallas, login con MFA, demo de punta a punta | Listas de inspección (sección 5) | Al revisar un PR, al desplegar, antes de la demo | Checklists de este plan |
| **6. Configuración de equipos** | Que cada Edge de sede esté igual y como debe | El playbook se corre de nuevo: `changed=0` significa que la sede está conforme | Después de cada cambio en el Edge y antes de la demo | Ansible |

> **Pruebas de punta a punta (E2E) automáticas:** quedan **propuestas** (Playwright sobre el dashboard). Por ahora el recorrido completo se valida con la **demo ensayada** ([`guion-demo.md`](guion-demo.md)), que es una inspección manual de punta a punta.

## 3. Criterio de aceptación (cuándo un cambio "pasa")

Un cambio **solo entra a `main`** si cumple todo esto. La regla `proteger-main` lo hace obligatorio:

| Control | Se acepta si… |
|---|---|
| Pruebas unitarias y de integración | **100 % OK** (ninguna falla) |
| Build del dashboard | Compila sin errores |
| Secretos | Ninguno encontrado |
| Dependencias | Sin vulnerabilidades altas o críticas, salvo [excepciones documentadas](../devops.md) |
| SAST | Bandit sin hallazgos de severidad y confianza altas; Semgrep sin hallazgos |
| DAST (ZAP) | Ninguna regla en `FAIL` |
| Revisión de un compañero | Checklist de la sección 5.1 completo |

## 4. Matriz de pruebas: requisito → pruebas → resultado

Cada fila es un requisito del sistema y las pruebas que lo verifican. Todas corren en cada PR.

| # | Requisito | Qué se verifica (ejemplos reales) | Archivo | Pruebas | Resultado 17/11 |
|---|---|---|---|---:|---|
| P1 | **Validar las lecturas del sensor** | Una lectura sin número de secuencia o fuera de rango (ej. 9.999 kW) se rechaza; si el ESP32 no tiene hora confiable, se usa la hora de llegada; los intervalos son de 15 min | `edge/tests/test_reglas.py` | 6 | ✅ 6/6 |
| P2 | **No duplicar datos** | La misma lectura dos veces se descarta; si el ESP32 se reinicia y repite números, no se pierde nada | `edge/tests/test_reglas.py` | 2 | ✅ 2/2 |
| P3 | **Alertas correctas** | UV ≥ 8 alerta y 7,9 no; energía sobre 55 kW sin historia alerta; un caudal de noche es posible fuga, pero el mismo de día no; cada alerta tiene un ID único para no duplicarse | `edge/tests/test_reglas.py` | 7 | ✅ 7/7 |
| P4 | **Indicadores de seguridad laboral** | Días sin incidentes según el calendario de Chile, días hábiles sin fines de semana, HH estimadas más medidas, y un incidente nuevo reinicia todo | `edge/tests/test_reglas.py` | 6 | ✅ 6/6 |
| P5 | **Login de planta seguro (sin internet)** | Clave temporal que se cambia; clave corta rechazada; MFA con código; clave mala y usuario inexistente dan el mismo error; **bloqueo tras 5 intentos**; token expirado; en la base no quedan claves ni secretos en claro | `edge/tests/test_api_local.py` | 9 | ✅ 9/9 |
| P6 | **Permisos por rol y sede (planta)** | Sin token todo es `401`; el operario no ve la otra sede ni el histórico; si el admin quita un permiso, se respeta; el jefe reconoce alertas | `edge/tests/test_api_local.py` | 6 | ✅ 6/6 |
| P7 | **Datos que entrega la API de planta** | Estado, sedes, dato actual (con el intervalo en curso), `503` si no hay datos, histórico por hora y parámetros inválidos | `edge/tests/test_api_local.py` | 6 | ✅ 6/6 |
| P8 | **Modo demo y servidor web seguro** | Los botones de la demo disparan la alerta y cortan o restablecen el enlace, también piden login y **no existen sin `DEMO=1`**; no se puede salir de la carpeta del dashboard; JSON malo da error controlado | `edge/tests/test_api_local.py` | 9 | ✅ 9/9 |
| P9 | **MFA (TOTP) correcto** | El código coincide con el vector oficial del estándar (RFC 6238); el cifrado detecta cambios | `edge/tests/test_api_local.py` | 2 | ✅ 2/2 |
| P10 | **Auditoría que no se puede borrar (planta)** | Cada registro se encadena con el anterior (hash); la app no puede borrar ni editar; si alguien borra o cambia algo a mano, **se detecta**; sube en orden, y si falla, queda pendiente | `edge/tests/test_auditoria_local.py` | 8 | ✅ 8/8 |
| P11 | **Auditoría en la nube** | Cadena sana; se detecta un registro modificado o borrado (al inicio, al medio o al final); sedes separadas; sin bifurcaciones si dos escriben a la vez | `backend/lambda_api/tests/test_auditoria.py` | 11 | ✅ 11/11 |
| P12 | **Auditoría del Edge llega a la nube** | Edge y nube calculan el mismo hash; entra sin duplicar; se marca lo que se cambió en el Edge y los huecos en su cadena | `backend/lambda_api/tests/test_auditoria_edge.py` | 6 | ✅ 6/6 |
| P13 | **Permisos por rol y sede (nube)** | Sin rol no se ve nada; cada uno ve solo su sede; alertas filtradas; quién puede ver el histórico, reconocer y ver la auditoría; `/health` e ingesta sin token | `backend/lambda_api/tests/test_permisos.py` | 10 | ✅ 10/10 |
| P14 | **Umbrales configurables** | Valores válidos e inválidos; copia de RDS a DynamoDB y valores por defecto si no hay copia; la **simulación** de agua, energía y fuga; las alertas usan la copia | `backend/lambda_api/tests/test_umbrales.py` | 10 | ✅ 10/10 |
| P15 | **Gestión de usuarios (Cognito)** | Lista según el rol; crear operario y auditarlo; el admin de sede no sale de su sede; grupo y sede coherentes; desactivar cierra la sesión; nadie se desactiva a sí mismo ni al último admin; resetear clave y MFA | `backend/lambda_api/tests/test_usuarios.py` | 8 | ✅ 8/8 |
| P16 | **Configuración en RDS** | Cambiar un umbral; permisos y validación; variable nueva y copia fallida; sincronizar; responder aunque RDS esté apagado | `backend/lambda_config/tests/test_config.py` | 5 | ✅ 5/5 |
| P17 | **Datos en DynamoDB** | Los tipos se guardan y leen sin conversiones dobles | `backend/lambda_api/tests/test_repo_dynamo.py` | 1 | ✅ 1/1 |
| | | | **Total** | **112** | **✅ 112/112** |

> **Cómo correrlas uno mismo:** `cd edge && python -m unittest discover -s tests -v` (61), `cd backend/lambda_api && python -m unittest discover -s tests -v` (46) y `cd backend/lambda_config && python -m unittest discover -s tests -v` (5).

## 5. Plan de inspección (lo que se revisa a mano)

### 5.1 Al revisar un Pull Request (cada PR · revisor: otro integrante)

| ✓ | Punto de inspección | Criterio |
|---|---|---|
| ☐ | Los 6 checks del CI están en verde | Obligatorio (la regla de `main` no deja mergear si no) |
| ☐ | La tarea está reservada en `EN-CURSO.md` y el PR la nombra | Tarea con número y estado 🔵 |
| ☐ | Hay entrada con fecha en `notas-de-avance.md` | Qué se hizo, qué se decidió, qué falta |
| ☐ | Si cambió algo grande: README y guía del equipo actualizados | Regla de `AGENTS.md` §4 |
| ☐ | No hay credenciales, `.env`, llaves ni IP públicas | Además lo revisa `gitleaks` |
| ☐ | El cambio hace lo que dice la tarea y no contradice `CONTEXTO.md` | Si contradice, se pide cambio |

### 5.2 Después de desplegar (cada despliegue · responsable: quien despliega)

| ✓ | Punto de inspección | Criterio de aceptación |
|---|---|---|
| ☐ | `GET /health` de la API | Responde `{"ok": true}` |
| ☐ | Dashboard en S3 carga e inicia sesión con MFA | Entra y muestra datos |
| ☐ | Pantalla *Estado de las sedes* | Cada sede "al día", o se sabe por qué no |
| ☐ | Una consulta sin token | Responde `401` |
| ☐ | Si cambió el Edge: `ansible-playbook edge-baseline.yml` dos veces | 2ª pasada con `changed=0` en todas las sedes |

### 5.3 Antes de la demo (25/11 · responsables según [`guion-demo.md`](guion-demo.md))

La lista "30 minutos antes" del guion: lab encendido y RDS *Available*, Edge con `DEMO=1`, Wokwi enviando, los dos dashboards en 🟢, letra grande y celulares en silencio. Más el **ensayo cronometrado** como inspección de punta a punta.

## 6. Cómo se usó en el proyecto (evidencia)

| Fecha | Qué pasó | Qué detectó o aseguró el plan |
|---|---|---|
| Desde el 21/10 | Las pruebas corren en **cada PR** con GitHub Actions | **110 ejecuciones** del CI al 05/11, con 97,3 % de éxito: 3 ejecuciones detectaron errores, que tuvieron que corregirse |
| 05/11 | Bandit (SAST) marcó 9 avisos de "posible inyección SQL" en el Edge | Se **inspeccionaron a mano**: eran consultas seguras (falsos positivos). Por eso lo medio se revisa y no bloquea |
| 13/11 | Se activó la regla `proteger-main` | Desde ahí, **ningún PR entra a `main` sin las pruebas en verde**. Solo el admin puede saltársela, para las reservas en EN-CURSO |
| 17/11 | Ansible corrido dos veces en las 2 EC2 | La 2ª pasada con `changed=0` confirma que **las dos sedes quedaron iguales y conformes** |
| 17/11 | El control de dependencias **bloqueó todos los PR** por una vulnerabilidad nueva en `picomatch` | Se analizó, no era explotable aquí, y se dejó una **excepción acotada y documentada** (tarea 48). El resto sigue bloqueando |
| 17/11 | Revisión del guion de la demo (PR #68) | La inspección comparó los datos técnicos del guion con el código; todos coincidían. Se detectó que las cuentas de prueba ya no existían y se corrigió (PR #69) |
| 17/11 | Corrida completa para este plan | **112 de 112 pruebas OK** (61 Edge, 46 API, 5 configuración) |

## 7. Lo que no se prueba automáticamente (y cómo se cubre)

| No automatizado | Cómo se cubre hoy | Mejora propuesta |
|---|---|---|
| Recorrido completo en el navegador (E2E) | Demo ensayada + inspección 5.2 | Pruebas con Playwright en el CI |
| Muchas sedes y mucho volumen (carga) | Fuera del alcance del MVP | Prueba de carga antes del piloto real |
| Sensores y Raspberry físicos | Se simulan con Wokwi y EC2 | Piloto en una sede (transferencia tecnológica) |
| Que el dashboard se vea bien | Inspección visual al revisar el PR | Capturas automáticas comparadas (*visual testing*) |

## 8. Para la presentación (criterio 8)

- **Qué es:** un plan que dice qué se prueba, cómo, cuándo y qué resultado se acepta. No son pruebas sueltas.
- **Cómo se usó:** 112 pruebas automáticas atadas a 17 requisitos, que corren solas en cada cambio y **bloquean** si algo falla, más listas de inspección para lo manual.
- **Prueba de que funciona:** el CI detectó 3 ejecuciones con errores (97,3 % de éxito) y frenó una vulnerabilidad real el 17/11.
- **Se complementa con:** el diagrama de flujo del pipeline ([`devops.md`](../devops.md)), el Ishikawa (tarea 40) y el gráfico de control (tarea 42).
