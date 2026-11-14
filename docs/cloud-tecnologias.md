# ☁️ Modelo Cloud y tecnologías

> **Autora:** Bárbara Saavedra (`barbaraantoniaa`). Tarea 11 de [`EN-CURSO.md`](EN-CURSO.md) · puntos 6 y 7 de la pauta ([`pauta-entrega.md`](pauta-entrega.md)).
> Basado en las decisiones de [`decisiones-tecnicas.md`](decisiones-tecnicas.md) (ADR-01 a ADR-10).
> **Actualizado el 21/10/2026** con lo construido el 20/10: alertas en DynamoDB, Lambda `induplac-config`, pipeline con GitHub Actions y Nginx como diseño.
> **Actualizado el 14/11/2026** (tarea 24): API local del Edge con login de planta, 4 roles con sede en Cognito, auditoría que no se puede borrar, dashboard de 7 pantallas y DevSecOps en el CI.

## Glosario rápido

- **On-premise:** equipos instalados físicamente en la planta (Raspberry Pi y sensores).
- **Nube pública:** servidores de un proveedor (AWS) que se arriendan por uso.
- **Serverless:** no se administran servidores; AWS los enciende, escala y mantiene, y se paga solo por uso.

---

## 1. Modelo Cloud (punto 6)

### Modelo de despliegue: nube híbrida

| Parte | Dónde vive | Qué hace |
|---|---|---|
| **Edge** (on-premise) | Raspberry Pi en cada local | Recibe los datos de los sensores, los guarda, calcula intervalos de 15 min, genera alertas y muestra el dashboard **aunque no haya internet**. |
| **Nube** (AWS) | Región us-east-1 | Guarda el histórico de los dos locales, muestra la vista de gerencia y administra usuarios y permisos. |

**¿Por qué híbrido y no solo nube?** La planta no puede quedar ciega si se corta internet. Las alertas (por ejemplo, UV alto) y el dashboard siguen funcionando en la Raspberry Pi y, al volver la conexión, todo se sincroniza con la nube sin duplicados (ADR-05, ADR-06, ADR-07).

### Modelo de servicio: serverless + PaaS (sin servidores propios)

| Tipo | Servicios | Por qué |
|---|---|---|
| **Serverless (FaaS)** | AWS Lambda (`induplac-api` e `induplac-config`) | El código corre solo cuando llega un dato o una consulta; no hay servidor encendido todo el día. |
| **Serverless (datos y API)** | DynamoDB, API Gateway, S3, broker EMQX Serverless | Se pagan por uso y cuestan casi $0 con el bajo tráfico del proyecto (≈ 96 intervalos/día por local). |
| **PaaS** | RDS PostgreSQL, Cognito | AWS administra la base de datos y el login; el equipo solo los configura. |

**¿Por qué no IaaS (máquinas virtuales EC2)?** Habría que instalarlas, actualizarlas y dejarlas encendidas, lo que gasta el crédito del Learner Lab y exige más mantención.

---

## 2. Tecnologías y su aporte concreto (punto 7)

| Capa | Tecnología | Aporte concreto al proyecto |
|---|---|---|
| **Sensores** | ESP32 simulado en **Wokwi** | Mide energía, agua y UV sin comprar hardware; permite hacer la demo completa en el navegador. |
| **Comunicación** | **MQTT** con broker **EMQX Serverless** (TLS) | Protocolo liviano pensado para IoT; cifrado y un usuario por dispositivo. |
| **Edge** | **Raspberry Pi** + **Python** + **SQLite** | Guarda los datos localmente y calcula intervalos de 15 min, alertas y modo offline. Su API local sirve el dashboard de planta con login propio (clave + MFA) y guarda una auditoría local que sube al reconectar. |
| **Edge** | Módulo **RTC DS3231** + **chrony** | Mantiene la hora correcta aunque se corten internet y la luz (las alertas dependen de la hora). |
| **Edge** | **Nginx** (solo diseño) | Serviría el dashboard de planta con HTTPS. En la demo lo sirve la API local del Edge (Python), y gerencia lo ve en S3. |
| **Red** | **VLANs** (IoT y operarios) | Separa los sensores del resto de la red: si un sensor se ve comprometido, no alcanza a otros equipos. |
| **Red** | **VPN Site-to-Site** (solo diseño) | Conexión cifrada planta–nube sin pasar por internet público. Queda documentada; no se demuestra por costo. |
| **Nube** | **API Gateway** | Puerta de entrada única y controlada para los datos que llegan desde el Edge. |
| **Nube** | **AWS Lambda** (Python) | `induplac-api` recibe los datos del Edge y evalúa las alertas con las mismas reglas; `induplac-config` entrega la configuración guardada en RDS (por ejemplo, `/config/umbrales`). |
| **Nube** | **DynamoDB** | Guarda los intervalos de consumo, las alertas y la **auditoría** (quién cambió qué); siempre encendida y casi gratis. Alertas y auditoría con recuperación en el tiempo (PITR) y protección contra borrado. |
| **Nube** | **RDS PostgreSQL** | Guarda la configuración: permisos por usuario, umbrales y catálogo de locales y dispositivos (datos con relaciones). Se apaga cuando no se usa; las alertas van en DynamoDB y las cuentas en Cognito. |
| **Nube** | **S3** | Publica el dashboard para gerencia. |
| **Seguridad** | **Cognito con MFA** | Cuentas con clave temporal y código del celular (TOTP). 4 grupos dicen qué puede hacer cada uno (`admin-general`, `admin-sede`, `jefe`, `operario`) y el atributo `custom:sede` dice dónde (planta, oficinas o todas). MFA obligatorio para jefes y administradores, opcional para operarios. |
| **Visualización** | **React** + Vite + TypeScript + Tailwind | Un mismo dashboard para la planta y la nube: panel con menú lateral y 7 pantallas según el rol (panel, histórico, alertas, umbrales, usuarios, auditoría y estado de las sedes). |
| **Trabajo en equipo** | **GitHub** (ramas, Pull Requests, tablero) | Ordena quién hace qué y deja registro de cada cambio y su revisión. |
| **DevOps** | **GitHub Actions** (CI/CD) | En cada Pull Request compila el dashboard y corre las pruebas del Edge (reglas de alerta); el despliegue a AWS se lanza a mano por las restricciones del Learner Lab. Ver [`devops.md`](devops.md). |
| **DevSecOps** | `gitleaks`, `npm audit` / `pip-audit`, `Bandit` / `Semgrep` y **OWASP ZAP** | Revisan en cada cambio que no haya claves en el código, librerías con fallas conocidas, código inseguro ni fallas en el dashboard funcionando. Desde el 13/11, `main` rechaza todo cambio que no pase estos controles. |
