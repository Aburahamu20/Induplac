# ☁️ Backend AWS — Induplac IoT (MVP de la demo)

Tarea 5 de `docs/EN-CURSO.md` (Abraham y Felipe). API de la nube que recibe los intervalos del Edge y responde al dashboard de gerencia con el contrato de [`docs/api-dashboard.md`](../docs/api-dashboard.md).

```
Edge (o simular_edge.py) ──POST /intervalos──► API Gateway (HTTP API) ──► Lambda induplac-api ──► DynamoDB
Dashboard (VITE_FUENTE=api) ──GET /api/...───►                                                   ├─ induplac-intervalos
                                                                                                  └─ induplac-alertas
```

| Archivo | Qué es |
| :--- | :--- |
| `lambda_api/lambda_function.py` | Lambda única: ingesta, reglas de alerta y consulta del dashboard |
| `scripts/simular_edge.py` | Simulador del Edge: carga historia y manda el intervalo actual (solo biblioteca estándar) |

## Simplificaciones del MVP (respecto al diseño)

| Diseño (`CONTEXTO.md`, ADR) | MVP de la demo | Por qué |
| :--- | :--- | :--- |
| Alertas, usuarios y umbrales en **RDS** | Alertas en la tabla DynamoDB `induplac-alertas`; umbrales en el código | RDS cuesta por hora en el Learner Lab y no es necesario para mostrar el flujo |
| Ingesta autenticada con **IAM de mínimo privilegio** | Clave compartida en la cabecera `x-induplac-key` (variable `CLAVE_INGESTA`) | El Learner Lab no permite crear usuarios ni roles IAM; solo existe `LabRole` |
| Login de gerencia con **Cognito + MFA** | El dashboard usa el login simulado (`VITE_AUTH=simulada`) y la API de consulta aún no valida el token | Cognito es la tarea 6; primero hay que probar que el Learner Lab lo permita |
| **VPN + API Gateway privada** | API Gateway pública con HTTPS | Decisión del 2026-10-14 (ADR-02) |

## Formato de la ingesta (`POST /intervalos`)

Cabecera obligatoria: `x-induplac-key: <CLAVE_INGESTA>`. Lote de hasta 50 registros de un mismo local.

```json
{
  "batch_id": "local1-2026-10-17T23:00:00Z",
  "local_id": "local1",
  "historico": false,
  "records": [
    {
      "inicio_intervalo": "2026-10-17T23:00:00Z",
      "energia_kw": 38.2,
      "energia_kw_max": 41.0,
      "agua_m3h": 0.95,
      "agua_m3": 0.2375,
      "uv_max": 6.4,
      "produccion_mes": 215,
      "produccion_anual": 3465,
      "hh_sin_incidentes": 8800,
      "dias_sin_incidentes": 53
    }
  ]
}
```

- `agua_m3` = consumo dentro del intervalo (m³). La Lambda suma los del día para `agua_m3_dia`.
- Local 2 manda además `energia_climatizacion_kw` y `energia_iluminacion_kw`, y no manda UV ni producción.
- Upsert por `local_id + inicio_intervalo`: reenviar el mismo intervalo **no lo duplica** (ADR-05).
- `historico: true` guarda sin evaluar alertas (carga inicial de historia).
- Cada intervalo nuevo se evalúa con las reglas de §8.2; las alertas se guardan con la llave `local_id:variable:inicio_intervalo` (ADR-06).

## Puesta en marcha en el Learner Lab (paso a paso)

Todo en la cuenta de **una** persona, región **us-east-1**.

### 1. Tablas DynamoDB (Capacity mode: On-demand)
| Tabla | Partition key | Sort key |
| :--- | :--- | :--- |
| `induplac-intervalos` | `local_id` (String) | `inicio_intervalo` (String) |
| `induplac-alertas` | `local_id` (String) | `id` (String) |

### 2. Lambda
1. **Lambda → Create function → Author from scratch**.
2. Nombre `induplac-api`, runtime **Python 3.12**.
3. **Change default execution role → Use an existing role → `LabRole`**.
4. En el editor, reemplazar el contenido de `lambda_function.py` por el de este repo y **Deploy**.
5. **Configuration → Environment variables**: `CLAVE_INGESTA` = una clave larga inventada (no subirla al repo).
6. **Configuration → General configuration**: Timeout **30 s** (la carga de historia escribe lotes de 50).

### 3. API Gateway (HTTP API)
1. **API Gateway → Create API → HTTP API → Build**.
2. **Add integration → Lambda → `induplac-api`**. Nombre `induplac-http`.
3. Rutas: método **ANY**, ruta **`/{proxy+}`** (todas las rutas van a la misma Lambda).
4. Stage **`$default`** con auto-deploy.
5. **CORS**: Allow origin `*`; Allow headers `content-type, authorization, x-induplac-key`; Allow methods `GET, POST, OPTIONS`.
6. Copiar la **Invoke URL** (ej. `https://abc123.execute-api.us-east-1.amazonaws.com`).

### 4. Probar
```powershell
# Debe responder {"ok": true}
curl.exe https://abc123.execute-api.us-east-1.amazonaws.com/health
```

### 5. Cargar datos con el simulador del Edge
```powershell
cd backend\scripts
python simular_edge.py --url https://abc123.execute-api.us-east-1.amazonaws.com --clave LA_CLAVE
```
La primera vez carga 29 días de historia (necesarios para la regla de energía de 4 semanas) y luego manda el intervalo actual cada 20 s. Para mostrar una alerta: agregar `--uv 9.5 --sin-historia`.

### 6. Dashboard leyendo de AWS
Crear `dashboard/.env.local` (no se sube al repo):
```bash
VITE_FUENTE=api
VITE_API_URL=https://abc123.execute-api.us-east-1.amazonaws.com/api
VITE_AUTH=simulada
VITE_DEMO=false
```
y reiniciar `npm run dev`.

## Costos y cuidado del crédito
- DynamoDB on-demand, Lambda y HTTP API: centavos para la demo.
- Las credenciales del Learner Lab vencen (~4 h) y el lab se detiene solo; las tablas, la Lambda y la API **quedan**, solo hay que volver a hacer *Start Lab*.
- No se usa RDS, NAT Gateway ni VPN (los que cobran por hora).
