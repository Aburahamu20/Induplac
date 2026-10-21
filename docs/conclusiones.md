# 🎯 Conclusiones y defensa — Nota 2

> **Autora:** Bárbara Saavedra (`barbaraantoniaa`). Tarea 15 de [`EN-CURSO.md`](EN-CURSO.md) · punto 12 de la pauta ([`NOTA-2.md`](NOTA-2.md)).
> Basado en [`CONTEXTO.md`](CONTEXTO.md) y [`decisiones-tecnicas.md`](decisiones-tecnicas.md).

---

## 1. El problema

En Induplac, los consumos de energía y agua se conocen recién con la **boleta mensual**. Eso provoca tres problemas:

1. **Las anomalías se detectan tarde:** una máquina encendida fuera de turno o una fuga de agua se descubren 30 días después.
2. **Riesgo para los operarios:** no hay aviso cuando la radiación UV en los patios es peligrosa.
3. **Los sistemas 100 % en la nube fallan sin internet:** si se corta la fibra, la planta queda sin información.

## 2. Nuestra solución

Una **plataforma IoT híbrida**: sensores que envían datos por MQTT a una Raspberry Pi en cada local (Edge), que guarda, calcula y alerta **aunque no haya internet**, y una nube en AWS que consolida los dos locales para gerencia.

## 3. Beneficios

| Beneficio | Cómo lo logramos |
|---|---|
| **Detección en minutos, no en un mes** | Intervalos de 15 min y alertas automáticas (energía +20 %, posible fuga de agua, UV ≥ 8). |
| **Protección de los operarios** | Alerta de UV alto en tiempo real. |
| **La planta nunca queda ciega** | El Edge sigue funcionando sin internet y se sincroniza al volver, sin perder ni duplicar datos. |
| **Costo casi cero** | Servicios serverless que se pagan por uso; RDS se apaga cuando no se usa. |
| **Seguridad y privacidad** | Login obligatorio, MFA para quien modifica, VLANs separadas y ningún dato personal de los operarios (Ley 19.628). |
| **Crece fácilmente** | Agregar un local nuevo es replicar el mismo Edge. |
| **Cambios sin romper lo que funciona** | En cada cambio, GitHub Actions prueba solo las reglas de alerta y compila el dashboard antes de aceptarlo. |

## 4. Limitaciones

- **Datos simulados:** el prototipo usa sensores virtuales en Wokwi, no sensores reales.
- **La VPN queda solo como diseño:** en la demo la conexión va por HTTPS con una clave de ingesta, por el costo y las restricciones del Learner Lab (no permite crear usuarios IAM).
- **Hora sin internet (RTC):** también queda como diseño; no aplica en Wokwi.
- **Dependencia del Learner Lab:** presupuesto de USD 100 y servicios que hay que encender para las pruebas.
- **Las alertas solo se ven en el dashboard:** todavía no llegan por correo ni por celular.
- **Login con Cognito por terminar de probar:** Cognito con MFA funciona en AWS y el dashboard ya tiene el login con Cognito (PR #20), pero falta probarlo de punta a punta; mientras, la demo puede usar el login propio del dashboard (mismas reglas de clave temporal y MFA).

## 5. Siguientes pasos

1. **Piloto real** en el Local 1 con sensores físicos (corriente y caudalímetros) y una Raspberry Pi.
2. **Terminar de probar el login con Cognito** y que la Lambda de ingesta lea los umbrales desde RDS.
3. **Activar la VPN** Site-to-Site en una cuenta AWS de producción.
4. **Notificaciones** por correo o Telegram (Amazon SNS).
5. **Históricos comparables** (por ejemplo, este invierno contra el anterior).
6. **Predicción de consumo** con modelos simples de machine learning.

---

## 6. Preguntas probables en la defensa

| Pregunta | Respuesta corta |
|---|---|
| ¿Por qué no todo en la nube? | Porque si se corta internet la planta quedaría ciega; el Edge asegura que siga funcionando. |
| ¿Por qué dos bases de datos en AWS? | DynamoDB es casi gratis y siempre está encendida para recibir datos y alertas; RDS guarda la configuración (permisos, umbrales y catálogo) y se puede apagar sin cortar nada. Las cuentas y el MFA los maneja Cognito. |
| ¿Qué pasa si se corta internet en la demo? | El dashboard sigue igual, cambia a OFFLINE, y al volver sincroniza todo sin duplicados. |
| ¿Cómo protegen los datos de los trabajadores? | No se guardan nombres ni RUT; las horas hombre son solo contadores. |
| ¿Por qué la VPN no está en la demo? | Por costo y porque el Learner Lab no garantiza permitirla. Está diseñada y documentada para producción. |
