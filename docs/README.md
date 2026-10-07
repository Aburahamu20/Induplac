# 📚 Índice de Documentación Técnica — Induplac IoT

Este directorio contiene la especificación técnica completa de la plataforma **Induplac IoT**.

---

## 📑 Documentos Disponibles

| Documento | Descripción |
| :--- | :--- |
| **[CONTEXTO.md](CONTEXTO.md)** | **Documento maestro de contexto:** visión, decisiones de diseño, requisitos, restricciones y roadmap. |
| **[arquitectura.md](arquitectura.md)** | Arquitectura híbrida (Edge + Cloud), integración Wokwi/ESP32, esquema SQLite y DynamoDB + RDS. |
| **[ciberseguridad.md](ciberseguridad.md)** | Estrategia de defensa en 5 capas, modelo STRIDE, matriz RBAC y cumplimiento Ley 19.628 (Chile). |
| **[decisiones-tecnicas.md](decisiones-tecnicas.md)** | Registro de Decisiones de Arquitectura (ADR): persistencia políglota, VPN Site-to-Site y VLANs. |
| **[modo-offline.md](modo-offline.md)** | Especificación de contingencia en planta, cálculo de almacenamiento y política de retención. |
| **[../infrastructure/README.md](../infrastructure/README.md)** | Topología de red, subredes VPC, Security Groups referenciados y túneles IPsec. |

---

## 📌 Próximos Documentos en Desarrollo
- `modelo-datos.md`: Diccionario de datos y contratos JSON detallados.
- `sincronizacion.md`: Algoritmo de resincronización y manejo de colas.
- `casos-prueba.md`: Las 5 pruebas de demostración para evaluación docente.
