# ☁️ Modelo Cloud y tecnologías — Nota 2

> **Autora:** Bárbara Saavedra (`barbaraantoniaa`). Tarea 11 de [`EN-CURSO.md`](EN-CURSO.md) · puntos 6 y 7 de la pauta ([`NOTA-2.md`](NOTA-2.md)).
> Basado en las decisiones de [`decisiones-tecnicas.md`](decisiones-tecnicas.md) (ADR-01 a ADR-10).

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
| **Serverless (FaaS)** | AWS Lambda | El código corre solo cuando llega un dato; no hay servidor encendido todo el día. |
| **Serverless (datos y API)** | DynamoDB, API Gateway, S3, broker EMQX Serverless | Se pagan por uso y cuestan casi $0 con el bajo tráfico del proyecto (≈ 96 intervalos/día por local). |
| **PaaS** | RDS PostgreSQL, Cognito | AWS administra la base de datos y el login; el equipo solo los configura. |

**¿Por qué no IaaS (máquinas virtuales EC2)?** Habría que instalarlas, actualizarlas y dejarlas encendidas, lo que gasta el crédito del Learner Lab y exige más mantención.

---

## 2. Tecnologías y su aporte concreto (punto 7)

| Capa | Tecnología | Aporte concreto al proyecto |
|---|---|---|
| **Sensores** | ESP32 simulado en **Wokwi** | Mide energía, agua y UV sin comprar hardware; permite hacer la demo completa en el navegador. |
| **Comunicación** | **MQTT** con broker **EMQX Serverless** (TLS) | Protocolo liviano pensado para IoT; cifrado y un usuario por dispositivo. |
| **Edge** | **Raspberry Pi** + **Python** + **SQLite** | Guarda los datos localmente y calcula intervalos de 15 min, alertas y modo offline. |
| **Edge** | Módulo **RTC DS3231** + **chrony** | Mantiene la hora correcta aunque se corten internet y la luz (las alertas dependen de la hora). |
| **Edge** | **Nginx** | Sirve el dashboard dentro de la planta, con HTTPS. |
| **Red** | **VLANs** (IoT y operarios) | Separa los sensores del resto de la red: si un sensor se ve comprometido, no alcanza a otros equipos. |
| **Red** | **VPN Site-to-Site** (solo diseño) | Conexión cifrada planta–nube sin pasar por internet público. Queda documentada; no se demuestra por costo. |
| **Nube** | **API Gateway** | Puerta de entrada única y controlada para los datos que llegan desde el Edge. |
| **Nube** | **AWS Lambda** (Python) | Recibe los datos y evalúa las alertas con las mismas reglas que el Edge. |
| **Nube** | **DynamoDB** | Guarda los intervalos de consumo; siempre encendida y casi gratis. |
| **Nube** | **RDS PostgreSQL** | Guarda la configuración: permisos por usuario, umbrales y catálogo de locales y dispositivos (datos con relaciones). Se apaga cuando no se usa; las alertas van en DynamoDB y las cuentas en Cognito. |
| **Nube** | **S3** | Publica el dashboard para gerencia. |
| **Seguridad** | **Cognito con MFA** | Login con clave y código del celular para quien puede modificar algo. |
| **Visualización** | **React** + Vite + TypeScript + Tailwind | Un mismo dashboard para la planta y la nube. |
| **Trabajo en equipo** | **GitHub** (ramas, Pull Requests, tablero) | Ordena quién hace qué y deja registro de cada cambio y su revisión. |
