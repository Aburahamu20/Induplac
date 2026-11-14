# 🔁 Pipeline DevOps — Induplac IoT

> Entregable 8 de la pauta (tarea 12 de `EN-CURSO.md`): cómo pasa un cambio desde que alguien lo escribe hasta que está funcionando.
> Archivos: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (prueba y validación) y [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) (despliegue).

```mermaid
flowchart LR
    A["1 · Desarrollo<br/>rama feature/*<br/>pruebas locales"] -->|"git push + Pull Request"| B["2 · Prueba y seguridad<br/>GitHub Actions (CI)<br/>build · pruebas · secretos<br/>dependencias · SAST · DAST ZAP"]
    B -->|"checks ✅"| C["3 · Validación<br/>plantilla de PR<br/>+ revisión de un compañero"]
    C -->|"merge a main"| D["4 · Despliegue<br/>Deploy: dashboard → S3<br/>Lambdas → AWS<br/>+ /health"]
    B -->|"❌ falla un control"| A
    C -->|"cambios pedidos"| A
```

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
- **Regla de `main`** (*Settings → Branches → Branch protection*): no se puede mergear sin los checks de CI en verde ni sin una aprobación.

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

## Configuración (una sola vez)

1. **Variables** (*Settings → Secrets and variables → Actions → Variables*): `S3_BUCKET`, `VITE_API_URL` (`https://<api-id>.execute-api.us-east-1.amazonaws.com/api`) y `VITE_COGNITO_CLIENT_ID`.
2. **Secretos** (misma pantalla → *Secrets*): las 3 credenciales del Learner Lab. Se actualizan cada vez que se despliega.
3. **Regla de `main`**: exigir los checks *Dashboard*, *Edge y Lambdas*, *Sin claves en el repositorio*, *Dependencias sin vulnerabilidades conocidas*, *Análisis estático de seguridad (SAST)* y *DAST con OWASP ZAP*, y 1 aprobación.

> El login con Cognito (`login: cognito` en *Run workflow*) requiere el PR #20 mergeado. Con `login: simulada` se publica el login de demo.

## Evidencia para la presentación

- Pestaña **Actions** del repositorio: historial de ejecuciones de CI.
- Cualquier PR: sección *Checks* con los seis trabajos en ✅.
- Ejecución de CI: artefacto **`reporte-zap`** (HTML y JSON del escaneo de ZAP).
- Ejecución de **Deploy**: el log muestra el `aws s3 sync`, la actualización de las Lambdas y el `/health` final.
