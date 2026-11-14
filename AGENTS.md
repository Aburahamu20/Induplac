# Instrucciones para asistentes de IA — Induplac IoT

Este archivo es para cualquier IA que trabaje en este repositorio (Claude, Antigravity/Gemini, Copilot, Codex, etc.). Síguelo antes de hacer cualquier cambio.

## 1. Antes de empezar
1. Haz `git pull` (o lee la rama `main` actualizada).
2. Lee, en este orden:
   - [`docs/CONTEXTO.md`](docs/CONTEXTO.md): contexto maestro y decisiones vigentes.
   - [`docs/notas-de-avance.md`](docs/notas-de-avance.md): bitácora; el estado vigente está en la **entrada más reciente**.
   - [`docs/EN-CURSO.md`](docs/EN-CURSO.md): qué está haciendo cada integrante **ahora**.
   - [`docs/nota-3.md`](docs/nota-3.md): **entrega vigente (Nota 3, 25/11/2026)**: pauta del profe, criterios con su peso, qué existe, qué falta, reparto y fechas. Léelo si la tarea es de la Nota 3 (tareas 33 a 43, 17 y 18).
3. Lo marcado como "propuesta", "idea" o "pendiente" **no está decidido**. No lo implementes como si lo estuviera; pregunta al usuario.
4. Si el `README.md` no coincide con `docs/CONTEXTO.md`, manda `docs/CONTEXTO.md`.

## 2. Para no rehacer trabajo ajeno (obligatorio)
- Antes de trabajar en una tarea, revisa [`docs/EN-CURSO.md`](docs/EN-CURSO.md).
  - Si está **🟡 En curso** por otra persona: **no la hagas**. Avísale al usuario quién la tiene.
  - Si está **🟢 Libre** o no existe: **resérvala primero** (nombre del usuario, fecha, rama, estado 🟡) y haz commit + push de esa reserva **antes de escribir código**.
- Revisa también los **Pull Requests abiertos** en GitHub: muestran lo que otros están por integrar.

## 3. Todo cambio va por Pull Request (obligatorio)
- **Nunca hagas commit directo en `main`.** Crea una rama (`feature/<tema>`, `fix/<tema>` o `docs/<tema>`), haz tus commits ahí y abre un **Pull Request** hacia `main`.
- **`main` está protegida** (ruleset `proteger-main`, desde el 13/11/2026): solo acepta cambios con los 6 checks del CI en verde. Un commit directo a `main` será rechazado.
- **Reservar una tarea:** crea la rama, cambia la tarea a 🟡 en `docs/EN-CURSO.md` como **primer commit**, haz push y abre el PR de inmediato (puede ser *draft*) para que el equipo vea la reserva. Si no puedes, pídele al admin del repo (Abraham) que la reserve en `main`.
- El PR debe **dejar escrito qué cambiaste** usando la plantilla (`.github/pull_request_template.md`): qué cambió, por qué, cómo probarlo y el checklist.
- No hagas merge de tu propio PR sin que el usuario lo apruebe.

## 4. Al terminar
1. En `docs/EN-CURSO.md`: estado 🔵 (PR abierto) con el link al PR; ✅ cuando se haga merge, y muévela al historial.
2. Agrega una entrada con fecha al final de `docs/notas-de-avance.md`: qué se hizo, qué se decidió y qué quedó pendiente (dentro del mismo PR).
3. Si cambió una decisión, actualiza también `docs/CONTEXTO.md` y, si aplica, `docs/GUIA-EQUIPO.md`.
4. Recuérdale al usuario **avisar en el grupo del equipo** qué cambió y el link al PR.

## 5. Reglas generales
- Idioma: español.
- No subas credenciales, contraseñas, tokens ni archivos `.env` (usa `.env.example`).
- Datos siempre ficticios; nunca datos personales de trabajadores (Ley 19.628).
- Mensajes de commit con prefijo: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`. Detalle en [`CONTRIBUTING.md`](CONTRIBUTING.md).
