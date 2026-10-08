# 📋 Registro de Decisiones de Arquitectura (ADR) — Induplac IoT

Este documento recopila las decisiones técnicas y de arquitectura clave tomadas durante el diseño de la plataforma **Induplac IoT**, detallando el contexto, las alternativas evaluadas y la justificación de cada elección.

---

## 📑 Índice de Decisiones

- [ADR-01: Persistencia Políglota (DynamoDB + RDS PostgreSQL)](#adr-01-persistencia-políglota-dynamodb--rds-postgresql)
- [ADR-02: Interconexión Híbrida con VPN Site-to-Site (IPsec) y API Gateway Privada](#adr-02-interconexión-híbrida-con-vpn-site-to-site-ipsec-y-api-gateway-privada)
- [ADR-03: Segmentación de Redes en Planta mediante VLANs](#adr-03-segmentación-de-redes-en-planta-mediante-vlans)
- [ADR-04: Seguridad de Red en VPC mediante Security Groups Referenciados](#adr-04-seguridad-de-red-en-vpc-mediante-security-groups-referenciados)
- [ADR-05: Agregación de Telemetría en el Edge (Intervalos de 15 Minutos)](#adr-05-agregación-de-telemetría-en-el-edge-intervalos-de-15-minutos)
- [ADR-06: Alertas en Dos Niveles (Edge + Lambda)](#adr-06-alertas-en-dos-niveles-edge--lambda)
- [ADR-07: Dashboard de Planta Servido desde el Edge](#adr-07-dashboard-de-planta-servido-desde-el-edge)
- [ADR-08: Autenticación con MFA para Roles con Permisos de Escritura](#adr-08-autenticación-con-mfa-para-roles-con-permisos-de-escritura)

---

## ADR-01: Persistencia Políglota (DynamoDB + RDS PostgreSQL)

### Estado: Aceptado (argumentos actualizados 2026-10-08)

### Contexto
El sistema maneja dos tipos de datos con comportamientos distintos:
1. **Serie de tiempo de consumo:** intervalos de 15 minutos por local y variable enviados por el Edge (ver ADR-05). Estructura fija, escritura continua por Lambda, consultas por rango de tiempo.
2. **Datos de gestión, seguridad y analítica:** usuarios, roles y permisos (RBAC), catálogo de locales y dispositivos, umbrales, alertas e históricos agregados para comparar períodos. Requieren integridad referencial, `JOIN` y SQL analítico.

> **Nota:** con la agregación en el Edge el volumen que llega a la nube es bajo (≈ 96 intervalos/día por local). Por eso la decisión **no** se justifica por volumen, sino por costo, disponibilidad y modelo de acceso.

### Alternativas Evaluadas
1. **Solo Amazon DynamoDB:** sirve para la serie de tiempo, pero modelar RBAC y hacer comparaciones analíticas ad-hoc es engorroso.
2. **Solo Amazon RDS PostgreSQL (opcionalmente con TimescaleDB):** más simple de operar, pero la ingesta dependería de una instancia que hay que apagar para cuidar el crédito y Lambda tendría que administrar conexiones.
3. **Persistencia Políglota (DynamoDB + RDS PostgreSQL).**

### Decisión
- **Amazon DynamoDB:** serie de tiempo de intervalos de 15 min (llave: `local_id` + `inicio_intervalo`).
- **Amazon RDS PostgreSQL:** `usuarios`, `roles`, `permisos`, `usuario_roles`, `locales`, `dispositivos`, `umbrales_alerta`, `alertas`, `metricas_agregadas_diarias`.

### Justificación
1. **Costo y disponibilidad en Learner Lab:** DynamoDB on-demand cuesta prácticamente \$0 y está siempre encendido; RDS puede apagarse fuera de las sesiones de prueba **sin cortar la ingesta**.
2. **Lambda sin conexiones:** cada invocación de Lambda abre conexiones a una base relacional y puede agotar el límite de una instancia pequeña (RDS Proxy tiene costo). DynamoDB se accede por API HTTP.
3. **Separación de responsabilidades:** la ingesta sigue funcionando aunque la base relacional esté en mantenimiento.

### Consecuencias
- **Positivas:** modelo relacional limpio para seguridad y reportes; ingesta resiliente y de costo mínimo.
- **Negativas:** dos motores que administrar; la Lambda de alertas necesita leer de DynamoDB (historia) y escribir en RDS (alerta).

---

## ADR-02: Interconexión Híbrida con VPN Site-to-Site (IPsec) y API Gateway Privada

### Estado: Aceptado (actualizado 2026-10-08: VPN real)

### Contexto
El tráfico entre los locales y AWS no debe exponerse sobre Internet público, ni deben abrirse puertos de entrada en las plantas. Una API Gateway regional estándar es un endpoint **público**: aunque exista una VPN, el tráfico hacia ella no pasaría por el túnel.

### Decisión
- **VPN Site-to-Site real** con túneles IPsec:
  - **Customer Gateway (CGW):** strongSwan en el Edge Gateway de cada local.
  - **Virtual Private Gateway (VGW):** asociado a la VPC.
  - **IKEv2**, **AES-256** y 2 túneles por conexión.
- **API Gateway privada** para la ingesta (`POST /intervalos`, `POST /alertas`, `GET /health`), alcanzable solo desde la VPC mediante un **VPC Interface Endpoint `execute-api`**, con *resource policy* que solo acepta tráfico de ese endpoint.
- El Edge llama a la API usando el **nombre DNS específico del endpoint** (resuelve a IPs privadas de la VPC), que viaja por el túnel.
- **Plan B** si el Learner Lab no permite crear VGW/VPN: instancia EC2 pequeña con strongSwan como extremo del túnel dentro de la VPC.

### Consecuencias
- **Positivas:** la ingesta nunca toca Internet público; cifrado en Capa 3 (IPsec) bajo el cifrado de Capa 7 (TLS).
- **Negativas:** costo por hora de la conexión VPN y del endpoint de interfaz (ver `infrastructure/README.md`); configuración de túneles y rutas en el Edge. Se levantan para pruebas y demo.

---

## ADR-03: Segmentación de Redes en Planta mediante VLANs

### Estado: Aceptado (ampliado 2026-10-08: VLAN de operarios)

### Contexto
Si un ESP32 se ve comprometido, el atacante no debe alcanzar equipos corporativos. A la vez, los operarios necesitan abrir el dashboard que sirve el Edge (ADR-07).

### Decisión
- **VLAN IoT por local:** `192.168.10.0/24` (Local 1) y `192.168.20.0/24` (Local 2). Los ESP32 solo hablan MQTTS (8883) con el Edge.
- **VLAN de operarios por local** (ej. `192.168.11.0/24` y `192.168.21.0/24`): solo puede llegar al Edge por **HTTPS (443)**; no ve los ESP32.
- **Firewall perimetral:** solo tráfico de salida (*Stateful Egress*); el túnel VPN se inicia desde la planta. **Cero puertos entrantes**.

### Consecuencias
- **Positivas:** contención de incidentes; el dashboard de planta es accesible sin exponer la red IoT.

---

## ADR-04: Seguridad de Red en VPC mediante Security Groups Referenciados

### Estado: Aceptado

### Contexto
Reglas basadas en IPs fijas son frágiles ante las ENI dinámicas de Lambda.

### Decisión
- `SG-Lambda` permite salida TCP 5432 solo hacia `SG-RDS`.
- `SG-RDS` permite entrada TCP 5432 **solo desde `SG-Lambda`**; `PubliclyAccessible: false`.
- `SG-VPCE-API` (endpoint `execute-api`) permite entrada TCP 443 solo desde los rangos de las sedes que llegan por la VPN (`192.168.10.0/24`, `192.168.20.0/24`).
- DynamoDB vía **Gateway VPC Endpoint** gratuito; **sin NAT Gateway**.

### Consecuencias
- **Positivas:** base de datos sin exposición pública; reglas declarativas; ahorro de créditos.

---

## ADR-05: Agregación de Telemetría en el Edge (Intervalos de 15 Minutos)

### Estado: Aceptado (2026-10-07, documento "Decisiones Cloud")

### Contexto
Subir cada lectura de 5 s a la nube no aporta valor para reportes y alertas por hora o día, y aumenta tráfico, costo y superficie de exposición.

### Decisión
- El Edge guarda las lecturas crudas localmente y calcula **intervalos de 15 minutos** por local: promedio de electricidad y agua, máximo de UV, producción y HH acumulados.
- **A AWS solo suben intervalos validados**, nunca la lectura cruda ni datos que identifiquen a la organización real o a personas.
- Cada intervalo se identifica por `local_id + inicio_intervalo` y se guarda con *upsert*: reenviar el mismo intervalo no lo duplica.
- El Edge sigue calculando intervalos aunque no haya internet y los sube todos al reconectar.

### Consecuencias
- **Positivas:** volumen y costo mínimos; idempotencia natural; menos datos sensibles en tránsito.
- **Negativas:** el detalle de 5 s solo existe en el Edge (retención de 30 días).

---

## ADR-06: Alertas en Dos Niveles (Edge + Lambda)

### Estado: Aceptado (2026-10-08)

### Contexto
El documento del equipo define que una Lambda evalúa las alertas. Si solo existiera ese nivel, durante un corte de internet la planta no recibiría alertas (por ejemplo, UV alto).

### Decisión
- **Mismas reglas en ambos niveles** (ver `docs/CONTEXTO.md` §8.2): energía +20 % sobre el promedio de 4 semanas a la misma hora (umbral fijo de respaldo sin historia), agua diaria sobre umbral, UV ≥ 8.
- **Edge:** evalúa cada intervalo al cerrarlo y muestra la alerta en el dashboard de planta, con o sin internet. Conserva al menos 5 semanas de intervalos para calcular la regla de energía.
- **Lambda:** evalúa cada intervalo recibido y registra la alerta en RDS.
- **Sin duplicados:** la alerta se identifica por `local_id + variable + inicio_intervalo`. Las alertas creadas offline se sincronizan y Lambda hace *upsert* sobre la misma llave.
- Los umbrales se administran en RDS y se replican al Edge en cada sincronización.

### Consecuencias
- **Positivas:** la planta nunca queda sin alertas.
- **Negativas:** la lógica de reglas existe en dos lugares; se mitiga con un único archivo de reglas compartido por el Edge (Python) y la Lambda (Python).

---

## ADR-07: Dashboard de Planta Servido desde el Edge

### Estado: Aceptado (2026-10-08)

### Contexto
Un dashboard servido desde la nube no carga sin internet y el navegador bloquea llamadas HTTP a una IP local desde una página HTTPS (*mixed content*). El equipo decidió que **offline la planta debe ver los datos igual que online**.

### Decisión
- La Raspberry Pi sirve el **build del dashboard + una API local** (Nginx en 443) y el dashboard usa rutas relativas (`/api/...`).
- La nube sirve **el mismo build** para gerencia, apuntando a la API pública de consulta.
- El dashboard de planta siempre lee del Edge: online y offline se ven igual; solo cambia el indicador de enlace.
- Acceso local por DNS interno (`edge.induplac.local`) o IP, con certificado de una CA interna (autofirmado para la demo).

### Consecuencias
- **Positivas:** continuidad operacional real; no hay conmutación de endpoints en el navegador.
- **Negativas:** la vista de gerencia muestra el local como desconectado durante el corte, hasta que se sincroniza.

---

## ADR-08: Autenticación con MFA para Roles con Permisos de Escritura

### Estado: Aceptado (2026-10-08)

### Contexto
Modificar umbrales, usuarios o configuración tiene impacto operacional y de seguridad. El documento del equipo define MFA con Microsoft Authenticator.

### Decisión
- **Amazon Cognito User Pool** con **MFA TOTP** (estándar compatible con Microsoft Authenticator).
- MFA **obligatorio** para los grupos `administrador` y `jefe_mantenimiento_operaciones`; el grupo `operario` (solo lectura) inicia sesión sin MFA.
- Los roles se guardan en RDS y se reflejan como grupos de Cognito; el token JWT (1 h) lleva el grupo y la API lo valida.
- **Sin internet** (propuesta a validar): el Edge ofrece login local para ver el dashboard y reconocer alertas (acción auditada que se sincroniza después). Cambiar umbrales, usuarios o configuración **requiere conexión y MFA**.

### Consecuencias
- **Positivas:** las acciones críticas quedan protegidas por un segundo factor y auditadas.
- **Negativas:** verificar soporte de Cognito con MFA en el Learner Lab; doble mecanismo de login (Cognito y local en el Edge).
