# 🏭 Induplac IoT

## Plataforma IoT para el monitoreo energético y operacional

### *Datos que permiten visualizar, comparar y anticipar.*

<br>

![Estado](https://img.shields.io/badge/Estado-En%20desarrollo-yellow)
![Fase](https://img.shields.io/badge/Fase-MVP-blue)
![Asignatura](https://img.shields.io/badge/Asignatura-Problemáticas%20Globales%20y%20Prototipado-purple)
![IoT](https://img.shields.io/badge/IoT-ESP32-green)
![Cloud](https://img.shields.io/badge/Cloud-AWS-orange)
![Arquitectura](https://img.shields.io/badge/Arquitectura-Híbrida-informational)

</div>

---

## 📋 Información del proyecto

| Información | Detalle |
|---|---|
| **Proyecto** | Induplac IoT |
| **Asignatura** | Problemáticas Globales y Prototipado |
| **Sección** | 002V |
| **Docente** | Marco Antonio Perelli |
| **Institución** | Duoc UC |
| **Fase** | Prototipo / MVP |
| **Contexto** | Empresa real |
| **Datos utilizados** | Ficticios |
| **Arquitectura** | IoT + Edge + Cloud |
| **Conectividad** | Online + Offline |
| **Simulación** | Wokwi *(propuesta)* |

### 👥 Equipo

- Abraham Castro Romero
- Sebastián Fuentes Cortés
- Lisandra González Hernández
- Felipe Murúa Lobos
- Bárbara Saavedra Fernández

---

# 📖 1. Sobre el proyecto

**Induplac IoT** es una propuesta de plataforma para centralizar información energética y operacional de dos locales de una empresa, permitiendo visualizar el estado actual, detectar situaciones anómalas y comparar el comportamiento histórico.

El proyecto utiliza a **Induplac como empresa real de referencia**, pero durante esta etapa se trabajará exclusivamente con **datos ficticios y simulados**.

El objetivo del prototipo es demostrar cómo una arquitectura IoT podría recopilar información desde distintos puntos, procesarla localmente, almacenarla y finalmente visualizarla mediante dashboards.

> ⚠️ Este proyecto no representa datos reales de Induplac ni implica acceso a sus sistemas internos. Los datos utilizados durante el desarrollo y demostración son ficticios.

---

# 🎯 2. Objetivo

Desarrollar un prototipo de plataforma IoT capaz de centralizar información energética y operacional de **dos locales**, permitiendo:

- Monitorear el consumo eléctrico.
- Monitorear el consumo de agua.
- Visualizar producción.
- Visualizar horas sin incidentes (HH).
- Visualizar índice UV.
- Detectar condiciones que requieran atención.
- Comparar períodos históricos.
- Visualizar información de cada local.
- Obtener una visión general mediante un dashboard de auditoría.
- Mantener funcionamiento básico ante una pérdida de conexión a Internet.
- Sincronizar los datos almacenados localmente cuando vuelva la conectividad.

---

# 🌐 3. Problema

La información energética y operacional puede encontrarse distribuida en diferentes fuentes, dificultando obtener una visión rápida del estado de una instalación.

La propuesta busca centralizar estas variables en una plataforma que permita responder preguntas como:

> **¿Cómo está funcionando actualmente cada local?**

> **¿El consumo está aumentando respecto al período anterior?**

> **¿Existe alguna condición que requiera atención?**

> **¿Cómo se está comportando un local respecto a otro?**

> **¿Qué ocurrió durante la última semana o mes?**

---

# 💡 4. Solución propuesta

La solución utiliza una arquitectura híbrida compuesta por:

```text
Sensores / Simulación
        ↓
      ESP32
        ↓
       MQTT
        ↓
   Edge / Gateway
        ↓
      SQLite
        ↓
 ┌──────┴──────┐
 │             │
Internet     Sin Internet
 │             │
 ▼             ▼
AWS           SQLite
 │             │
 └──────┬──────┘
        ↓
   Sincronización
        ↓
    Dashboards
```

La arquitectura está diseñada para que el sistema pueda continuar recopilando información aunque exista una interrupción temporal de Internet.

---

# 🏗️ 5. Arquitectura general

```mermaid
flowchart TB

    subgraph LOCAL1["🏭 LOCAL 1"]
        S1["Sensores / Simulación"]
        E1["ESP32"]
        S1 --> E1
    end

    subgraph LOCAL2["🏭 LOCAL 2"]
        S2["Sensores / Simulación"]
        E2["ESP32"]
        S2 --> E2
    end

    E1 --> M["MQTT"]
    E2 --> M

    M --> EDGE["🖥️ EDGE / GATEWAY"]

    EDGE --> DBLOCAL["SQLite<br/>Almacenamiento local"]

    EDGE --> NET{"¿Internet disponible?"}

    NET -->|Sí| CLOUD["☁️ AWS / Cloud"]
    NET -->|No| OFF["🟠 Modo Offline"]

    OFF --> DBLOCAL

    CLOUD --> API["API / Servicios"]
    API --> DB["Base de datos central"]

    DBLOCAL --> SYNC["🔄 Sincronización"]
    SYNC --> CLOUD

    DB --> DASH["📊 Dashboards"]
    DBLOCAL --> DASH

    DASH --> D1["Dashboard Local 1"]
    DASH --> D2["Dashboard Local 2"]
    DASH --> DG["Dashboard General / Auditoría"]
```

---

# 🔄 6. Flujo de datos

## 🟢 Modo Online

Cuando existe conexión a Internet:

```text
ESP32
  ↓
MQTT
  ↓
Edge
  ↓
SQLite local
  ↓
AWS
  ↓
Base de datos
  ↓
Dashboard
```

El Edge conserva una copia local del dato antes de enviarlo a la nube.

---

## 🟠 Modo Offline

Si se pierde Internet:

```text
ESP32
  ↓
MQTT
  ↓
Edge
  ↓
SQLite
  ↓
Dashboard local
```

Los datos se mantienen localmente hasta que pueda volver a establecerse la conexión.

---

## 🔵 Sincronización

Cuando vuelve Internet:

```text
Internet vuelve
      ↓
Edge detecta conexión
      ↓
SYNCING
      ↓
Obtiene registros pendientes
      ↓
Envía información a AWS
      ↓
AWS confirma recepción
      ↓
Registros marcados como sincronizados
      ↓
ONLINE
```

### Estados del sistema

| Estado | Significado |
|---|---|
| 🟢 **ONLINE** | Sistema conectado y sincronizado |
| 🟠 **OFFLINE** | Sin conexión a Internet |
| 🔵 **SYNCING** | Enviando información pendiente |
| 🔴 **ERROR** | Existe un problema que requiere revisión |

---

# 📊 7. Variables monitoreadas

| Variable | Descripción |
|---|---|
| ⚡ **Electricidad** | Consumo energético |
| 💧 **Agua** | Consumo de agua |
| 🏭 **Producción** | Indicadores de producción |
| 🦺 **HH** | Horas sin incidentes |
| ☀️ **UV** | Índice UV y condición de riesgo |

Los datos de electricidad y agua están planteados con una frecuencia de medición de 15 minutos, mientras que los indicadores operacionales se consideran de actualización diaria.

---

# 🚨 8. Sistema de alertas

## ⚡ Electricidad

Se considera una condición de alerta cuando el consumo horario supera en más de un **20 %** el promedio correspondiente de las cuatro semanas anteriores.

```text
Consumo actual
      ↓
Comparar con histórico
      ↓
¿Supera +20%?
   ↙       ↘
 NO        SÍ
 ↓          ↓
Normal    ⚠ ALERTA
```

## 💧 Agua

Se contempla una alerta cuando el consumo diario supera un umbral establecido.

> El valor definitivo del umbral de agua queda pendiente de definición.

## ☀️ UV

Un índice UV de **8 o superior** se considera una condición de riesgo para personal expuesto al exterior.

---

# 🖥️ 9. Dashboards

La plataforma tendrá **tres dashboards funcionales**:

```text
                    INDUPLAC IoT
                         │
          ┌──────────────┴──────────────┐
          │                             │
      MONITOREO                      AUDITORÍA
          │                             │
    ┌─────┴─────┐                 Dashboard General
    │           │
 Local 1      Local 2
```

---

## 🏭 Dashboard — Local 1

Muestra el estado actual del primer local:

- Electricidad.
- Agua.
- Producción.
- HH.
- UV.
- Alertas.
- Estado de conexión.
- Estado de sensores.
- Última sincronización.
- Registros pendientes.

### Diseño visual base

```text
┌─────────────────────────────────────────────────────────────┐
│ INDUPLAC · LOCAL 1                    🟢 ONLINE              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ⚡ ELECTRICIDAD       💧 AGUA          🏭 PRODUCCIÓN        │
│                                                             │
│      50 kW             1.250 L            132 / 1.240       │
│      ⚠ +25%            ✓ NORMAL            MES / AÑO        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🦺 HH SIN INCIDENTES                ☀ ÍNDICE UV             │
│                                                             │
│       45.320                           8 ⚠ ALTO              │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│              ⚡ CONSUMO ELÉCTRICO                           │
│                  [ GRÁFICO ]                               │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ⚠ ALERTAS ACTIVAS                                           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ 🟢 SISTEMA   Internet ✓   AWS ✓   ESP32 ✓                  │
│ Última sincronización: 13:58     Pendientes: 0              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🏭 Dashboard — Local 2

Utiliza la misma estructura visual y funcional del Local 1, mostrando exclusivamente la información correspondiente al segundo local.

Esto permite mantener una interfaz consistente entre ambos puntos.

---

# 🏢 10. Dashboard General / Auditoría

El Dashboard General tendrá una función diferente.

No solamente mostrará datos actuales, sino que permitirá obtener una **visión consolidada de ambos locales**.

### Información principal

```text
⚡ Energía total
💧 Agua total
🏭 Producción
🦺 HH
☀️ UV
🚨 Alertas
🟢 Estado de locales
```

También permitirá comparar períodos históricos.

---

# 📅 11. Comparación histórica

La plataforma contará con un selector de período:

```text
┌─────────────────────────────┐
│ PERÍODO                     │
│                             │
│ [ Día ▼ ]                   │
└─────────────────────────────┘
```

Opciones:

- Día.
- Semana.
- Mes.

El período de comparación se adaptará a la selección.

### Ejemplo: Día

```text
Hoy
vs.
Día anterior
```

### Ejemplo: Semana

```text
Esta semana
vs.
Semana anterior
```

### Ejemplo: Mes

```text
Este mes
vs.
Mes anterior
```

También se podrá utilizar un promedio histórico cuando corresponda.

---

# 📈 12. Tabla comparativa

Una de las funciones principales será una tabla que permita analizar ambos locales.

| Local | Período actual | Período anterior | Variación | Estado |
|---|---:|---:|---:|---|
| Local 1 | 50 kW | 42 kW | +19 % | ⚠️ |
| Local 2 | 48 kW | 47 kW | +2 % | 🟢 |

La misma estructura podrá utilizarse para:

- Electricidad.
- Agua.
- Producción.
- HH.
- Otros indicadores disponibles.

El usuario podrá cambiar entre día, semana y mes sin necesitar una pantalla independiente para cada análisis.

---

# 📡 13. Calidad y antigüedad de los datos

El dashboard también indicará qué tan reciente es cada dato.

### Dato actualizado

```text
⚡ 50 kW

🟢 Actualizado
Última lectura: hace 15 segundos
```

### Dato antiguo

```text
⚡ 50 kW

🟠 Último dato conocido
Última lectura: hace 37 minutos
```

### Sin información

```text
⚡ --

🔴 SIN DATOS
Última lectura: hace 3 horas
```

Esto evita interpretar un dato antiguo como si fuera una medición actual.

---

# 🧪 14. Simulación IoT con Wokwi y Flujo de Comunicación

El proyecto utiliza **Wokwi** como entorno de simulación oficial para validar la captura y transmisión de datos IoT sin requerir hardware físico en la fase inicial.

Cada ESP32 simulado emula los sensores del local asignado y se conecta a Internet mediante la red virtual de Wokwi (`WiFi.begin("Wokwi-GUEST", "")`), publicando métricas periódicas hacia un broker MQTT seguro.

### Mapeo de Sensores en Wokwi
- **Electricidad (kW):** Potenciómetro analógico que simula un transformador de corriente no invasivo (sensor CT SCT-013).
- **Consumo de Agua (m³):** Generador de pulsos digitales que simula un caudalímetro de turbina tipo YF-S201.
- **Radiación Solar (UV):** Sensor analógico que simula un fotodiodo UV con escala UVI 0–12.

### Formato de Telemetría (Payload JSON MQTT)
El microcontrolador empaqueta las lecturas en un contrato estandarizado:

```json
{
  "device_id": "esp32-local-01",
  "timestamp": 1727736000,
  "metrics": {
    "potencia_kw": 48.2,
    "agua_m3": 12.4,
    "indice_uv": 5.1,
    "unidades_prod": 140,
    "hh_activas": 8
  }
}
```

---

# 📴 15. Arquitectura Híbrida y Sincronización Cloud (Edge ↔ AWS ↔ Dashboard)

La plataforma implementa un modelo de resiliencia híbrido inspirado en la arquitectura probada de *Project You Shall Not Pass*, adaptado a la ingesta de telemetría continua:

```mermaid
flowchart TD
    subgraph WOKWI["Simulación Wokwi (Navegador)"]
        ESP1["ESP32 Local 1<br/>(Potenciómetro = kW / Caudal = Agua)"]
        ESP2["ESP32 Local 2<br/>(Sensor UV / Producción)"]
    end

    subgraph BROKER["Broker MQTT (HiveMQ Cloud / Mosquitto)"]
        Topic1["topic: induplac/local1/telemetria"]
        Topic2["topic: induplac/local2/telemetria"]
    end

    subgraph EDGE["Edge Gateway (Raspberry Pi / Servicio Local)"]
        ClientMQTT["Cliente MQTT (Suscripción)"]
        DBLocal[("SQLite Local<br/>(telemetria, is_synced=0)")]
        SyncService["Servicio de Sincronización"]
    end

    subgraph AWS["AWS Cloud (Learner Lab)"]
        APIGW["API Gateway (HTTP POST /telemetria)"]
        Lambda["AWS Lambda (Ingesta & Reglas de Alerta)"]
        Dynamo[("DynamoDB<br/>(Tabla Histórica de Mediciones)")]
    end

    subgraph DASHBOARD["Dashboard (React + TypeScript)"]
        UI["Interfaz Web Induplac<br/>(Vistas: Local 1, Local 2, General)"]
    end

    %% Conexiones de datos
    ESP1 -->|WiFi / MQTTS| Topic1
    ESP2 -->|WiFi / MQTTS| Topic2
    Topic1 --> ClientMQTT
    Topic2 --> ClientMQTT

    ClientMQTT -->|Almacenamiento persistente| DBLocal
    DBLocal --> SyncService

    %% Estados Online / Offline
    SyncService -.->|Modo Online: Sincroniza lotes| APIGW
    APIGW --> Lambda
    Lambda --> Dynamo

    Dynamo -->|Modo Online: Lectura global e históricos| UI
    DBLocal -.->|Modo Offline: Lectura directa en planta| UI
```

### Estados Operacionales del Sistema

1. **🟢 Modo Online (Funcionamiento Normal):**
   - El Gateway Edge recibe las métricas de MQTT y las registra en SQLite con `is_synced = 0`.
   - El servicio de sincronización envía inmediatamente la lectura hacia **AWS API Gateway**.
   - Una función **AWS Lambda** valida el esquema y persiste en **Amazon DynamoDB**, tras lo cual el Edge actualiza el registro local a `is_synced = 1`.
   - El Dashboard consume la API de AWS en tiempo real.

2. **🔴 Modo Offline (Corte de Internet o Caída Cloud):**
   - El ESP32 continúa transmitiendo localmente hacia el Edge Gateway.
   - El Gateway almacena todas las lecturas de forma ininterrumpida en **SQLite local** con `is_synced = 0`.
   - El Dashboard en planta detecta la caída de red y conmuta su fuente de datos al Gateway local, informando al usuario en pantalla:
     ```text
     🔴 MODO OFFLINE — Operando sobre Gateway local (Sin conexión con AWS)
     ```
   - **Garantía:** Cero pérdida de información durante la contingencia.

3. **🟡 Modo Recuperación y Sincronización (Syncing):**
   - El Gateway detecta el restablecimiento de Internet mediante un *healthcheck* periódico.
   - El servicio de sincronización agrupa los registros pendientes (`is_synced = 0`) y los envía en lotes (*batches*) hacia AWS.
   - Cada registro posee un identificador único (UUIDv4) y marca temporal UTC para asegurar **idempotencia** (evita duplicar métricas en caso de reconexión inestable).
   - Una vez confirmada la recepción por AWS, los registros se marcan con `is_synced = 1` y el Dashboard retorna a estado `🟢 ONLINE`.

---

# 🔐 16. Ciberseguridad (Estrategia de Defensa en 5 Capas)

La seguridad no se aborda como un complemento tardío, sino como una propiedad estructural del diseño híbrido:

```mermaid
flowchart LR
    subgraph C1["1. Sensores & MQTT"]
        ESP[ESP32] -->|MQTTS + TLS 8883<br/>Credenciales por dispositivo| Broker
    end

    subgraph C2["2. Edge Gateway"]
        Broker -->|SQLite con Checksum<br/>Roles IAM de menor privilegio| Edge[Raspberry Pi]
    end

    subgraph C3["3. Enlace Híbrido"]
        Edge -->|HTTPS / TLS 1.3<br/>UUIDv4 Anti-Replay| AWS[AWS Cloud]
    end

    subgraph C4["4. Gestión de Acceso"]
        AWS -->|JWT / Cognito<br/>RBAC: Operario / Admin| Dash[Dashboard React]
    end
```

### Las 5 Capas de Protección

1. **Capa 1 — Dispositivos y Protocolo MQTT:**
   - **MQTTS con TLS (Puerto 8883):** Canal cifrado en la red local.
   - **Autenticación por dispositivo:** Credenciales individuales para cada ESP32; se rechazan conexiones anónimas.
   - **Validación de límites físicos:** El Gateway descarta lecturas incoherentes (ej. $kW < 0$ o $kW > 500$) para neutralizar inyecciones de datos.

2. **Capa 2 — Gateway Edge (Raspberry Pi & SQLite):**
   - **Zero Hardcoding:** Credenciales de AWS y broker almacenadas exclusivamente en `.env` (excluido de Git mediante `.gitignore`).
   - **Mínimo privilegio en AWS IAM:** Permisos acotados estrictamente a la ingesta (`iot:Publish` o `execute-api:Invoke`), sin privilegios administrativos.
   - **Integridad local:** Hashes de control para detectar adulteración manual de la base de datos SQLite mientras opera offline.

3. **Capa 3 — Sincronización y Enlace Cloud:**
   - **Prevención de Replay Attacks:** Uso de identificadores únicos (UUIDv4) por medición para garantizar idempotencia en AWS.
   - **Canal seguro:** Transporte exclusivo mediante HTTPS / TLS 1.3.

4. **Capa 4 — Control de Acceso en Dashboard (RBAC):**

| Rol | Dashboard Local 1 / 2 | Dashboard General | Modificar Umbrales | Simulación de Fallas |
| :--- | :---: | :---: | :---: | :---: |
| **Operario de Planta** | ✅ Solo lectura | ❌ Denegado | ❌ Denegado | ❌ Denegado |
| **Jefe de Mantenimiento** | ✅ Lectura / Alertas | ✅ Lectura | ❌ Denegado | ❌ Denegado |
| **Administrador / Gerencia** | ✅ Control total | ✅ Consolidado | ✅ Permitido | ✅ Permitido |

5. **Capa 5 — Privacidad y Cumplimiento Normativo (Ley 19.628 - Chile):**
   - Las métricas de Horas Hombre (HH) son estrictamente agregadas y anónimas (ej. `trabajadores_activos: 12`, `hh_turno: 96`).
   - No se almacenan nombres, RUTs ni datos personales de los colaboradores de Induplac.

> 📖 Consulta la documentación técnica completa en [**`docs/ciberseguridad.md`**](docs/ciberseguridad.md).

---

# 🗂️ 17. Estructura del repositorio

```text
Induplac_IoT/
│
├── README.md
├── CONTRIBUTING.md
├── .gitignore
│
├── docs/
│   ├── arquitectura.md
│   ├── dashboard.md
│   ├── modelo-datos.md
│   ├── modo-offline.md
│   ├── sincronizacion.md
│   ├── ciberseguridad.md
│   ├── stack-tecnologico.md
│   ├── casos-prueba.md
│   ├── decisiones-tecnicas.md
│   └── roadmap.md
│
├── dashboard/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── README.md
│
├── edge/
│   ├── src/
│   ├── database/
│   └── README.md
│
├── sensors/
│   ├── local-1/
│   ├── local-2/
│   └── README.md
│
├── simulation/
│   ├── local-1/
│   ├── local-2/
│   └── README.md
│
├── backend/
│   ├── api/
│   ├── functions/
│   └── README.md
│
└── infrastructure/
    └── README.md
```

La carpeta `simulation/` podrá utilizarse para Wokwi si el equipo decide incorporarlo.

---

# 🧩 18. Tecnologías

| Área | Tecnología |
|---|---|
| Microcontrolador | ESP32 |
| Comunicación | MQTT |
| Edge | Raspberry Pi / Gateway |
| Base local | SQLite |
| Cloud | AWS |
| Dashboard | React + TypeScript |
| Simulación | Wokwi *(propuesta)* |
| Control de versiones | Git + GitHub |
| Documentación | Markdown + Mermaid |

Las tecnologías pueden cambiar durante la implementación si existe una justificación técnica.

---

# 🏃 19. Plan de desarrollo

## Sprint 1 — Captura de datos

```text
ESP32
 ↓
MQTT
 ↓
Edge
 ↓
Datos ficticios
```

Objetivos:

- Preparar ESP32.
- Definir formato de datos.
- Implementar comunicación.
- Generar datos ficticios.
- Preparar almacenamiento local.

---

## Sprint 2 — Visualización

```text
Datos
 ↓
Backend
 ↓
Dashboard
```

Objetivos:

- Dashboard Local 1.
- Dashboard Local 2.
- Dashboard General.
- Tarjetas de indicadores.
- Alertas.
- Gráficos.
- Comparaciones históricas.

---

## Sprint 3 — Integración híbrida

```text
ONLINE
  ↓
AWS

OFFLINE
  ↓
SQLite

RECUPERACIÓN
  ↓
SYNC
```

Objetivos:

- Implementar modo Offline.
- Implementar sincronización.
- Validar recuperación de conexión.
- Integrar dashboards.
- Ejecutar pruebas.
- Preparar demostración final.

---

# 🧪 20. Pruebas de demostración

### Prueba 1 — Datos normales

```text
ESP32 → Edge → AWS → Dashboard

Resultado esperado:
🟢 Sistema funcionando normalmente
```

### Prueba 2 — Alerta eléctrica

```text
Aumentar consumo
      ↓
Superar umbral
      ↓
⚠ Alerta
```

### Prueba 3 — UV elevado

```text
UV ≥ 8
 ↓
⚠ Riesgo
```

### Prueba 4 — Pérdida de Internet

```text
Internet ❌
 ↓
Edge continúa funcionando
 ↓
SQLite almacena datos
 ↓
Dashboard continúa disponible
```

### Prueba 5 — Recuperación

```text
Internet ✓
 ↓
SYNCING
 ↓
Datos pendientes enviados
 ↓
ONLINE
```

---

# 📌 21. Alcance del MVP

## Incluido

- [x] Dos locales.
- [x] Datos ficticios.
- [x] Electricidad.
- [x] Agua.
- [x] Producción.
- [x] HH.
- [x] UV.
- [x] Diseño de dashboards.
- [x] Alertas.
- [x] Comparaciones históricas.
- [ ] Arquitectura híbrida completa.
- [ ] Almacenamiento local.
- [ ] Sincronización.
- [ ] Ciberseguridad.
- [ ] Simulación Wokwi *(por definir)*.

## Fuera del alcance actual

- Instalación eléctrica real.
- Instalación hidráulica real.
- Acceso a bases de datos reales de Induplac.
- Uso de información personal real.
- Certificación de gestión energética.
- Implementación industrial definitiva.

---

# 🗺️ 22. Roadmap

```text
[✓] Definición del problema
[✓] Propuesta de solución
[✓] Definición de variables
[✓] Arquitectura inicial

[ ] Diseño definitivo de dashboards
[ ] Modelo de datos
[ ] Implementación ESP32
[ ] Comunicación MQTT
[ ] Edge / SQLite
[ ] Dashboard Local 1
[ ] Dashboard Local 2
[ ] Dashboard General
[ ] Comparaciones históricas
[ ] Sistema de alertas
[ ] Modo Offline
[ ] Sincronización
[ ] Ciberseguridad
[ ] Integración Cloud
[ ] Simulación Wokwi
[ ] Pruebas
[ ] Demostración final
```

---

# 🔮 23. Trabajo futuro

Una futura implementación podría incorporar:

- Sensores reales autorizados por la empresa.
- Automatización de indicadores de producción.
- Automatización de HH.
- Alertas mediante correo o mensajería.
- Umbrales configurables.
- Mayor cantidad de locales.
- Integración con sistemas existentes.
- Mejoras de seguridad.
- Analítica avanzada.
- Predicción de consumo.

---

# 🤝 24. Contribución

Para mantener el proyecto ordenado:

1. Crear una rama para cada funcionalidad.
2. Utilizar nombres descriptivos.
3. Realizar commits claros.
4. Documentar cambios importantes.
5. Evitar subir credenciales o claves.
6. Realizar Pull Request antes de integrar cambios importantes.
7. Mantener actualizada la documentación.

Ejemplo:

```text
feature/dashboard-local
feature/mqtt-esp32
feature/offline-mode
feature/aws-integration
feature/cybersecurity
```

---

# ⚠️ 25. Estado actual

> 🚧 **Proyecto en desarrollo**

Actualmente el proyecto se encuentra en etapa de definición y prototipado.

La arquitectura, tecnologías y componentes pueden modificarse durante el desarrollo según las pruebas realizadas y las decisiones del equipo.

Los datos utilizados en esta etapa son ficticios.

---

<div align="center">

## 🏭 Induplac IoT

**Problemáticas Globales y Prototipado · Duoc UC**

*Del dato al análisis. Del análisis a la decisión.*

</div>
