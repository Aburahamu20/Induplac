# 📝 Notas de Avance — Induplac IoT

> Bitácora de sesiones de trabajo: observaciones, decisiones e ideas en evaluación.  
> Complementa a `docs/CONTEXTO.md`. Lo marcado como **idea** todavía no es decisión del equipo.

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
- [ ] **Failover del dashboard:** un dashboard servido desde la nube por HTTPS no puede llamar a `http://192.168.10.10:8000` (mixed content) y sin internet ni siquiera carga. Propuesta: la Raspberry Pi sirve el dashboard en planta; la nube es la vista consolidada.
- [ ] **Wokwi + broker local:** el ESP32 en Wokwi web sale por `Wokwi-GUEST` y no alcanza un Mosquitto en la LAN sin el gateway privado de Wokwi. Esto inclina la decisión pendiente #3 hacia **HiveMQ Cloud** (o broker público) para la demo.
- [ ] **Dominio `api.induplac.aws`:** `.aws` es un TLD de Amazon, no utilizable. Reemplazar por la URL real de API Gateway o un placeholder.
- [ ] **Normativa:** evaluar mencionar la **Ley 21.719** (nueva ley de protección de datos que reemplaza a la 19.628). Confirmar fecha de entrada en vigencia antes de citarla.

### 2. Ideas en evaluación — Históricos (estacionadas)

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

### 3. Próximo paso
- Definir con el equipo qué sigue: Paso 1 del roadmap (Dashboard React) o diseño de históricos.
