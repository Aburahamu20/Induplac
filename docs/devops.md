# 🔁 Pipeline DevOps — Induplac IoT

> Entregable 8 de la pauta (tarea 12 de `EN-CURSO.md`): cómo pasa un cambio desde que alguien lo escribe hasta que está funcionando.
> Archivos: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (prueba y validación) y [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) (despliegue).

El pipeline de Induplac sigue las 8 etapas del PPT de preparación de la Nota 3, cada una con su herramienta:

```mermaid
flowchart LR
    R["0 · Requerimiento<br/>tarea en EN-CURSO<br/>(Kanban) + reserva"] --> A["1 · Cambio<br/>rama feature/*<br/>pruebas locales"]
    A -->|"git push + Pull Request"| G["2 · Git<br/>versionado y<br/>trazabilidad (PR)"]
    G --> B["3 · Test<br/>GitHub Actions (CI)<br/>build · pruebas · secretos<br/>dependencias · SAST · DAST ZAP"]
    B -->|"checks ✅"| C["4 · Validar<br/>revisión de un compañero<br/>main protegida"]
    C -->|"merge a main<br/>+ versión vX.Y"| D["5 · Desplegar<br/>Deploy: dashboard → S3<br/>Lambdas → AWS · /health"]
    D --> K["6 · Configurar<br/>Ansible: Edge de<br/>cada sede (idempotente)"]
    K --> O["7 · Operar<br/>Edge + nube<br/>con y sin internet"]
    O --> M["8 · Monitorear<br/>/health · Estado de las sedes<br/>alerta sin datos · logs"]
    M -->|"retroalimentación"| R
    B -->|"❌ falla un control"| A
    C -->|"cambios pedidos"| A
```

| Etapa | Herramienta en Induplac | Pregunta que responde (PPT, diapositiva 4) |
|---|---|---|
| 0 · Requerimiento | `EN-CURSO.md` (Kanban), backlog | ¿Qué se va a cambiar y quién lo hace? |
| 1-2 · Cambio y Git | Rama + Pull Request en GitHub | **¿Quién cambió la regla?** |
| 3 · Test | GitHub Actions: 6 controles | **¿Se probó?** |
| 4 · Validar | Revisión + ruleset `proteger-main` | ¿Alguien más lo revisó? |
| 5 · Desplegar | `deploy.yml` (S3 y Lambda) + versiones `vX.Y` | **¿Qué versión quedó instalada?** |
| 6 · Configurar | Ansible (`ansible/edge-baseline.yml`) | **¿Se desplegó igual en todos los nodos?** |
| 7-8 · Operar y monitorear | `/health`, *Estado de las sedes*, alerta "sin datos", logs de CloudWatch | **¿Cómo sabemos si falló?** |

---

## 1. Desarrollo

- Cada cambio se hace en **su propia rama** (`feature/...`, `fix/...`, `docs/...`). Nadie hace commit directo en `main` (`CONTRIBUTING.md`).
- Antes de reservar una tarea se anota en [`EN-CURSO.md`](EN-CURSO.md) para no repetir trabajo.
- Pruebas locales según la parte:

| Parte | Cómo se prueba en el PC |
| :--- | :--- |
| Dashboard | `npm run dev` con datos simulados o leyendo la API de AWS |
| Edge | `py edge_gateway.py` + `py simular_esp32.py` (o Wokwi) contra el broker EMQX |
| ESP32 | Wokwi: el Serial Monitor muestra cada publicación MQTT |
| Lambdas | `curl` a `/health` y `/config/umbrales`; *Test* en la consola de Lambda |
| Pruebas del Edge | `py -m unittest discover -s tests -v` (desde `edge/`) |

## 2. Prueba automática (CI)

Al abrir un Pull Request, **GitHub Actions** corre solo `ci.yml`. Los trabajos baratos corren en paralelo y el escaneo con ZAP solo corre si el dashboard compila (*fail fast*):

| Trabajo | Qué revisa | Por qué |
| :--- | :--- | :--- |
| **Dashboard** | `npm ci`, `oxlint` (calidad del código), `tsc` (tipos) y `vite build` | Si no compila, no se puede publicar en S3 |
| **Edge y Lambdas** | Sintaxis de todo el Python y las pruebas unitarias e integración con dobles (Edge, auditoría, `induplac-config` con RDS falso) | Protege lo que se demuestra: validación de rangos, descarte de duplicados, reglas de alerta, cadena de hashes de la auditoría y umbrales |
| **Secretos** | `gitleaks` busca claves, tokens y contraseñas en todo el historial | Ley 19.628 y capa de seguridad: ninguna credencial al repositorio |
| **Dependencias** | `npm audit --audit-level=high` (dashboard) y `pip-audit` (Edge e `induplac-config`) | Una librería con CVE conocido es la forma más común de heredar una vulnerabilidad |
| **SAST** | `Bandit` (Python) y `Semgrep` con reglas de Python, TypeScript, React y secretos | Busca patrones inseguros en el código antes de ejecutarlo: inyección SQL, XSS, `eval`, claves en el código |
| **DAST (ZAP)** | `zap-baseline.py` (spider + reglas pasivas) contra el build del dashboard levantado **en el mismo runner** con datos simulados | Revisa la aplicación funcionando: cabeceras, cookies, librerías JS vulnerables. Solo pasivo, y solo contra un sistema propio y aislado |

### Quality gate (qué bloquea)

| Control | Bloquea el PR | Queda solo como aviso |
| :--- | :--- | :--- |
| Build, lint y pruebas | Cualquier error o prueba fallida | — |
| `gitleaks` | Cualquier secreto | — |
| `npm audit` / `pip-audit` | Vulnerabilidad alta o crítica (npm) / cualquier CVE conocido (pip) | Severidad media o baja en npm |
| `Bandit` | Severidad **y** confianza altas | Severidad media (se revisa a mano en el log) |
| `Semgrep` | Cualquier hallazgo | — |
| ZAP | Reglas en `FAIL` de [`.zap/rules.tsv`](../.zap/rules.tsv): librería JS vulnerable (10003), cookies sin `HttpOnly`/`Secure`, CORS mal configurado | Reglas en `WARN` (cabeceras faltantes, anti-CSRF): se revisan en el reporte, que queda como artefacto `reporte-zap` |

> Una alerta automática es un **indicio**, no una vulnerabilidad confirmada. Ejemplo real (05/11): Bandit marca 9 avisos de severidad media; los de "posible inyección SQL" (`B608`) son consultas que solo arman los `?` de los parámetros o usan nombres de tabla fijos, así que se revisaron y no son explotables. Por eso no bloquean, pero se miran en cada PR.

**Pendiente (diseño):** S3 no agrega cabeceras de seguridad (`X-Content-Type-Options`, CSP, anti-clickjacking). En producción se pondría CloudFront delante del bucket con una *response headers policy*; el Learner Lab no lo incluye en la demo.

Si un trabajo falla, el PR muestra **❌** y vuelve al paso 1.

## 3. Validación

- **Plantilla de PR** obligatoria (`.github/pull_request_template.md`): qué se cambió, por qué, cómo probarlo y checklist (tarea reservada, notas de avance, sin credenciales).
- **Revisión de un compañero**, que aprueba o pide cambios.
- **Regla de `main`** (*Settings → Rules → Rulesets → `proteger-main`*, activa desde el 13/11): nada entra a `main` sin los 6 checks de CI en verde; no se puede borrar `main` ni hacer *force push*. Solo el admin del repositorio puede saltársela (para las reservas en EN-CURSO); el resto del equipo trabaja siempre por rama + PR.

## 4. Despliegue (CD)

`deploy.yml` publica en AWS lo que está en `main`:

| Qué | Cómo |
| :--- | :--- |
| **Dashboard → S3** | Build con la URL de la API y el Client ID de Cognito, y `aws s3 sync` al bucket |
| **Lambda `induplac-api`** | Zip del código y `aws lambda update-function-code` |
| **Lambda `induplac-config`** | Zip con `pg8000` y el certificado de RDS, y `update-function-code` |
| **Verificación** | `curl /health` al final |
| **Edge (Raspberry Pi)** | *Diseño:* `git pull` + reinicio del servicio `systemd`. En la demo corre en un PC |
| **ESP32** | *Simulación:* se copia `simulation/wokwi-local1/` al proyecto de Wokwi. Con hardware real: OTA |

### Limitación honesta: AWS Academy Learner Lab

Las credenciales del Learner Lab **vencen cada ~4 horas** y **no se pueden crear usuarios ni roles IAM**. Por eso GitHub no puede guardar una llave permanente:

- El despliegue se lanza **a mano** (*Actions → Deploy → Run workflow*) después de pegar las credenciales del lab del momento como secretos (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`).
- **En producción** se usaría un **rol IAM con OIDC** para GitHub: sin llaves guardadas y despliegue **automático al mergear a `main`**.

---

### Configuración de los Edge con Ansible

El dashboard y las Lambdas los publica GitHub Actions. Los **Edge de cada sede** los deja listos **Ansible**, desde un nodo de control y por SSH, con el playbook [`ansible/edge-baseline.yml`](../ansible/edge-baseline.yml). Ese playbook se encarga de:

- La zona horaria y la hora por NTP.
- Los paquetes.
- Un usuario sin privilegios.
- El código de GitHub en la versión indicada.
- El entorno de Python.
- El `.env` de cada sede.
- El servicio `induplac-edge`.

Es **idempotente**: si se vuelve a correr y todo está bien, no cambia nada. Probado el 17/11 en 2 EC2 que simulan las Raspberry de Planta y Oficinas (detalle y capturas en [`ansible/README.md`](../ansible/README.md)).

### Versiones: qué está instalado y cómo volver atrás

Cada hito del proyecto tiene una **versión con nombre** (un *tag* de Git), así siempre se sabe qué código está instalado:

| Versión | Fecha | Qué trae |
|---|---|---|
| `v0.1` | 08/10 | Diseño: arquitectura y decisiones cloud |
| `v0.2` | 21/10 | MVP de la demo: Wokwi → Edge → AWS → dashboard, Cognito con MFA y CI |
| `v0.3` | 29/10 | Planta autónoma: API local del Edge con login de planta |
| `v0.4` | 03/11 | Roles por sede, auditoría y umbrales editables |
| `v0.5` | 04/11 | Dashboard de 7 pantallas |
| `v0.6` | 13/11 | DevSecOps en el CI y `main` protegida |
| `v0.7` | 17/11 | Ansible para el Edge y token en toda la API |
| `v1.0` | 25/11 | Versión de la Nota 3 (se crea el día de la presentación) |

**Volver a una versión estable** (por ejemplo, si `v0.7` fallara en las sedes):

```bash
ansible-playbook edge-baseline.yml -e repo_version=v0.6   # instala v0.6 en todos los Edge
ansible-playbook edge-baseline.yml                        # vuelve a main cuando esté corregido
```

El resumen del playbook muestra el commit instalado en cada sede. Para el dashboard y las Lambdas, el despliegue se corre desde el commit de esa versión.

## Configuración (una sola vez)

1. **Variables** (*Settings → Secrets and variables → Actions → Variables*): `S3_BUCKET`, `VITE_API_URL` (`https://<api-id>.execute-api.us-east-1.amazonaws.com/api`) y `VITE_COGNITO_CLIENT_ID`.
2. **Secretos** (misma pantalla → *Secrets*): las 3 credenciales del Learner Lab. Se actualizan cada vez que se despliega.
3. **Regla de `main`** (✅ creada el 13/11 como ruleset `proteger-main`): exige los checks *Dashboard*, *Edge y Lambdas*, *Sin claves en el repositorio*, *Dependencias sin vulnerabilidades conocidas*, *Análisis estático de seguridad (SAST)* y *DAST con OWASP ZAP*; bloquea borrar `main` y el *force push*. Bypass: *Repository admin*. No exige aprobación (la revisión de un compañero se pide por acuerdo del equipo).

> El login con Cognito (`login: cognito` en *Run workflow*) requiere el PR #20 mergeado. Con `login: simulada` se publica el login de demo.

## Evidencia para la presentación

- Pestaña **Actions** del repositorio: historial de ejecuciones de CI.
- Cualquier PR: sección *Checks* con los seis trabajos en ✅.
- Ejecución de CI: artefacto **`reporte-zap`** (HTML y JSON del escaneo de ZAP).
- Ejecución de **Deploy**: el log muestra el `aws s3 sync`, la actualización de las Lambdas y el `/health` final.
