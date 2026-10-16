# 🔌 Contrato de Datos del Dashboard — Induplac IoT

> **Estado:** PROPUESTA (2026-10-16) — pendiente de revisión del equipo (PR de la tarea 19 en `docs/EN-CURSO.md`). Comentarios y cambios, en el PR.
> **Para qué sirve:** definir qué le pide el dashboard a la API y qué JSON recibe. Si el **Edge** (tarea 4) y el **backend AWS** (tarea 5) respetan este contrato, el **mismo build** del dashboard funciona con los dos sin cambios.
> **Relacionado:** `docs/CONTEXTO.md` (§4.3, §8.2, §8.3), `docs/modo-offline.md` (§6), `docs/decisiones-tecnicas.md` (ADR-07, ADR-08).

---

## 1. Quién implementa esta API

| Implementación | Dónde corre | URL base | Ve qué locales | Login |
| :--- | :--- | :--- | :--- | :--- |
| **API local del Edge** | Raspberry Pi de cada sede | `/api` (ruta relativa, mismo origen que el dashboard) | Solo su propio local | Login local (siempre, §6) |
| **API de consulta AWS** | API Gateway + Lambda | `https://<id>.execute-api.<región>.amazonaws.com/<stage>/api` | Según los locales y permisos del usuario (§6.4) | Cognito (JWT), MFA para permisos de modificación |
| **Fuente simulada** | Dentro del navegador | — | Ambos | No |

El dashboard elige la fuente con variables de entorno de Vite:

```bash
VITE_FUENTE=simulada        # simulada | api
VITE_API_URL=/api           # en planta: /api · en la nube: URL de API Gateway
```

> La **vista General** (ambas sedes) solo existe en la nube. En planta, el dashboard muestra únicamente el local de esa Raspberry Pi.

---

## 2. Convenciones

- **Formato:** JSON, campos en `snake_case`.
- **Fechas:** ISO 8601 en **UTC** (`"2026-10-16T23:15:00Z"`). El dashboard las muestra en `America/Santiago`.
- **Números:** siempre `number`, nunca texto. Unidades fijas por variable (ver §4).
- **Identificadores de local:** `"local1"` (planta) y `"local2"` (oficinas).
- **Niveles:** `"normal"` · `"advertencia"` · `"critico"` → verde · amarillo · rojo.
- **El nivel lo calcula la API, no el dashboard.** Las reglas de alerta viven en el Edge y en Lambda (ADR-06); el dashboard solo pinta. Así no hay una tercera copia de las reglas.
- **Actualización:** el MVP usa *polling* (sin WebSockets):
  - `/estado`, `/locales/{id}/actual` y `/alertas`: cada **5 s**.
  - `/historico`: al cambiar de vista o de filtros.

### Errores

Cualquier error devuelve el código HTTP correspondiente y este cuerpo:

```json
{ "error": { "codigo": "LOCAL_NO_PERMITIDO", "mensaje": "El rol Operario solo puede ver su propia sede." } }
```

| HTTP | Cuándo |
| :--- | :--- |
| 400 | Parámetros inválidos (fecha mal formada, variable inexistente) |
| 401 | Falta login o el token expiró |
| 403 | El usuario no tiene el permiso o el local (ej. un Operario pidiendo el otro local) |
| 404 | Local o alerta inexistente |
| 503 | La fuente de datos no responde (ej. RDS apagado) |

---

## 3. Endpoints

### 3.1. `GET /api/estado` — Estado del enlace

Alimenta el badge 🟢 / 🔴 / 🟡.

```json
{
  "origen": "edge",
  "hora_servidor": "2026-10-16T23:15:04Z",
  "locales": [
    {
      "local_id": "local1",
      "enlace": "sincronizando",
      "pendientes": 12,
      "ultima_sincronizacion": "2026-10-16T22:40:00Z",
      "ultimo_dato": "2026-10-16T23:15:00Z"
    }
  ]
}
```

| Campo | Valores | Notas |
| :--- | :--- | :--- |
| `origen` | `"edge"` · `"nube"` | Permite al dashboard saber dónde está corriendo. |
| `enlace` | `"online"` · `"offline"` · `"sincronizando"` | En el Edge sale de su máquina de estados (`modo-offline.md` §6). En la nube, un local está `offline` si su `ultimo_dato` tiene más de 30 min. |
| `pendientes` | entero ≥ 0 | Intervalos + alertas con `is_synced = 0`. En la nube va en `0`. |

### 3.2. `GET /api/locales` — Catálogo

```json
[
  {
    "local_id": "local1",
    "nombre": "Local 1 · Planta",
    "variables": ["energia_kw", "agua_m3h", "agua_m3_dia", "uv_index", "produccion_mes", "produccion_anual", "hh_sin_incidentes"]
  },
  {
    "local_id": "local2",
    "nombre": "Local 2 · Oficinas",
    "variables": ["energia_kw", "energia_climatizacion_kw", "energia_iluminacion_kw", "agua_m3h", "agua_m3_dia", "hh_sin_incidentes"]
  }
]
```

El dashboard arma las tarjetas a partir de esta lista: si un local no tiene UV, no se dibuja la tarjeta de UV.

### 3.3. `GET /api/locales/{local_id}/actual` — Valores actuales

Alimenta las tarjetas KPI.

```json
{
  "local_id": "local1",
  "ts": "2026-10-16T23:15:00Z",
  "variables": [
    { "id": "energia_kw",        "valor": 48.2,  "referencia": 40.1, "nivel": "advertencia" },
    { "id": "agua_m3h",          "valor": 0.42,  "referencia": null, "nivel": "normal" },
    { "id": "agua_m3_dia",       "valor": 9.7,   "referencia": 10.0, "nivel": "normal" },
    { "id": "uv_index",          "valor": 8.3,   "referencia": null, "nivel": "critico" },
    { "id": "produccion_mes",    "valor": 312,   "referencia": null, "nivel": "normal" },
    { "id": "produccion_anual",  "valor": 3480,  "referencia": null, "nivel": "normal" },
    { "id": "hh_sin_incidentes", "valor": 1840,  "referencia": null, "nivel": "normal" }
  ]
}
```

- `valor`: última lectura (instantáneas) o acumulado del período (diarias, mensuales).
- `referencia`: el valor contra el que se compara (`null` si no aplica):
  - Energía: promedio de las últimas 4 semanas a la misma hora (o `null` mientras no haya 4 semanas de historia).
  - Agua diaria: consumo normal del local (§8.2).

### 3.4. `GET /api/alertas` — Alertas

Parámetros (todos opcionales): `local_id`, `estado` (`activa` · `reconocida` · `cerrada`), `desde`, `hasta`.

```json
[
  {
    "id": "local1:uv_index:2026-10-16T23:00:00Z",
    "local_id": "local1",
    "variable": "uv_index",
    "nivel": "critico",
    "valor": 8.3,
    "umbral": 8,
    "regla": "UV mayor o igual a 8",
    "inicio_intervalo": "2026-10-16T23:00:00Z",
    "estado": "activa",
    "origen": "edge",
    "reconocida_en": null
  }
]
```

- `id` = `local_id:variable:inicio_intervalo`: la misma llave natural que usan el Edge y Lambda para **no duplicar** alertas (CONTEXTO §4.5).
- `origen`: `"edge"` o `"lambda"`, para mostrar en la demo que la alerta nació offline.
- **No se guardan nombres ni RUT** de quien reconoce la alerta (Ley 19.628); solo la hora y, si se necesita, el rol.

### 3.5. `POST /api/alertas/{id}/reconocer` — Reconocer una alerta

- Requiere login y el permiso `reconocer_alertas` (§6.4).
- Funciona **también offline** en el Edge con login local (decisión 2026-10-14).
- Respuesta: la alerta actualizada (`estado: "reconocida"`, `reconocida_en` con la hora).

### 3.6. `GET /api/historico` — Series históricas

Parámetros:

| Parámetro | Obligatorio | Ejemplo |
| :--- | :---: | :--- |
| `local_id` | Sí | `local1` (en la nube se puede repetir para comparar sedes) |
| `variable` | Sí | `energia_kw` |
| `desde`, `hasta` | Sí | `2026-10-01T03:00:00Z` |
| `agrupacion` | No (por defecto `hora`) | `15min` · `hora` · `dia` · `mes` |

```json
{
  "variable": "energia_kw",
  "agrupacion": "hora",
  "series": [
    {
      "local_id": "local1",
      "puntos": [
        { "inicio": "2026-10-16T12:00:00Z", "promedio": 41.3, "maximo": 47.9, "total": null },
        { "inicio": "2026-10-16T13:00:00Z", "promedio": 44.0, "maximo": 52.1, "total": null }
      ]
    }
  ]
}
```

- `total` se usa en variables acumuladas (agua en m³, producción); `promedio` y `maximo` en instantáneas (kW, UV).
- Límite sugerido: máx. 2.000 puntos por serie (si se pide más, 400 con `RANGO_DEMASIADO_GRANDE`).
- En el Edge solo hay 13 meses de intervalos (`modo-offline.md` §5).

---

## 4. Variables y unidades

| `id` | Nombre en pantalla | Unidad | Local 1 | Local 2 | Tipo |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `energia_kw` | Energía (potencia actual) | kW | ✅ | ✅ | Instantánea |
| `energia_climatizacion_kw` | Climatización | kW | — | ✅ | Instantánea |
| `energia_iluminacion_kw` | Iluminación | kW | — | ✅ | Instantánea |
| `agua_m3h` | Caudal de agua | m³/h | ✅ | ✅ | Instantánea |
| `agua_m3_dia` | Agua consumida hoy | m³ | ✅ | ✅ | Acumulada del día |
| `uv_index` | Índice UV | UVI (1–12) | ✅ | — | Instantánea |
| `produccion_mes` | Tableros del mes | unidades | ✅ | — | Acumulada del mes |
| `produccion_anual` | Tableros del año | unidades | ✅ | — | Acumulada del año |
| `hh_sin_incidentes` | Horas hombre sin incidentes | h | ✅ | ✅ | Contador |

Umbrales y colores: `docs/CONTEXTO.md` §8.2.

---

## 5. Endpoints de demostración (solo si `DEMO=true`)

Para el panel del simulador de fallas (§8.1 de CONTEXTO). Solo existen en el Edge de la demo; **nunca** en producción.

| Endpoint | Cuerpo | Efecto |
| :--- | :--- | :--- |
| `POST /api/demo/enlace` | `{ "conectado": false }` | Corta (o restablece) la sincronización Edge → AWS. |
| `POST /api/demo/inyectar` | `{ "local_id": "local1", "variable": "uv_index", "valor": 9.5 }` | Inyecta una lectura para disparar una alerta en vivo. |

Con `VITE_FUENTE=simulada` el dashboard hace lo mismo en memoria, sin llamar a la API.

---

## 6. Autenticación

**Decisión (2026-10-16): para ver el dashboard siempre hay que iniciar sesión con usuario y contraseña, con o sin internet.** Ningún endpoint de datos responde sin token (401).

| Dónde | Cómo se inicia sesión | MFA |
| :--- | :--- | :--- |
| **Nube (AWS)** | Cognito. El dashboard usa el flujo de Cognito y manda el JWT en `Authorization: Bearer <token>`. | Obligatorio para quien tenga permisos de modificación (§6.4). |
| **Planta, con internet** | Login local en el Edge (mismo endpoint que offline, ver abajo), para que la experiencia sea igual en ambos estados. | Obligatorio para quien tenga permisos de modificación (TOTP propio del Edge). |
| **Planta, sin internet** | Login local en el Edge contra usuarios y roles **cacheados en SQLite**. | Obligatorio para quien tenga permisos de modificación (el código TOTP se genera y valida sin internet). |

Lo que cada usuario puede ver y hacer lo definen sus **permisos** (§6.4), que viajan en el token. Quien no tiene ningún permiso de modificación entra solo con clave.

### 6.1. Ciclo de vida de una cuenta (decisión 2026-10-16)

1. **El Administrador crea la cuenta** con una **clave temporal**, elige un **rol como plantilla** y **ajusta sus permisos** (§6.4). Le entrega la clave temporal al usuario.
2. **Primer inicio de sesión:** el sistema obliga a **cambiar la clave** por una personal. Sin cambiarla no se entra al dashboard.
3. **Usuarios con algún permiso de modificación:** después del cambio de clave deben **registrar el MFA** (escanear un código QR con Microsoft Authenticator). Sin MFA registrado no entran.
4. Desde ahí la clave es **personal**: se guarda solo como hash y **nadie puede verla, ni el Administrador**.
5. **Clave olvidada:** el Administrador no la consulta; la **resetea** (nueva clave temporal) y se vuelve al paso 2.
6. **Celular perdido:** el Administrador **resetea el MFA** y el usuario lo vuelve a registrar en su próximo inicio de sesión.

Crear usuarios y resetear clave o MFA son cambios de configuración: **solo con internet y con MFA** (decisión 2026-10-14).

En la nube este flujo viene incluido en Cognito (estado `FORCE_CHANGE_PASSWORD` y registro de TOTP). En el Edge se replica con los endpoints de abajo.

### 6.2. Endpoints de sesión del Edge

El login puede responder con un **desafío** en vez del token, según en qué paso del ciclo esté la cuenta:

| Endpoint | Cuerpo | Respuesta |
| :--- | :--- | :--- |
| `POST /api/auth/login` | `{ "usuario", "clave" }` | Token, o `{ "desafio": "cambiar_clave" \| "registrar_mfa" \| "codigo_mfa", "sesion": "..." }` |
| `POST /api/auth/cambiar-clave` | `{ "sesion", "clave_nueva" }` | Siguiente desafío o token. |
| `POST /api/auth/mfa/registrar` | `{ "sesion" }` | `{ "qr_uri": "otpauth://..." }` para escanear con Authenticator. |
| `POST /api/auth/mfa/verificar` | `{ "sesion", "codigo" }` | Token: `{ "token", "rol", "locales", "permisos", "expira" }` |
| `GET /api/auth/yo` | — | Rol, locales y permisos del token actual (para restaurar la sesión al recargar). |
| `POST /api/auth/logout` | — | Invalida el token. |

- Contraseñas guardadas solo como **hash** (bcrypt o argon2); secretos TOTP **cifrados** en SQLite.
- Clave personal: mínimo 10 caracteres y distinta a la temporal.
- Sesión con expiración (propuesta: 8 h, un turno) y bloqueo tras 5 intentos fallidos.
- Solo `login`, `cambiar-clave` y los de `mfa` responden sin token (usan el `sesion` temporal del desafío, válido 5 min).
- **Consecuencia a conocer:** como Cognito no entrega su secreto TOTP (§6.3), los usuarios con MFA tendrán **dos entradas** en Microsoft Authenticator: una para la nube y otra para planta.

### 6.3. Ojo: Cognito no entrega las contraseñas

Cognito **no permite exportar** los hashes de contraseña ni los secretos TOTP, así que el Edge no puede validar offline la misma clave de Cognito. Opciones:

1. **Usuarios locales propios del Edge** (propuesta para el MVP): el Administrador los crea desde la nube (RDS) y el Edge los descarga en cada sincronización. El cambio de clave y el registro de MFA hechos en planta suben a RDS en la siguiente sincronización. La clave de planta puede ser distinta a la de Cognito.
2. **Caché al iniciar sesión online:** el Edge reenvía el login a Cognito y, si es correcto, guarda un hash propio de esa clave para usarlo offline. Una sola clave para el usuario, pero solo funciona offline para quien ya entró alguna vez con internet.

### 6.4. Permisos por usuario (decisión 2026-10-16)

Al crear la cuenta, el Administrador elige un **rol como plantilla** y luego **marca o desmarca permisos** uno por uno. Los permisos se guardan en RDS (no en Cognito) y el Edge los recibe al sincronizar.

**Locales que puede ver** (lista aparte): `["local1"]`, `["local2"]` o ambos.

**Permisos:**

| Permiso | Tipo | Qué habilita |
| :--- | :--- | :--- |
| `ver_actual` | Ver | Tarjetas KPI de sus locales |
| `ver_alertas` | Ver | Lista de alertas de sus locales |
| `ver_historico` | Ver | Gráficos históricos y comparaciones |
| `ver_general` | Ver | Vista consolidada de ambas sedes (solo nube; requiere ver ambos locales) |
| `reconocer_alertas` | Modificar | Marcar alertas como reconocidas |
| `modificar_umbrales` | Modificar | Cambiar umbrales de alerta (solo con internet) |
| `gestionar_usuarios` | Modificar | Crear usuarios, asignar permisos, resetear clave y MFA (solo con internet) |

**Plantillas por rol** (punto de partida; el Administrador las ajusta):

| Permiso | Operario | Jefe de Mantenimiento/Operaciones | Administrador |
| :--- | :---: | :---: | :---: |
| Locales | El suyo | Ambos | Ambos |
| `ver_actual` | ✅ | ✅ | ✅ |
| `ver_alertas` | ✅ | ✅ | ✅ |
| `ver_historico` | ⬜ | ✅ | ✅ |
| `ver_general` | ⬜ | ✅ | ✅ |
| `reconocer_alertas` | ⬜ | ✅ | ✅ |
| `modificar_umbrales` | ⬜ | ⬜ | ✅ |
| `gestionar_usuarios` | ⬜ | ⬜ | ✅ |

**Reglas de seguridad:**
- **MFA obligatorio** para cualquier usuario con al menos un permiso de tipo *Modificar*, sin importar su rol.
- Nadie puede otorgar permisos que **él mismo no tiene**.
- Siempre debe existir **al menos un usuario** con `gestionar_usuarios` (no se puede quitar el último).
- **La API valida los permisos en cada petición** y responde 403 si falta. El dashboard solo oculta botones y pestañas; ocultar no es proteger.
- Cambios de permisos quedan registrados (quién, cuándo, qué cambió), sin nombres ni RUT de operarios (Ley 19.628).

**Endpoints de administración** (nube, requieren `gestionar_usuarios` + MFA):

| Endpoint | Uso |
| :--- | :--- |
| `GET /api/permisos` | Lista de permisos y plantillas (para armar el formulario). |
| `POST /api/usuarios` | `{ "usuario", "clave_temporal", "rol", "locales", "permisos" }` |
| `PATCH /api/usuarios/{id}` | Cambia rol, locales o permisos. |
| `POST /api/usuarios/{id}/resetear-clave` | Nueva clave temporal. |
| `POST /api/usuarios/{id}/resetear-mfa` | Obliga a registrar el MFA de nuevo. |

---

## 7. Puntos por decidir con el equipo

1. ~~¿Lectura sin login en planta?~~ **Resuelto 2026-10-16:** siempre con login, con o sin internet.
1b. Login local del Edge: ¿usuarios propios del Edge o caché tras login online (§6.3)? *(MFA en planta: resuelto 2026-10-16, obligatorio para quien tenga permisos de modificación. Permisos por usuario: resuelto 2026-10-16, §6.4.)*
2. ¿Polling cada 5 s es suficiente o se quiere tiempo real por WebSocket (EMQX lo soporta en 8084)?
3. ¿Quién define el `nombre` en pantalla de cada variable: la API (§3.2) o el dashboard?
4. Criterio de "local desconectado" en la nube: ¿30 min sin datos está bien?
