# 🎬 Guion y ensayo de la demo en vivo — Nota 3

> **Tarea 18** · Responsable: Bárbara Saavedra (Scrum Master) · Se ensaya el **martes 24/11** y se presenta el **miércoles 25/11**.
> Sale de lo que pide la pauta ([`nota-3.md`](../nota-3.md) §1), del guion base de la [Guía del equipo](../GUIA-EQUIPO.md) §15 y de las pruebas del [README](../../README.md) §20.

## 1. Qué tiene que demostrar

La pauta pide ver **el flujo completo funcionando**, no capturas:

```text
Wokwi (ESP32) ─► MQTT ─► Edge (gateway) ─► API REST ─► backend (Lambda) ─► DynamoDB ─► reglas/alertas ─► consulta ─► dashboard
```

Y lo que nos diferencia: **el sistema aguanta sin internet**. Si en la demo solo se alcanza a mostrar una cosa, que sea el **corte y la reconexión sin perder ni duplicar datos** (pasos 6 y 7).

**Duración:** unos **6 minutos** dentro de los 15 de la presentación. Va después de los criterios 3 y 4 (API y backend), así lo que se explicó en las diapositivas se ve funcionando.

## 2. Quién hace qué

Igual que en la demo del 21/10 (cada uno maneja la parte que conoce). **Confirmar en el grupo.**

| Rol | Qué maneja | Sugerido |
|---|---|---|
| **Narrador/a** | Habla y dice a quién le toca. Nadie más habla mientras el otro opera | A definir |
| **Wokwi** | Las perillas del ESP32. Plan B: `simular_esp32.py` | Sebastián |
| **Edge** | La consola del Edge y el dashboard de planta (panel 🎬 Demo) | Abraham |
| **AWS** | Learner Lab, consola de DynamoDB, `curl`, dashboard de gerencia en S3 | Felipe |
| **Reloj** | Avisa con la mano a los 5 min. Toma nota de lo que falló para el ensayo | Lisandra o Bárbara |

> 💡 Que **una sola persona tenga el computador conectado al proyector**, con todas las pestañas abiertas en el orden del guion. Cambiar de computador en vivo es lo que más tiempo hace perder.

## 3. Antes de empezar

### El día antes (martes 24/11, en el ensayo)

- [ ] Ensayar el guion completo **con cronómetro**, dos veces.
- [ ] Grabar el segundo ensayo: sirve de **grabación de respaldo** (es un entregable) y de **plan C** si el día 25 falla todo.
- [ ] Revisar que entra la **cuenta de Abraham** (*admin general*, pide MFA: tener su celular con Microsoft Authenticator a mano). Si se va a mostrar el paso opcional de roles, revisar también la cuenta de **Lisandra** (*operaria* de Planta).
- [ ] Dejar escritos en un `.txt` los comandos `curl` del paso 3, para copiar y pegar.

### 30 minutos antes (miércoles 25/11)

| # | Qué | Quién | Cómo se sabe que está bien |
|---|---|---|---|
| 1 | **Start Lab** en el Learner Lab y encender **RDS** | AWS | RDS en *Available*; `curl.exe <API>/health` responde `{"ok": true}` |
| 2 | Edge con **`DEMO=1`** en `edge/.env` y corriendo (`py edge_gateway.py`) | Edge | La consola dice `demo ON` y `Conectado al broker` |
| 3 | Wokwi en **Play** con las perillas en valores normales (energía ~15 %, agua ~2 %, UV bajo) | Wokwi | La consola del Edge muestra `local1: lectura seq=…` |
| 4 | Abrir el **dashboard de planta** (`http://localhost:8080`) y el **de gerencia** (link de S3), con sesión iniciada | Edge / AWS | Las dos en 🟢 **En vivo** |
| 5 | Pestañas en orden: Wokwi · consola del Edge · dashboard planta · dashboard gerencia · DynamoDB (`induplac-intervalos`) · terminal con los `curl` | Quien proyecta | — |
| 6 | Letra grande: zoom del navegador al 125 % y fuente de la terminal en 18 o más | Quien proyecta | Se lee desde el fondo de la sala |
| 7 | Celular en silencio, notificaciones del computador apagadas | Todos | — |

> ⚠️ **La alerta de "posible fuga" no se puede mostrar en clases:** esa regla solo alerta entre las 22:00 y las 06:00 o el fin de semana, y la presentación es un miércoles en la tarde. Para la demo se usan **UV** y **sobreconsumo eléctrico**, que alertan a cualquier hora. Si preguntan por la fuga, se explica la regla (y que está probada en el CI).

## 4. El guion, paso a paso

Los tiempos son **acumulados**. Lo que va entre comillas es una sugerencia de qué decir; no hay que aprenderlo de memoria.

### Paso 1 · Los sensores envían datos (0:00 – 0:45) · Wokwi

- **Se hace:** mostrar el ESP32 en Wokwi y mover un poco la perilla de energía.
- **Se dice:** "Este es el ESP32 de la planta, simulado en Wokwi. Lee energía, agua y UV cada 5 segundos y los publica por **MQTT cifrado** (puerto 8883) al broker."
- **Se tiene que ver:** la pantalla OLED cambiando.

### Paso 2 · El Edge recibe y valida (0:45 – 1:30) · Edge

- **Se hace:** pasar a la consola del Edge.
- **Se dice:** "En la demo el Edge corre en este PC; en la planta real sería una Raspberry Pi. Recibe cada lectura, **revisa que esté en rango** (por ejemplo, energía entre 0 y 250 kW) y la guarda en **SQLite**. Cada 15 minutos arma un resumen y lo sube a AWS."
- **Se tiene que ver:** líneas `local1: lectura seq=… · … kW · UV …`.

### Paso 3 · La API REST: envío y consulta (1:30 – 2:45) · AWS

Las dos operaciones que pide el criterio 3. Los comandos exactos los deja listos la **tarea 34** (API REST).

- **Envío:** "El Edge le habla a la nube por una **API REST**. Para enviar, usa `POST /intervalos` con una clave en la cabecera." Se corre el `curl` de envío **con la clave en una variable** (`$env:CLAVE_INGESTA`), **nunca escrita en pantalla**.
- **Se ve que quedó guardado:** abrir DynamoDB → `induplac-intervalos` → el registro con ese `inicio_intervalo`. "La **Lambda** lo validó, evaluó las reglas de alerta y lo guardó. Si lo mandamos dos veces, **no se duplica**: la llave es sede + hora del intervalo."
- **Consulta:** en el dashboard de gerencia, **F12 → Red (Network)** y recargar. "Para consultar, el dashboard hace `GET /api/...` con el **token de Cognito**. Sin token responde 401, y cada usuario solo recibe su sede."
- ⚠️ **No abrir** la cabecera `Authorization` en pantalla: tiene el token.

### Paso 4 · Una alerta en vivo (2:45 – 3:30) · Wokwi + Edge

- **Se hace:** subir la perilla de **UV** sobre ~55 % (UV ≥ 8).
- **Se dice:** "Supongamos que sube la radiación UV. Sobre 8 es riesgo para el personal que trabaja afuera."
- **Se tiene que ver:** en la consola `🚨 ALERTA local1: UV mayor o igual a 8`, y la campana 🔔 del dashboard con la alerta.
- Volver la perilla de UV a bajo.

### Paso 5 · Se corta internet (3:30 – 4:30) · Edge

- **Se hace:** en el dashboard de planta, panel **🎬 Demo** → **Cortar internet** en Planta.
- **Se dice:** "Ahora se cae la conexión de la planta con AWS. Ojo: cortamos **solo** el enlace con la nube, la red de la planta sigue funcionando."
- **Se tiene que ver:** el indicador pasa a 🔴 **Sin internet**, pero **los datos siguen llegando** al dashboard de planta.
- **Se hace:** en el mismo panel, **Sobreconsumo** (60 kW).
- **Se dice:** "Y aunque no hay internet, **la alerta aparece igual**, porque la genera el Edge en la misma planta. Fíjense en los **pendientes**: son los resúmenes que esperan para subir."

### Paso 6 · Vuelve internet (4:30 – 5:30) · Edge + AWS

- **Se hace:** **Restablecer internet**.
- **Se dice:** "Vuelve la conexión. El Edge sube lo pendiente en lotes de 50."
- **Se tiene que ver:** 🟡 **Sincronizando**, los pendientes bajando, y luego 🟢 **En vivo**.
- **Se hace:** en el dashboard de **gerencia**, abrir **Alertas**.
- **Se dice:** "En la nube aparece la alerta de sobreconsumo que se generó sin internet, **una sola vez**. No se perdió ningún dato y nada se duplicó."

### Paso 7 · Cierre (5:30 – 6:00) · Narrador/a

- **Se dice:** "En resumen: el dato nace en el sensor, pasa por el Edge, llega a la nube por la API REST, la Lambda lo procesa y guarda, y el dashboard lo consulta con token y según el rol. Y si se corta internet, la planta sigue funcionando y después se pone al día sola."

### Si sobra tiempo (opcional, en este orden)

1. **Roles:** la demo se hace con la cuenta de **Abraham** (*admin general*, con MFA). Si hay tiempo, entrar con la de **Lisandra** (*operaria* de Planta) para mostrar que no ve Histórico ni Umbrales.
2. **Estado de las sedes:** último dato, pendientes y si RDS está encendido. Es nuestro monitoreo (etapa 8 del pipeline).
3. **Auditoría:** quién cambió qué y desde dónde.

> El **pipeline** (PR con los 6 controles en verde) y **Ansible** (`changed=0`) **no van en la demo**: se muestran con capturas en las diapositivas del criterio 2. Así la demo no depende de las EC2.

## 5. Si algo falla (plan B)

La regla: **no arreglar en vivo más de 30 segundos.** Se dice "pasamos al plan B" con calma y se sigue.

| Si falla… | Plan B | Quién |
|---|---|---|
| Wokwi no envía o va muy lento (se ha visto ~1 lectura cada 25 s) | Detener Wokwi y correr `py simular_esp32.py`. **Nunca los dos a la vez**: usan el mismo `device_id` | Wokwi |
| La alerta UV no sale con la perilla | `py simular_esp32.py --uv 9.5`, o el botón **UV alto** del panel 🎬 Demo | Wokwi / Edge |
| El panel 🎬 Demo responde 404 | Falta `DEMO=1` en `edge/.env`: ponerlo y reiniciar el Edge (≈ 20 s) | Edge |
| AWS no responde (lab apagado o credenciales vencidas, duran ~4 h) | Hacer *Start Lab*. Mientras tanto, seguir con el dashboard de planta: el Edge queda OFFLINE y **eso mismo es la demo del paso 5** | AWS |
| No entra el login (MFA, clave) | Revisar la hora del celular (el código MFA depende de ella) y reintentar. Si no entra, mostrar el dashboard de planta (login de planta, sin Cognito) | Edge |
| Se cae todo | Poner la **grabación del ensayo** del 24/11 y narrarla en vivo | Narrador/a |

## 6. Ensayo del martes 24/11

| Hora sugerida | Qué |
|---|---|
| Inicio | Preparar todo con la lista de "30 minutos antes" y **medir cuánto se demora** de verdad |
| Ensayo 1 | Guion completo con cronómetro. El de reloj anota qué falló y en qué minuto |
| Ajustes | Corregir lo anotado (y este documento, si algo cambió) |
| Ensayo 2 | Guion completo **grabado**. Esa es la grabación de respaldo |
| Cierre | Ensayar **un plan B a propósito** (por ejemplo, detener Wokwi y pasar al simulador) para que no sea la primera vez el 25 |

**Al terminar el ensayo** se marca la tarea 18 como ✅ en [`EN-CURSO.md`](../EN-CURSO.md) con una línea en [`notas-de-avance.md`](../notas-de-avance.md) sobre cómo salió.

## 7. Preguntas que pueden hacer durante la demo

Las respuestas completas están en la [Guía del equipo](../GUIA-EQUIPO.md) §17. Las más probables justo después de la demo:

| Pregunta | Respuesta corta |
|---|---|
| ¿Cómo sabe el Edge que se cayó internet? | Pregunta a AWS cada **10 s**; con **3 fallas seguidas** pasa a OFFLINE |
| ¿Por qué no se duplican los datos al reconectar? | Cada resumen tiene una llave única (sede + hora del intervalo). Si llega dos veces, se **sobrescribe** en vez de agregarse |
| ¿Y las alertas, tampoco se duplican? | No: la alerta tiene el id `sede:variable:intervalo`, el mismo en el Edge y en la Lambda |
| ¿Cuánto aguanta sin internet? | La Pi guarda los pendientes **hasta subirlos**; las lecturas crudas, 30 días. Si cae la Pi, el ESP32 guarda ~1.500 lecturas (~2 horas) |
| ¿Esto es real o simulado? | Los sensores son simulados (Wokwi), pero el broker, el Edge, la API, la Lambda y las bases de datos son **reales** y corren en AWS |
