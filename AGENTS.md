# Instrucciones para asistentes de IA — Induplac IoT

Este archivo es para cualquier IA que trabaje en este repositorio (Claude, Antigravity/Gemini, Copilot, Codex, etc.). Síguelo antes de hacer cualquier cambio.

## 1. Antes de empezar
1. Haz `git pull` (o lee la rama `main` actualizada).
2. Lee, en este orden:
   - [`docs/CONTEXTO.md`](docs/CONTEXTO.md): contexto maestro y decisiones vigentes.
   - [`docs/notas-de-avance.md`](docs/notas-de-avance.md): bitácora; el estado vigente está en la **entrada más reciente**.
   - [`docs/EN-CURSO.md`](docs/EN-CURSO.md): qué está haciendo cada integrante **ahora**.
3. Lo marcado como "propuesta", "idea" o "pendiente" **no está decidido**. No lo implementes como si lo estuviera; pregunta al usuario.
4. Si el `README.md` no coincide con `docs/CONTEXTO.md`, manda `docs/CONTEXTO.md`.

## 2. Para no rehacer trabajo ajeno (obligatorio)
- Antes de trabajar en una tarea, revisa [`docs/EN-CURSO.md`](docs/EN-CURSO.md).
  - Si está **🟡 En curso** por otra persona: **no la hagas**. Avísale al usuario quién la tiene.
  - Si está **🟢 Libre** o no existe: **reservala primero** (nombre del usuario, fecha, rama, estado 🟡) y haz **commit + push de ese cambio antes de escribir código**.
- Trabaja en una rama propia (`feat/<tema>` o `docs/<tema>`) y abre un Pull Request hacia `main`.

## 3. Al terminar
1. En `docs/EN-CURSO.md`: estado 🔵 (PR abierto) o ✅ (mergeado), con link al PR o commit; muévela al historial cuando quede lista.
2. Agrega una entrada con fecha al final de `docs/notas-de-avance.md`: qué se hizo, qué se decidió y qué quedó pendiente.
3. Si cambió una decisión, actualiza también `docs/CONTEXTO.md` y, si aplica, `docs/GUIA-EQUIPO.md`.

## 4. Reglas generales
- Idioma: español.
- No subas credenciales, contraseñas, tokens ni archivos `.env` (usa `.env.example`).
- Datos siempre ficticios; nunca datos personales de trabajadores (Ley 19.628).
- Mensajes de commit con prefijo: `feat:`, `fix:`, `docs:`, `chore:`.
