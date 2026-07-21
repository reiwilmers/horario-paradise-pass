# Horario Paradise Pass v2

Rebuild limpio del horario operativo Paradise Pass Punta Cana.

## Stack

- Vanilla JS (ES modules) — patrón [punta-cana-sala](../punta-cana-sala)
- IndexedDB local + Supabase sync (Gate 5)
- Vitest para reglas de dominio
- Vercel static deploy

## Desarrollo

```bash
npm install
npm test          # reglas de dominio (Gate 0/1)
npm run serve     # http://localhost:8787
```

## Gates

| Gate | Estado | Contenido |
|------|--------|-----------|
| 0 | ✅ | Estructura, domain, db, seed, tests base |
| 1 | ✅ | Reglas canAssign + tests |
| 2 | ✅ | Horario publicado + Dashboard editable (drag, +, WBD) |
| 3 | ✅ | Equipo UI (categoría, WBD, reglas estructuradas) |
| 4 | ✅ | Forecast editable + generador de horario |
| 5 | ✅ | Solicitudes, excepciones, sync Supabase |
| 6 | ✅ | Deploy Vercel + build config Supabase |

## Deploy (Vercel)

1. Push repo to GitHub (`reiwilmers/horario-paradise-pass`)
2. Import in Vercel — static site, build uses `vercel.json`
3. Build runs `npm test` + generates `js/config.js` from env (optional overrides):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_ENABLED=false` to disable sync

Local `js/config.js` is gitignored; Vercel generates it at build time.

## Producción

- **App activa:** https://horario-paradise-pass.vercel.app
- **v1 obsoleta:** https://horario-pacochis.vercel.app — ya no se usa; todos los datos viven en Supabase bajo las claves `paradise-pass-*`.

Tras actualizar, abre la app en tu PC una vez para que suba el horario y excepciones a la nube. El celular/iPad los recibirá en segundos (poll cada 8s o al volver a la pestaña).

## Cambios vs v1

- `morningWbdEligible` reemplaza Top Caller
- `eveningWbdEligible` para WBD **5:30PM** (rotación ~1/mes)
- Reglas especiales = campos UI, no texto libre
- Una sola fuente de reglas: `domain/rules/canAssign.js`

## Docs

- [ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [design-system.md](docs/design-system.md)
