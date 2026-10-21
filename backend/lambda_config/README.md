# ⚙️ Lambda `induplac-config` — configuración desde RDS

Lambda aparte de `induplac-api`, creada el 2026-10-20. Corre **dentro de la VPC** para llegar a RDS PostgreSQL. `induplac-api` (ingesta y dashboard, sobre DynamoDB) **no se tocó**: si RDS está apagado, solo falla esta Lambda y el resto sigue funcionando.

```
API Gateway induplac-http
 ├── GET /config/{proxy+} ──► induplac-config (default VPC) ──► RDS induplac-db (PostgreSQL 18)
 └── ANY /{proxy+}        ──► induplac-api                 ──► DynamoDB
```

| Ruta | Devuelve |
| :--- | :--- |
| `GET /config/umbrales` | Umbrales de alerta por local y variable |
| `GET /config/catalogo` | Locales y dispositivos |

## Cómo se armó (Learner Lab, us-east-1)

1. **Paquete:** `lambda_function.py` + `pg8000` (PostgreSQL en Python puro) + `global-bundle.pem` (CA de RDS para TLS con verificación). Se sube como `.zip` (*Code → Update from a .zip file*).
   ```bash
   pip install --target pkg -r requirements.txt
   cp lambda_function.py pkg/
   curl -o pkg/global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
   cd pkg && zip -r ../induplac-config.zip .
   ```
2. **Función:** Python 3.12, rol `LabRole`, VPC por defecto con todas las subredes y el security group *default* de la VPC. Timeout 15 s.
3. **Variables de entorno:** `DB_HOST`, `DB_NAME` (`induplac`), `DB_USER` (`induplac_admin`), `DB_PASS`. La clave no va al repo.
4. **Security group de RDS (`induplac-rds-sg`):** una sola regla de entrada, PostgreSQL (5432) desde el security group de la Lambda. Sin IPs ni `0.0.0.0/0`: la base solo es alcanzable desde el backend.
5. **API Gateway:** ruta `GET /config/{proxy+}` integrada a `induplac-config`. Al ser más específica que `ANY /{proxy+}`, no cambia el resto de la API.

## Probar
```powershell
curl.exe https://3j82c54obf.execute-api.us-east-1.amazonaws.com/config/umbrales
```
Responde `{"fuente": "rds", "umbrales": [...]}`. Si RDS está detenido, responde **503** `RDS no disponible`.
