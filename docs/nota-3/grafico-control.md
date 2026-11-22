# 📊 Gráfico de control — Consumo energético Planta

> **Autor:** Sebastián Fuentes. Tarea 42 de [`EN-CURSO.md`](../EN-CURSO.md) · criterio 8 de la pauta ([`nota-3.md`](../nota-3.md), herramientas de calidad, IL 4.6, 15 %).
> Basado en la lógica de simulación de `edge/simular_esp32.py` y en la regla de alerta por consumo de `edge/reglas.py`. Estado al **22/11/2026**.

**En resumen:** un gráfico de control es una herramienta SPC (Control Estadístico de Procesos) que distingue la variación normal de un proceso de los eventos que tienen una causa especial y merecen atención. Lo usamos para visualizar el consumo eléctrico de la Planta durante un turno de día, comprobar que el comportamiento habitual es estable y confirmar que los dos picos simulados a propósito —que superan el umbral del +20 % que usa el Edge para lanzar una alerta— se detectan correctamente como puntos fuera de control.

---

## 1. Qué es y por qué lo usamos

Un **gráfico de control** (o carta de control) traza una serie de mediciones en el tiempo junto a tres líneas de referencia:

- **x̄ (línea central):** el promedio del proceso cuando está bajo control.
- **UCL** (*Upper Control Limit*): límite superior = x̄ + 3σ.
- **LCL** (*Lower Control Limit*): límite inferior = x̄ − 3σ.

Un punto dentro de los límites indica **variación común**: el proceso funciona con normalidad. Un punto fuera indica **causa asignable**: algo externo al proceso normal ocurrió y requiere investigación.

Lo elegimos para Induplac porque:

1. El consumo eléctrico de la Planta tiene una variación natural (máquinas encendiéndose en distintos momentos, temperatura ambiente, número de operarios). Sin una referencia estadística, es difícil saber cuándo un consumo alto es normal y cuándo es una anomalía real.
2. La regla de alerta que ya tiene el Edge (`energía actual > promedio histórico × 1.20`) es, en esencia, un umbral de control operacional. El gráfico de control le pone un respaldo estadístico: **muestra que los dos eventos que disparan la alerta también superan el UCL calculado con los datos del turno**.
3. Es una herramienta de calidad concreta y trazable, diferente del Ishikawa (que ordena causas) y del plan de pruebas (que verifica el software): aquí medimos la **estabilidad del proceso físico** que el sistema monitorea.

## 2. Cómo lo hicimos

### 2.1 Generación de los datos

No tenemos sensores físicos en el Learner Lab, así que usamos la misma lógica que `edge/simular_esp32.py` para generar **25 lecturas ficticias** de energía de la Planta (`local1`) en un turno de día:

- **Base:** 38 kW ± 8 % (rango normal de operación diurna según el simulador).
- **Intervalo:** cada lectura representa un intervalo de 15 minutos (el intervalo de agregación del Edge).
- **Picos simulados:** dos lecturas se fijaron a propósito en **48.72 kW** (lectura 8) y **47.95 kW** (lectura 19) para representar un arranque simultáneo de equipos de alto consumo, el tipo de evento que en Induplac activa la alerta de energía.

Los datos son completamente ficticios. Ningún dato pertenece a trabajadores ni a la empresa real (Ley 19.628).

### 2.2 Cálculo de los límites (Fase I de SPC)

En un análisis de Fase I se establece el proceso de referencia con los datos "bajo control" y luego se verifican todos los puntos contra esos límites. Seguimos ese procedimiento:

1. Se tomaron las **23 lecturas normales** (sin los dos picos conocidos) para calcular x̄ y σ.
2. Se calcularon UCL y LCL con esas 23 lecturas.
3. Se graficaron las **25 lecturas** (incluidos los picos) para ver qué puntos quedan fuera.

| Parámetro | Valor |
|---|---|
| n (lecturas base) | 23 |
| **x̄** (promedio base) | **37.56 kW** |
| σ (desviación estándar) | 1.81 kW |
| **UCL** = x̄ + 3σ | **42.99 kW** |
| **LCL** = x̄ − 3σ | **32.13 kW** |
| Puntos fuera de control | lecturas **8** y **19** |

### 2.3 El gráfico

![Gráfico de control — Consumo energético Planta](img/grafico-control.png)

El gráfico muestra:

- La **zona verde pálida** entre LCL y UCL: variación normal del proceso.
- Los **puntos azules**: lecturas dentro de control.
- Los **rombos rojos** (lecturas 8 y 19): puntos fuera del UCL, con su valor anotado.
- Las tres líneas de referencia con sus valores al margen derecho.

## 3. Qué nos muestra

El consumo de la Planta en turno de día es **estable**: 23 de 25 lecturas se mantienen entre 32 y 43 kW con poca variación (σ = 1.81 kW). Esa estabilidad confirma que el promedio histórico que usa el Edge como base para la alerta es representativo del comportamiento normal.

Las lecturas 8 (48.72 kW) y 19 (47.95 kW) **superan el UCL** y están a **+29.7 %** y **+27.7 %** sobre el promedio base, respectivamente. Ambas superan también el umbral del +20 % de la regla de alerta del Edge. Esto significa que:

> **El gráfico de control y la regla de alerta del sistema son consistentes:** un evento que el SPC clasifica como causa asignable también dispara la alerta en Induplac.

## 4. Conexión con la alerta de energía del Edge (+20 %)

La regla en `edge/reglas.py` lanza una alerta cuando:

```
energia_actual > promedio_historico × 1.20
```

Con el promedio base de 37.56 kW, el umbral operacional queda en **45.07 kW**. Los dos picos (48.72 y 47.95 kW) superan ese umbral, es decir, el Edge habría lanzado la alerta en ambos intervalos.

La relación entre las dos herramientas es complementaria:

| Herramienta | Qué detecta | Límite |
|---|---|---|
| Alerta del Edge (+20 %) | Consumo excesivo en tiempo real | 45.07 kW (dinámico, cambia con la historia) |
| Gráfico de control (UCL) | Punto estadísticamente anómalo | 42.99 kW (calculado con 3σ del turno) |

El UCL estadístico es más exigente que el umbral operacional en este conjunto de datos, lo que da una buena señal: **la alerta del Edge no es demasiado sensible** (no dispararía con la variación normal del proceso) y **sí captura los eventos que el SPC también marca como anómalos**.

> ⚠️ El umbral fijo de respaldo de 45 kW (usado cuando no hay historia) también habría capturado los dos picos. Esto confirma que el diseño del Edge es consistente con el comportamiento estadístico real del proceso.

## 5. Para la presentación (1 diapositiva)

- El gráfico de la sección 2.3 y, al lado, una tabla de tres filas: **x̄ = 37.56 kW · UCL = 42.99 kW · 2 puntos fuera de control**.
- **Frase para decir:** *"No lo hicimos de adorno: lo generamos con los mismos datos simulados que usa el Edge, calculamos los límites estadísticamente y vimos que las dos lecturas altas que el sistema alertó también salen del UCL. El gráfico de control y la alerta del +20 % son consistentes."*

### Preguntas probables

| Pregunta | Respuesta corta |
|---|---|
| ¿Por qué Fase I y no Fase II? | En Fase I se establece la línea base. Fase II sería monitoreo continuo, que en producción haría el Edge automáticamente con los datos reales. |
| ¿Por qué los límites son distintos al umbral del Edge? | El UCL se calcula con σ de los datos del turno; el umbral del Edge usa el promedio histórico × 1.20. Son complementarios: uno es estadístico, el otro es operacional. |
| ¿Qué pasa si el promedio sube por estacionalidad? | El Edge recalcula su promedio con las últimas 4 semanas. En SPC se haría un nuevo análisis de Fase I con los datos del nuevo período. |
| ¿Los datos son reales? | No. Son ficticios, generados con `edge/simular_esp32.py`. Los datos y sistemas reales de Induplac no se usan (Ley 19.628). |
