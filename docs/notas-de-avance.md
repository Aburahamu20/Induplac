# 📝 Notas de Avance — Induplac IoT

> Bitácora de sesiones de trabajo: observaciones, decisiones e ideas en evaluación.  
> Complementa a `docs/CONTEXTO.md`. Lo marcado como **idea** o **propuesta** todavía no es decisión del equipo.

---

## 2026-10-07 — Revisión de documentación e ideas de históricos

### 1. Observaciones a la documentación actual (pendientes de corregir)

**Inconsistencias entre documentos**
- [ ] **Autonomía offline:** `CONTEXTO.md` dice "3 a 8 años", el diagrama de `modo-offline.md` dice "> 3 años" y el cálculo da ~8,7 años. Unificar en un solo valor.
- [ ] **Supuesto del cálculo de retención:** 34.560 lecturas/día asume 1 mensaje por local cada 5 s. Dejar explícito el supuesto (¿un JSON con todas las variables por local? ¿varios ESP32 por local?).
- [ ] **NAT Gateway y RDS Multi-AZ** aparecen en el diagrama de `infrastructure/README.md`, pero la sección de costos y el ADR-04 dicen que se evitan (Single-AZ + VPC Endpoints). Alinear el diagrama.

**Problemas técnicos a resolver**
- [ ] **Costo de la VPN Site-to-Site:** AWS cobra por hora cada conexión VPN; 2 sedes 24/7 pueden consumir gran parte de los USD 100 del Learner Lab. Verificar además si Learner Lab permite crear VGW/VPN. Propuesta: VPN como diseño documentado y MVP con HTTPS hacia API Gateway.
- [ ] **VPN vs. API Gateway:** se dice que el Edge sincroniza por la VPN hacia la subred privada, pero la ingesta usa API Gateway (endpoint público). Elegir: API Gateway privado + interface endpoint (con costo) o HTTPS público con TLS. Documentar la elección.
- [ ] **Failover del dashboard:** un dashboard servido desde la nube por HTTPS no puede llamar a `http://192.168.10.10:8000` (mixed content) y sin internet ni siquiera carga. Propuesta: la Raspberry Pi sirve el dashboard en planta; la nube es la vista consolidada (ver sección 3).
- [ ] **Wokwi + broker local:** el ESP32 en Wokwi web sale por `Wokwi-GUEST` y no alcanza un Mosquitto en la LAN sin el gateway privado de Wokwi. Esto inclina la decisión pendiente #3 hacia **HiveMQ Cloud** (o broker público) para la demo.
- [ ] **Dominio `api.induplac.aws`:** `.aws` es un TLD de Amazon, no utilizable. Reemplazar por la URL real de API Gateway o un placeholder.
- [ ] **Normativa:** evaluar mencionar la **Ley 21.719** (nueva ley de protección de datos que reemplaza a la 19.628). Confirmar fecha de entrada en vigencia antes de citarla.
- [ ] **ADR-01 (persistencia políglota) — reforzar argumentos:** el argumento "la telemetría satura una base relacional pequeña" es débil a esta escala (~34.560 lecturas/día en lotes de 50 ≈ 700 inserciones/día). Reemplazar por:
  1. **Costo/disponibilidad en Learner Lab:** DynamoDB on-demand ~USD 0 y siempre encendido; RDS se puede apagar sin cortar la ingesta.
  2. **Lambda + RDS:** cada invocación abre conexiones y agota el límite de una instancia chica (RDS Proxy tiene costo); DynamoDB funciona por API HTTP.
  3. **Separación de responsabilidades:** crudo con vida corta (TTL) vs. agregados como histórico permanente.
  - Alternativa válida a mencionar: solo PostgreSQL (+ TimescaleDB), más simple pero pierde los puntos 1 y 2.

### 2. Ruta de datos y payloads (propuesta)

Ruta: ESP32 → Broker MQTT → Edge (SQLite) → API Gateway + Lambda → DynamoDB (crudo) / RDS (agregados + RBAC) → Dashboard.

- **ESP32 → Broker** (`induplac/localN/telemetria`, JSON ≤ 2 KB). Propuesta Local 1:
  ```json
  { "device_id": "esp32-local-01", "seq": 10452, "ts": 1759874400,
    "energia_kw": 42.7, "agua_m3_acum": 1532.418, "agua_m3h": 3.2,
    "uv_index": 5.4, "produccion_acum": 312, "personal_activo": 18 }
  ```
  Local 2: sin UV ni producción; energía separada en climatización e iluminación.
- **Broker → Edge:** validación de rangos (kW 0–250, m³/h 0–50, UV 0–15); rechazos a log.
- **Edge → AWS:** lote `{ batch_id, local_id, sha256, records[] }` de 50 registros, orden cronológico.
- **Lambda → bases:** DynamoDB recibe cada lectura (deduplicada por id); RDS solo agregados + entidades de gestión.
- **Dashboard:** JSON vía API con JWT (rol define qué local se ve).

Pendientes detectados:
- [ ] **Origen del identificador único:** los docs dicen que el `record_id` lo genera el Edge, pero si el ESP32 reenvía desde su ring buffer tras un reinicio de la Pi, se duplicaría con otro UUID. Propuesta: identificador `device_id + seq` generado en el ESP32.
- [ ] **Hora confiable:** el ESP32 debe sincronizar por NTP al arrancar para que las lecturas del ring buffer tengan `ts` válido.

### 3. Comportamiento online / offline y acceso al dashboard sin internet

- **Online:** la Pi guarda todo en SQLite y sincroniza casi de inmediato (pendientes ≈ 0). Planta lee la Pi; gerencia lee AWS.
- **Offline:** ESP32, broker, Edge y dashboard de planta siguen operando en red local; pendientes crecen en SQLite. Gerencia ve el local como **desconectado con su último dato y hora**.
- **Syncing:** al volver internet, sube lo acumulado en lotes de 50 hasta llegar a 0 pendientes; recién ahí el período del corte aparece completo en la nube.

Propuesta de acceso local (falta en `infrastructure/README.md`):
- [ ] **La Pi sirve el dashboard** (build de React + API local, ej. Nginx en 443) y el dashboard usa rutas relativas (`/api/...`). La nube tiene otra copia del mismo build apuntando a API Gateway.
- [ ] **VLAN de usuarios/operarios** y regla inter-VLAN que permita **solo** HTTPS hacia la Pi, manteniendo aislados los ESP32. Ejemplo (VLAN 30 hipotética):
  ```
  ip access-list extended OPERARIOS_A_EDGE
   permit tcp 192.168.30.0 0.0.0.255 host 192.168.10.10 eq 443
   deny   ip  192.168.30.0 0.0.0.255 192.168.10.0 0.0.0.255
   permit ip  any any
  !
  interface Vlan30
   ip access-group OPERARIOS_A_EDGE in
  ```
- [ ] **DNS local** (`edge.induplac.local` en router/Pi o mDNS) o acceso por IP.
- [ ] **Certificado HTTPS local:** CA interna (Let's Encrypt no renueva sin internet); autofirmado para la demo.
- [ ] **Login sin internet:** con Cognito no se puede iniciar sesión offline. Opciones: validar JWT con llave pública cacheada (sesiones ya abiertas) + login local en la Pi con usuarios/roles cacheados. El mock JWT del MVP lo simplifica.

### 4. Ideas en evaluación — Históricos (estacionadas)

#### Idea A: Comparación histórica por período
- Comparar **día, mes, año y estaciones** (ej.: primavera 2026 vs. primavera 2025).
- **Estaciones meteorológicas, hemisferio sur** (meses completos):
  - Verano: dic–ene–feb (se identifica por el año en que empieza: "Verano 2025-26").
  - Otoño: mar–may · Invierno: jun–ago · Primavera: sep–nov.
- **Tabla calendario `dim_calendario`** en RDS (fecha, año, mes, día de semana, estación, temporada, inicio de estación) para agrupar sin crear tablas extra de métricas.
- **Comparación justa:**
  - "A la misma fecha": comparar solo los primeros N días transcurridos de cada período.
  - Mostrar **promedio diario** además del total.
  - Para días: comparar contra **364 días atrás** (mismo día de la semana).
- **Agregación por variable** (no todo se promedia):
  - Energía: kWh (promedio kW × horas) + peak kW.
  - Agua: delta del contador (máx − mín), cuidando resets; agua nocturna para fugas.
  - UV: máximo, promedio y minutos sobre 6 UVI.
  - Producción: delta/suma. HH: último valor del día.
- **Recalcular días afectados** cuando lleguen datos atrasados tras un período offline (UPSERT por `local + fecha`).
- Agregar por día en zona horaria `America/Santiago` (guardar en UTC).
- **Generador de datos sintéticos con estacionalidad** (~2 años) para que la demo muestre diferencias reales entre estaciones.
- **Replicar `metricas_diarias` en la Raspberry Pi** para que los históricos funcionen también en modo OFFLINE.

#### Idea B: Análisis detallado de años anteriores (menos generalizado)
- **Detalle temporal:** agregados **por hora** de forma permanente → curva de carga típica, comparación por turno, días hábiles vs. fin de semana, consumo fuera de turno.
- **Detalle por origen:** agregados **por dispositivo/área** (máquina, tablero, climatización, iluminación) para identificar de dónde viene una diferencia.
- **Indicadores normalizados:** kWh por unidad producida, m³ por unidad o por persona, minutos sobre umbral y cantidad de alertas por período.
- Implicancia: el crudo en DynamoDB tendría TTL (ej. 90 días), así que el detalle horario por dispositivo debe guardarse en RDS (`metricas_horarias`, ~175 mil filas/año con ~10 sensores).

### 5. Próximo paso
- Definir con el equipo qué sigue: Paso 1 del roadmap (Dashboard React), demo del flujo online/offline o diseño de históricos.

---

## 2026-10-07 (noche) — Documento "Decisiones Cloud" del equipo

Fuente: `Induplac_Decisiones_Cloud` (Castro, Fuentes, González, Murúa, Saavedra). Resumen de lo decidido en clase:

1. **Qué sube a Cloud:** solo datos **agregados y validados** por el Edge, nunca la lectura cruda:
   - Consumo: promedios de electricidad y agua **cada 15 minutos**.
   - Producción: tableros fabricados en el mes y acumulado anual.
   - Seguridad: HH sin incidentes.
   - Ambiental: índice UV del día.
2. **Local vs. backend:** el Edge filtra y guarda (crudo reciente, buffer offline, validación). AWS consolida, compara y decide (histórico, alertas, inventario de dispositivos, usuarios y roles).
3. **Protocolos:** ESP32 → Edge por MQTTS 8883. Edge → AWS por HTTPS/REST a API Gateway **dentro del túnel VPN IPsec**. Dashboard → backend por HTTPS/REST.
4. **Almacenamiento:** SQLite (buffer Edge), DynamoDB (series de tiempo de consumo), RDS PostgreSQL (usuarios, roles, catálogo, umbrales e históricos agregados).
5. **Alertas (Lambda en AWS, por cada dato nuevo):**
   - Electricidad: consumo horario **20 % sobre el promedio de las últimas 4 semanas en el mismo horario**.
   - Agua: consumo diario sobre un umbral definido.
   - UV: **≥ 8**.
   - La alerta se registra en RDS y el dashboard la muestra en rojo. Correo/Telegram queda post-MVP.
6. **Dashboard:** monitor por sede (consumo actual vs. promedio histórico, producción, HH, UV, alertas) + histórico comparando sedes y períodos.
7. **Acceso:** RBAC con roles en RDS y **MFA (Microsoft Authenticator)**. Operario: su sede. Jefe de Mantenimiento/Operaciones: ambas sedes + gestión de alertas. Administrador: todo.
8. **Sin internet:** el Edge sigue leyendo y guardando en SQLite; la pantalla de la sede muestra los **últimos valores conocidos**. Al volver la conexión/VPN sincroniza sin perder ni duplicar.

### Diferencias con lo que dice el repo (a conciliar)

| Tema | Repo (`CONTEXTO.md`, `modo-offline.md`, etc.) | Documento del equipo |
|---|---|---|
| Qué sube a AWS | Cada lectura cruda (5 s) en lotes de 50 | Solo promedios cada 15 min |
| Rol de DynamoDB | Telemetría cruda de alta frecuencia | Series de 15 min (≈ 96 registros/día por variable y local) |
| Umbral UV | Advertencia sobre 6 | Alerta en 8 o más |
| Umbral energía | Fijo: < 45 kW verde, 45–55 amarillo, > 55 rojo | Relativo: +20 % vs. promedio de 4 semanas a la misma hora |
| Dónde se calculan alertas | Edge muestra alarmas en planta en tiempo real | Lambda en AWS |
| Pantalla offline | Datos en tiempo real desde la Pi | Últimos valores conocidos |
| Autenticación | JWT / Cognito; MVP con mock JWT | MFA con Microsoft Authenticator |
| Producción | Placas y molduras vs. meta del turno | Tableros del mes y acumulado anual |
| Roles | Operario / Jefe de Mantenimiento / Admin | Igual, con "Jefe de Mantenimiento/Operaciones" |

### Puntos a revisar cuando se decidan cambios
- [ ] **Alertas sin internet:** si las alertas solo las calcula Lambda, durante un corte la planta no recibe alertas (ej. UV alto). Evaluar umbrales simples también en el Edge.
- [ ] **Idempotencia con agregados:** al subir promedios de 15 min, la llave natural pasa a ser `local + variable + inicio_intervalo` (reemplaza/complementa al `record_id` por lectura).
- [ ] **Cálculo del promedio de 15 min durante un corte:** el Edge debe seguir calculando intervalos offline y subirlos todos al reconectar.
- [ ] **Regla de electricidad relativa:** requiere guardar el histórico horario/15 min (4 semanas mínimo) y definir qué hacer las primeras 4 semanas sin historia (umbral fijo de respaldo).
- [ ] **MFA sin internet:** el TOTP de Microsoft Authenticator funciona offline, pero el servicio que lo valida (Cognito / Entra ID) está en la nube. Definir login local en la Pi.
- [ ] **Argumento de DynamoDB:** con datos cada 15 min el volumen baja mucho; el ADR-01 debe apoyarse en costo/disponibilidad y Lambda sin conexiones, no en volumen.
- [ ] **Históricos (ideas A y B):** los intervalos de 15 min en la nube ya permiten curvas por hora y comparaciones por período; el crudo de 5 s solo vive 30 días en el Edge.
- [ ] **Actualizar `CONTEXTO.md`, `modo-offline.md` y `ciberseguridad.md`** para reflejar estas decisiones una vez conciliadas.
