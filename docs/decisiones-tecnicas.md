# 📋 Registro de Decisiones de Arquitectura (ADR) — Induplac IoT

Este documento recopila las decisiones técnicas y de arquitectura clave tomadas durante el diseño de la plataforma **Induplac IoT**, detallando el contexto, las alternativas evaluadas y la justificación de cada elección.

---

## 📑 Índice de Decisiones

- [ADR-01: Persistencia Políglota (DynamoDB + RDS PostgreSQL)](#adr-01-persistencia-políglota-dynamodb--rds-postgresql)
- [ADR-02: Interconexión Híbrida con VPN Site-to-Site (IPsec)](#adr-02-interconexión-híbrida-con-vpn-site-to-site-ipsec)
- [ADR-03: Segmentación de Redes en Planta mediante VLANs IoT](#adr-03-segmentación-de-redes-en-planta-mediante-vlans-iot)
- [ADR-04: Seguridad de Red en VPC mediante Security Groups Referenciados](#adr-04-seguridad-de-red-en-vpc-mediante-security-groups-referenciados)

---

## ADR-01: Persistencia Políglota (DynamoDB + RDS PostgreSQL)

### Estado: Aceptado

### Contexto
El sistema maneja dos tipos de datos radicalmente distintos:
1. **Telemetría continua de sensores:** Mediciones frecuentes (cada 5 s) de potencia eléctrica, flujo de agua y radiación UV, de estructura semi-fija y alto volumen de escritura.
2. **Datos de gestión, seguridad y analítica:**
   - Control de acceso basado en roles (RBAC: usuarios, roles, permisos) que requieren integridad referencial y operaciones `JOIN`.
   - Catálogo de locales físicos y dispositivos asociados.
   - Históricos consolidados agregados por día, semana y mes para realizar comparativas (*"Hoy vs. Ayer"*, *"Esta semana vs. Anterior"*).

### Alternativas Evaluadas
1. **Solo Amazon DynamoDB:** Excelente para telemetría cruda, pero compleja y poco eficiente para modelar RBAC con múltiples roles/permisos y para realizar consultas analíticas agregadas ad-hoc.
2. **Solo Amazon Aurora / RDS:** Capaz de manejar todo, pero someter una base relacional a inserciones continuas de telemetría de sensores cada pocos segundos satura conexiones y encarece el costo en AWS Academy Learner Lab.
3. **Persistencia Políglota (DynamoDB + RDS PostgreSQL):** Combinar el motor adecuado para cada caso de uso.

### Decisión
Adoptar una **arquitectura de persistencia políglota**:
- **Amazon DynamoDB (NoSQL):** Repositorio de telemetría cruda en tiempo real (*Time-series*). Escalabilidad instantánea, costo mínimo y escritura en milisegundos.
- **Amazon RDS PostgreSQL (SQL Relacional):** Repositorio para entidades relacionales:
  - Tablas: `usuarios`, `roles`, `permisos`, `usuario_roles`.
  - Tablas: `locales`, `dispositivos`, `umbrales_alerta`.
  - Tablas: `metricas_agregadas_diarias`, `metricas_agregadas_semanales` (calculadas periódicamente por una Lambda analítica).

### Consecuencias
- **Positivas:** Modelo de datos limpio y normalizado para seguridad y auditoría; consultas analíticas en una sola línea de SQL; no se satura el pool de conexiones relacionales con telemetría cruda.
- **Negativas:** Requiere administrar dos motores en AWS. En el entorno académico de Learner Lab, se debe pausar la instancia `db.t3.micro` al finalizar sesiones de laboratorio.

---

## ADR-02: Interconexión Híbrida con VPN Site-to-Site (IPsec)

### Estado: Aceptado

### Contexto
El tráfico de telemetría entre los locales de Induplac y la nube de AWS no debe exponerse de manera directa sobre Internet público sin una capa de seguridad a nivel de red, para prevenir ataques de interceptación y evitar abrir puertos de entrada en las plantas.

### Decisión
Implementar una **VPN Site-to-Site con túneles IPsec**:
- Configurar un **Customer Gateway (CGW)** en el Edge Gateway de cada local (Raspberry Pi con software IPsec como strongSwan o firewall de sede).
- Configurar un **Virtual Private Gateway (VGW)** vinculado a la VPC de AWS.
- Cifrado mediante **AES-256** con negociación **IKEv2** y 2 túneles redundantes por sede.

### Consecuencias
- **Positivas:** El tráfico de sincronización del Edge ingresa directamente a las subredes privadas de la VPC sin exponer endpoints públicos; suma una capa de cifrado en Capa 3 (Red) complementaria a TLS en Capa 7 (Aplicación).
- **Negativas:** Requiere configuración de enrutamiento y túneles en el Edge Gateway.

---

## ADR-03: Segmentación de Redes en Planta mediante VLANs IoT

### Estado: Aceptado

### Contexto
Si un microcontrolador ESP32 llegase a verse comprometido por malware o ataque físico en planta, un atacante no debe tener visibilidad ni acceso a equipos corporativos, PCs administrativas ni servidores de la empresa.

### Decisión
Segmentar las redes físicas mediante **VLANs exclusivas para IoT**:
- **Local 1 (Taller/Planta):** `192.168.10.0/24`
- **Local 2 (Administración):** `192.168.20.0/24`
- Los ESP32 únicamente pueden comunicarse por el puerto MQTTS (8883) con el Edge Gateway local.
- **Regla de Firewall:** Tráfico únicamente de salida (*Stateful Egress*); **cero puertos abiertos hacia adentro** (*Zero Inbound Ports*).

### Consecuencias
- **Positivas:** Contención total de incidentes; aislamiento de dispositivos de campo; rangos IP sin conflicto entre locales.

---

## ADR-04: Seguridad de Red en VPC mediante Security Groups Referenciados

### Estado: Aceptado

### Contexto
Configurar reglas de firewall en AWS basadas en direcciones IP fijas es frágil, complejo de mantener y vulnerable a cambios de interfaz de red elástica (ENI).

### Decisión
Utilizar **referencias directas entre Security Groups (SG-to-SG)**:
- `SG-Lambda` autoriza tráfico saliente TCP 5432 exclusivamente hacia `SG-RDS`.
- `SG-RDS` autoriza tráfico entrante TCP 5432 **únicamente con origen `SG-Lambda`**.
- La base de datos RDS se despliega con `PubliclyAccessible: false` en subredes privadas.
- Para comunicación con DynamoDB dentro de la VPC, se utiliza un **Gateway VPC Endpoint** gratuito, reduciendo la dependencia y costos del NAT Gateway.

### Consecuencias
- **Positivas:** Cero exposición pública de la base de datos; reglas declarativas independientes de las IPs dinámicas de Lambda; ahorro de créditos en AWS Academy.
