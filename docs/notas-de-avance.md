# 📝 Notas de Avance — Induplac IoT

> Bitácora de sesiones de trabajo: observaciones, decisiones e ideas en evaluación.  
> Complementa a `docs/CONTEXTO.md`. Lo marcado como **idea** o **propuesta** todavía no es decisión del equipo.  
> Las entradas antiguas se conservan como registro; el estado vigente de cada pendiente está en la entrada más reciente.

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

---

## 2026-10-08 — Decisiones del equipo y actualización de la documentación

### Decisiones tomadas
1. **Offline = online en planta:** sin internet el dashboard de planta muestra los datos en tiempo real igual que con conexión. → El Edge sirve el dashboard (ADR-07).
2. **Alertas en los dos niveles:** Edge y Lambda evalúan las mismas reglas, para que haya alertas también offline (ADR-06).
3. **VPN real:** VPN Site-to-Site IPsec operativa. → Ingesta por **API Gateway privada** con VPC Endpoint `execute-api` (ADR-02).
4. **MFA implementado:** autenticación con MFA (Microsoft Authenticator) para administradores y quienes pueden cambiar cosas. → Cognito con MFA TOTP obligatorio para Administrador y Jefe de Mantenimiento/Operaciones; Operario sin MFA (ADR-08).

**Criterio para la VPN:** la factibilidad se revisa más adelante. **Si el Learner Lab no permite levantarla, la VPN se mantiene en el diseño documentado, pero no se demuestra.** En ese caso, para la demo el Edge necesitará una ruta de ingesta alternativa hacia AWS (por ejemplo, API Gateway pública con HTTPS/TLS y credenciales IAM de mínimo privilegio), porque la API privada solo es alcanzable a través del túnel.

### Documentos actualizados (PR #3, mergeado a `main`)
- `docs/CONTEXTO.md`: agregación de 15 min, protocolos por tramo, alertas en dos niveles, umbrales nuevos (UV ≥ 8, energía +20 % con respaldo fijo), producción en tableros, roles y MFA, showcase actualizado.
- `docs/decisiones-tecnicas.md`: ADR-01 con nuevos argumentos; ADR-02 VPN real + API privada; ADR-03 con VLAN de operarios; ADR-04 con `SG-VPCE-API`; nuevos ADR-05 a ADR-08.
- `docs/modo-offline.md`: tablas `lecturas_crudas`, `intervalos_15min`, `alertas_local`; cálculo de capacidad unificado; nuevo ciclo de vida; estados con dashboard local.
- `docs/ciberseguridad.md`: idempotencia por intervalo, VPN + API privada, RBAC con MFA, login local offline, nuevas pruebas de verificación.
- `infrastructure/README.md`: VLAN de operarios con ACL, API privada y pública, sin NAT, RDS Single-AZ, costos de VPN y endpoint.

### Estado de pendientes anteriores
**Resueltos en esta actualización:** autonomía offline unificada · supuesto del cálculo explícito · NAT/Multi-AZ en el diagrama · VPN vs. API Gateway · failover del dashboard · dominio `api.induplac.aws` · ADR-01 · VLAN de operarios, DNS y certificado locales · alertas sin internet · idempotencia con agregados · intervalos durante un corte · regla de energía sin historia · NTP en el ESP32.

**Siguen abiertos:**
- [ ] **Factibilidad de la VPN (se revisa más adelante):** verificar si el Learner Lab permite VPN Site-to-Site y VPC Interface Endpoints. Si no, queda documentada sin demostrarse (ver criterio arriba). Plan B posible: EC2 con strongSwan.
- [ ] **Costo de la VPN:** ~USD 0,05/h por conexión (~USD 72/mes con 2 sedes 24/7). Si se levanta, crearla para pruebas/demo y eliminarla al terminar.
- [ ] **Cognito con MFA en Learner Lab:** verificar disponibilidad.
- [ ] **Acciones permitidas offline (propuesta):** reconocer alertas con login local; umbrales y usuarios solo online con MFA. Validar con el equipo.
- [ ] **Broker MQTT para Wokwi:** HiveMQ Cloud vs. Mosquitto (limitación de `Wokwi-GUEST`).
- [ ] **Identificador por lectura (`device_id + seq`)** entre ESP32 y Edge, para reenvíos desde el ring buffer.
- [ ] **Ley 21.719:** confirmar vigencia antes de citarla.
- [ ] **Ideas de históricos A y B:** siguen estacionadas.

---

## 2026-10-14 — Respuestas del equipo a los pendientes

### Decisiones tomadas
1. **Demo 100 % en Wokwi** (sin hardware físico).
2. **Broker MQTT:** el equipo eligió **HiveMQ Cloud**. Al revisarlo, su plan gratuito permanente (Serverless) fue retirado y hoy solo ofrece una **prueba de 15 días** del plan Starter, que se borra al terminar si no se agrega un medio de pago. **Propuesta:** usar **EMQX Serverless** (gratis, con TLS; ~1 millón de minutos de sesión al mes, suficiente para 2 ESP32 + 2 Edge conectados 24/7 ≈ 173 mil min/mes). *Pendiente de confirmar por el equipo.*
3. **Acciones sin internet: aprobadas** — ver todo y reconocer alertas con login local en el Edge; umbrales y usuarios solo online con MFA.
4. **Umbrales de agua** (valores ficticios de referencia, ver `CONTEXTO.md` §8.2):
   - Local 1 (planta): normal ~10 m³/día · advertencia > 12 · alerta > 14 m³/día · posible fuga > 0,3 m³/h sostenido 1 h de noche o fin de semana.
   - Local 2 (oficinas): normal ~1,5 m³/día · advertencia > 2 · alerta > 2,5 m³/día · posible fuga > 0,05 m³/h sostenido 1 h de noche o fin de semana.
5. **Cognito con MFA se implementa; la VPN queda solo como diseño y no se demuestra.** En la demo, el Edge sincroniza por HTTPS contra una API Gateway pública con credenciales IAM de mínimo privilegio.

### Aclaración importante para la demo
- En el diseño real el broker vive **dentro de la planta** (Mosquitto en la Raspberry Pi). En la simulación va **en la nube** solo porque Wokwi corre en el navegador y no alcanza la red local.
- Por eso, en la demo el **"corte de red"** se simula sobre el **enlace Edge → AWS** (la sincronización), que es el que realmente se cae en una planta.

### Documentos actualizados
`docs/CONTEXTO.md`, `docs/decisiones-tecnicas.md` (ADR-02, ADR-06, ADR-08), `docs/ciberseguridad.md`, `infrastructure/README.md`, `docs/GUIA-EQUIPO.md`.

### Siguen abiertos
- [ ] Confirmar broker: **EMQX Serverless** (propuesto) o prueba de HiveMQ solo para la semana de la demo.
- [ ] Probar en el Learner Lab que **Cognito con MFA** funcione.
- [ ] Actualizar secciones 14 y 15 del `README.md` (todavía muestran el diseño anterior).
- [ ] Identificador por lectura (`device_id + seq`) entre ESP32 y Edge.
- [ ] Ley 21.719: confirmar vigencia antes de citarla.
- [ ] Ideas de históricos A y B: siguen estacionadas.

---

## 2026-10-14 (noche) — Coordinación del trabajo en paralelo

- Nuevo **tablero `docs/EN-CURSO.md`**: antes de empezar una tarea se reserva ahí (nombre, fecha, rama, estado) con commit + push; al terminar se marca lista. Evita que dos personas o dos IA hagan lo mismo.
- Nuevo **`AGENTS.md`** en la raíz con las reglas para cualquier IA (leer CONTEXTO, notas y EN-CURSO; reservar antes de trabajar; registrar al terminar). `CLAUDE.md` y `GEMINI.md` apuntan a él.
- README enlaza al tablero.

---

## 2026-10-14 (noche) — Reglas de Pull Request

- **Todo cambio va por Pull Request**; nadie hace commit directo en `main` (ya lo decía `CONTRIBUTING.md`). Única excepción: reservar o cambiar estados en `docs/EN-CURSO.md`, para que la reserva se vea de inmediato.
- Nueva **plantilla de PR** (`.github/pull_request_template.md`): obliga a dejar escrito qué se cambió, por qué, cómo probarlo y un checklist (reserva, notas, CONTEXTO, sin secretos, aviso al grupo).
- `AGENTS.md`, `CONTRIBUTING.md` y `docs/EN-CURSO.md` actualizados con estas reglas.
- Nota: los commits de documentación del 2026-10-07 al 2026-10-14 se hicieron directo en `main` (salvo PR #3). Desde ahora se respeta el flujo por PR.
- Rama del dashboard renombrada a `feature/dashboard` para seguir la convención de `CONTRIBUTING.md`.

---

## 2026-10-14 (noche) — Broker MQTT definido

- **Decisión:** el broker de la simulación es **EMQX Serverless**. HiveMQ Cloud se descarta porque su plan gratuito permanente fue retirado (solo ofrece prueba de 15 días).
- Configuración acordada: *spend limit* en **0** (solo cuota gratis), un usuario por dispositivo (`esp32-local1`, `esp32-local2`, `edge-local1`, `edge-local2`), puertos **8883** (MQTT/TLS) y **8084** (WebSocket/TLS). Las credenciales **no se suben al repo**; van en `.env`.
- Tarea 2 del tablero reservada para Abraham; tareas 3 y 4 quedan libres para cuando el broker esté listo.
- Actualizados `docs/CONTEXTO.md` y `docs/GUIA-EQUIPO.md`.

---

## 2026-10-14 (noche) — Pauta de la Nota 2

- El profesor envió la pauta de la **Nota 2** (13 entregables) y la clase de **PMI, roles y RACI**. Resumen y borradores en [`docs/NOTA-2.md`](NOTA-2.md).
- Ponderación conocida: roles y fortalezas **15 %**; planificación ágil + PMI/Gantt **15 %**.
- Se cargaron las tareas **9 a 18** en `docs/EN-CURSO.md`, todas libres para que cada integrante reserve la suya. Prioridad de hoy: roles (9) y RACI (10).
- Propuesta: como somos 5, agregar el rol **Seguridad y DevOps** a los 4 que sugiere el profe.
- Mayor riesgo: la **demo del prototipo** (el código va recién en la base del dashboard).
- Pendiente: fecha de entrega, asignación de roles y formato del informe.

---

## 2026-10-16 — Contrato de datos del dashboard, login y permisos

- Nuevo **`docs/api-dashboard.md`**: qué le pide el dashboard a la API y qué JSON recibe. Si el Edge (tarea 4) y el backend (tarea 5) lo respetan, el mismo build funciona en planta y en la nube. El dashboard tendrá una fuente simulada y una real, intercambiables por variable de entorno.
- El **nivel** (verde/amarillo/rojo) lo calcula la API, no el dashboard, para no tener una tercera copia de las reglas.
- Cada Raspberry Pi solo ve su propio local; la **vista General** existe solo en la nube.
- **Decisiones (Abraham, pendientes de revisión del equipo):**
  1. **Login obligatorio para ver** el dashboard, con o sin internet.
  2. **Clave temporal** creada por el Administrador y **cambio obligatorio** en el primer login; la clave personal nadie la puede ver (solo hash). Si se olvida, se resetea.
  3. **Permisos por usuario:** el rol es una plantilla y el Administrador ajusta qué puede ver y modificar cada persona.
  4. **MFA obligatorio** para quien tenga cualquier permiso de modificación, también en planta.
- Nuevo **ADR-09**; actualizados `CONTEXTO.md` (§2.2, §4.8, §8.3) y la nota en ADR-08.

### Siguen abiertos (ver `docs/api-dashboard.md` §7)
- [ ] Usuarios del Edge: propios del Edge (propuesta) o caché tras login online.
- [ ] Polling cada 5 s (propuesta) o WebSocket.
- [ ] Nombres de variables en el dashboard (propuesta) o en la API.
- [ ] Local "desconectado" en la nube tras 30 min sin datos (propuesta).

### Hora sincronizada sin internet (ADR-10, propuesta)
- La Raspberry Pi no tiene pila de reloj: tras un corte de luz sin internet arrancaría con la hora mal, y con ella todos los intervalos y alertas.
- **Decisión (Abraham):** módulo **RTC DS3231** en cada Pi + `chrony`; la Pi es el **servidor NTP de la sede** y los ESP32 toman la hora desde ella. Así la planta tiene la hora correcta sin depender de internet.
- Se permite UDP 123 desde la VLAN IoT hacia la Pi. En la demo con Wokwi no aplica.
- Actualizados `CONTEXTO.md` §4.9, `decisiones-tecnicas.md` (ADR-10), `modo-offline.md` §3.1, `ciberseguridad.md` (hardening) y `api-dashboard.md` §2.

## 2026-10-17 (noche) — Backend en AWS funcionando de punta a punta

Abraham y Felipe (tarea 5), con el Learner Lab de Felipe en us-east-1.

### Qué quedó funcionando
- **DynamoDB:** tablas `induplac-intervalos` (`local_id` + `inicio_intervalo`) y `induplac-alertas` (`local_id` + `id`), on-demand.
- **Lambda `induplac-api`** (Python 3.12, `LabRole`): ingesta `POST /intervalos` con clave compartida, reglas de alerta de §8.2 y los endpoints del contrato del dashboard.
- **API Gateway HTTP API** con ruta `ANY /{proxy+}`, stage `$default` con auto-deploy y CORS. `/health` responde `{"ok": true}`.
- **Simulador del Edge** (`backend/scripts/simular_edge.py`): cargó 29 días de historia y manda el intervalo actual cada 20 s.
- **Dashboard de gerencia publicado en S3** (HTTPS), leyendo los datos de AWS con `VITE_FUENTE=api`.

Cadena demostrada: `simulador → API Gateway → Lambda → DynamoDB → Lambda → API Gateway → dashboard en S3`.

### Simplificaciones del MVP (documentadas en `backend/README.md`)
- Alertas en DynamoDB en vez de RDS (RDS cobra por hora).
- Ingesta con clave compartida (`x-induplac-key`) en vez de IAM: el Learner Lab no permite crear usuarios ni roles.
- El dashboard en la nube usa el **login simulado** (`VITE_AUTH=simulada`); la API de consulta aún no valida el token. **Cognito es el siguiente paso** (tarea 6).
- El dashboard en S3 es público (datos ficticios); con Cognito quedará protegido.

### Pendientes
- [ ] Probar Cognito en el Learner Lab y conectar el dashboard (`VITE_AUTH=cognito`).
- [ ] Validar el token de Cognito en la Lambda de consulta.
- [ ] Antes de la demo: Start Lab y probar `/health`; verificar si la API responde con el lab detenido.
- [ ] El Edge real (tarea 4) debe mandar el mismo formato de ingesta que el simulador.

---

## 2026-10-18 — Broker MQTT (EMQX Serverless) creado y probado

- Broker `induplac-broker` en EMQX Serverless (North America / us-east-1), **spend limit 0**. Solo TLS: 8883 (MQTT) y 8084 (WebSocket).
- Cuatro usuarios, uno por dispositivo: `esp32-local1`, `esp32-local2`, `edge-local1`, `edge-local2`. Contraseñas fuera del repo.
- Prueba con MQTTX Web: `esp32-local1` publica en `induplac/local1/telemetria` y `edge-local1` (suscrito a `induplac/#`, QoS 1) lo recibe. ✅
- **Lección 1:** el topic pegado tenía **espacios**: el broker recibía el mensaje pero no calzaba con ninguna suscripción y se perdía sin error. Topics como constantes en el código.
- **Lección 2:** dos clientes con el mismo Client ID se desconectan entre sí y el primero pierde sus suscripciones sin aviso. Cada dispositivo debe tener su propio Client ID.
- Datos de conexión, topics y formato en el nuevo `docs/broker-mqtt.md`. La tarea 3 (Wokwi, Sebastián) queda desbloqueada.

---

## 2026-10-18 — README principal actualizado al diseño vigente (tarea 7)

- §14: Wokwi ya no es "propuesta"; broker EMQX, topics y formato de telemetría vigente (`device_id + seq`).
- §15: arquitectura con intervalos de 15 min, alertas en dos niveles, servicios reales de AWS (API Gateway, Lambda, DynamoDB, S3) y VPN como diseño.
- §8: umbrales de agua definidos y respaldo fijo de energía. §16: login, clave temporal, permisos por usuario y MFA.
- §17, §18, §21, §22 y §25: estructura, tecnologías con su estado, alcance, roadmap y estado actual.

---

## 2026-10-18 (noche) — Roles, RACI y Carta Gantt de Bárbara (tareas 9, 10 y 14)

- Bárbara Saavedra hizo el Excel con roles, tareas por integrante, RACI y Carta Gantt; lo subió Abraham porque ella no sabía cómo hacer el commit.
- Original en `docs/nota-2/Induplac_Roles_Equipo.xlsx` y copia en texto en `docs/roles-raci-gantt.md`.
- Corregido según lo que está en GitHub: responsables de lo ya construido (broker, dashboard, Edge, backend), RACI de 19 a 10 actividades (la pauta pide 6–10), Gantt en dos partes (sprints del MVP S1–S3 desde el 05/10 + implementación PMI S4–S12 hasta la puesta en marcha), términos del Edge alineados con el código, sin RDS y con columna de fortalezas.
- Falta: que cada uno escriba su fortaleza y que Lisandra y Bárbara confirmen sus roles (§5 del documento).

---

## 2026-10-19 — RDS vuelve al MVP con uso puntual

- **Decisión (Abraham):** se implementa **RDS PostgreSQL** (antes había quedado fuera del MVP por costo). Se mantiene **apagado** y se enciende para configurar y para la demo; después, solo cuando haya que hacer configuraciones.
- **Reparto de datos:**
  - **DynamoDB** (sin cambios): intervalos de 15 min y **alertas**. Siempre encendido: la ingesta y las alertas no dependen de RDS.
  - **RDS PostgreSQL:** solo configuración: permisos por usuario (enlazados al `sub` de Cognito), umbrales por local y catálogo de locales y dispositivos.
  - **Cognito:** cuentas, claves temporales y MFA.
- **Cuidados:** AWS reinicia sola una instancia RDS detenida a los **7 días** (apagarla de nuevo); el almacenamiento se cobra aunque esté apagada; sin NAT Gateway.
- Roles, RACI y Gantt actualizados con RDS en el PR #15 (Bárbara).

---

## 2026-10-20 (noche) — Backend en AWS completo: Cognito, RDS y Lambda de configuración

Sesión de Abraham y Felipe en el Learner Lab de Felipe.

**1. Lambda `induplac-api` actualizada**
- Re-deploy con el código de `feature/backend-aws`: la ingesta acepta las **alertas generadas por el Edge** (`origen = edge`, sin duplicar). `/health` OK.

**2. Prueba de punta a punta** ✅
- `simular_esp32.py` → broker EMQX → `edge_gateway.py` (SQLite) → API Gateway → Lambda → DynamoDB.
- El Edge pasó de 🔴 OFFLINE a 🟡 SINCRONIZANDO a 🟢 ONLINE; a las 22:30 cerró el intervalo de 22:15 (134 lecturas por local) y lo sincronizó con `pendientes=0`.
- De noche el UV marca 0,0 (el simulador sigue la hora real); para la demo, inyectar UV alto.

**3. Cognito con MFA** ✅ (tarea 6)
- **Funciona en el Learner Lab.** User pool con app client `induplac-dashboard` (SPA), **sin auto-registro** (solo el administrador crea cuentas).
- MFA solo con **app autenticadora** (TOTP, Microsoft Authenticator); SMS no disponible en el Learner Lab (el aviso de `AccessDenied` de SMS en la consola no afecta).
- Probado con el login administrado de Cognito: `jefe.prueba` (clave temporal → cambio obligatorio) y `admin.prueba` (clave temporal → cambio → **QR de MFA** → código de 6 dígitos). MFA quedó en **Require**.
- **Pendiente:** conectar el dashboard a Cognito (hoy usa su login propio con clave temporal y MFA TOTP). No se hizo antes de la demo para no arriesgar el login.

**4. RDS PostgreSQL** ✅
- `induplac-db`: PostgreSQL 18, `db.t3.micro`, Single-AZ, 20 GB sin autoescalado, **cifrado** (KMS `aws/rds`), sin backups automáticos, base `induplac`.
- Tablas creadas con `backend/scripts/crear_tablas_rds.py`: `locales` (2), `dispositivos` (4), `umbrales` (5, valores de `CONTEXTO.md` §8.2) y `permisos_usuario` (2; los `cognito_sub` son de ejemplo y se reemplazan al integrar Cognito).
- Para crear las tablas desde el PC hubo que abrir temporalmente la regla a `0.0.0.0/0` (la IP de Abraham no funcionó, probablemente por CGNAT del proveedor). **Se cerró apenas terminó.**
- **Security group final:** una sola regla de entrada, PostgreSQL desde el security group de la Lambda. La base solo es alcanzable desde el backend.

**5. Lambda `induplac-config`** ✅ (`backend/lambda_config/`)
- Lambda aparte, **dentro de la VPC**, que lee umbrales y catálogo desde RDS. `induplac-api` no se tocó.
- Ruta `GET /config/{proxy+}` en API Gateway. `GET /config/umbrales` responde `{"fuente": "rds", ...}`.

**6. Wokwi de Sebastián conectado** ✅ (tarea 3, `simulation/wokwi-local1/`)
- Cadena probada: **Wokwi → EMQX → Edge**. Las lecturas de `esp32-local-01` llegan al Edge con energía, agua y UV.
- Con el lab apagado (enlace OFFLINE), el Edge generó **alertas locales con datos de Wokwi**: *posible fuga* (caudal fuera de horario) y *energía sobre 55 kW*. Los intervalos y alertas quedaron en cola (`pendientes=7`) para subir al volver AWS.
- Botones arreglados: el `delay(200)` del debounce bloqueaba `mqttClient.loop()`; ahora es por flanco con `millis()`.
- Wokwi simuló lento por momentos (≈ 1 lectura cada 25 s en vez de 5 s; luego 83 lecturas por intervalo). No afecta: el `ts` viene de NTP.
- El Edge ahora muestra el caudal de agua en el log de cada lectura (rama `feature/edge`).
- **Decisión (Abraham):** los rangos de los potenciómetros se mantienen (0–250 kW, 0–50 m³/h); lo importante para la demo es que se generen las alertas, y se logra con las perillas bajas.

### Siguen abiertos
- [ ] Conectar el dashboard a Cognito y validar el token en la API.
- [ ] Reemplazar los `cognito_sub` de ejemplo por los reales.
- [ ] Que `induplac-api` lea los umbrales desde RDS (con valores por defecto si RDS está apagado).
- [ ] Mergear a `main` las ramas `feature/edge`, `feature/backend-aws` y `feature/dashboard`.
- [ ] Apagar RDS después de la demo del 21/10.

---

## 2026-10-21 (madrugada) — Revisión de la Nota 2 para Bárbara

Abraham pidió que el 21/10 **Bárbara**, en su conversación con Claude, revise lo que falta de la Nota 2 y si sus documentos necesitan actualizarse con lo hecho el 20/10 (PR #16 a #23). Esta lista es el punto de partida.

### Qué cambió desde que Bárbara escribió sus documentos
- **Reparto de datos:** alertas en **DynamoDB**, cuentas y MFA en **Cognito**, **RDS solo configuración** (permisos, umbrales y catálogo). Ya corregido en todos los documentos (PR #17 y #19).
- **Funcionando:** Wokwi → EMQX → Edge → AWS de punta a punta; RDS con sus tablas y Lambda `induplac-config`; Cognito con MFA probado en el Learner Lab. El login del dashboard con Cognito está en el **PR #20** (falta probarlo con Felipe).
- **Pipeline DevOps** (entregable 8) listo: `docs/devops.md` + GitHub Actions con 15 pruebas del Edge (PR #21).
- **Product Owner:** Abraham · **Scrum Master:** Bárbara · **fortalezas** escritas, salvo la de Lisandra (PR #22).
- **README** al día con cómo probar el prototipo y el índice de documentos (PR #23).

### Revisar en sus documentos (sugerencias)
- [ ] `cloud-tecnologias.md`: DynamoDB guarda **intervalos y alertas** (hoy dice solo intervalos); agregar **GitHub Actions** (CI/CD) y la **Lambda `induplac-config`**; marcar **Nginx en el Edge** como diseño (en la demo el dashboard corre en el PC y en S3); ajustar Cognito según el PR #20.
- [ ] `scrum-pmi.md` §1 *Herramientas de seguimiento*: agregar el **CI** (checks automáticos en cada PR). Sigue pendiente si hubo reuniones fijas.
- [ ] `roles-raci-gantt.md` + Excel: agregar la tarea **Pipeline DevOps** (Abraham, Listo, PR #21) en *Tareas por integrante*; ver si la RACI nombra el pipeline (podría ir en la actividad 10); actualizar Cognito cuando se pruebe el PR #20; **fortaleza, rol y tareas de Lisandra** después de hablar con ella.
- [ ] `conclusiones.md`: si Cognito queda conectado hoy, quitar esa limitación y ese siguiente paso; se puede sumar como beneficio que las reglas de alerta se prueban solas en cada PR.

### Lo que falta de la Nota 2
- [ ] **Guion de la demo** (tarea 18): orden, tiempos y quién muestra cada parte. Base: README §20 *Pruebas de demostración*.
- [ ] **PowerPoint** (tarea 17), en el orden de la pauta (`NOTA-2.md`).
- [ ] **Informe** (tarea 16): confirmar el formato con el profe.
- [ ] **Fortaleza de Lisandra.**

