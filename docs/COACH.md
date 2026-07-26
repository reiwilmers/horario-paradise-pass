# Coach Paradise Pass (integrado en Mi horario)

El Coach corre **dentro de la app** con el mismo prompt del GPT custom. Los agentes no salen a ChatGPT.

## Configuración en Vercel (gratis con Gemini)

1. Ve a [Google AI Studio](https://aistudio.google.com/apikey) y crea una **API key gratis** (no requiere tarjeta en el plan free).
2. En Vercel → **horario-paradise-pass** → **Settings** → **Environment Variables**:
   - `GEMINI_API_KEY` = tu key de Google AI Studio
   - `GEMINI_MODEL` (opcional) = `gemini-2.0-flash` (default)
3. **Redeploy** Production.

### Alternativa de pago (opcional)

Si prefieres OpenAI en lugar de Gemini:
- `OPENAI_API_KEY` + opcional `OPENAI_MODEL=gpt-4o`
- Gemini tiene prioridad si ambas están configuradas.

## Flujo del agente (todo en Mi horario)

1. Guardar números del día
2. Screenshot stats → WhatsApp Stats
3. Escribir reflexión (SALA / LOBBY)
4. **Obtener feedback del Coach** → respuesta en la app
5. Screenshot del feedback → WhatsApp Stats

## Seguimiento SUP/GTE

En Metas → Avance actual:
- **Coach usado hoy** — recibió feedback en la app
- **Reflexión sin Coach** — escribió pero no pidió feedback
- **Sin reflexión hoy**
