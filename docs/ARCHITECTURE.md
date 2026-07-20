# Architecture — Horario Paradise Pass v2

## Layers (top → bottom)

| Layer | Path | Responsibility |
|-------|------|----------------|
| Views | `js/views/` | DOM render, user events only |
| Actions | `js/actions/` | validate → mutate store → persist → sync |
| Store | `js/store.js` | Normalized in-memory state |
| Domain | `domain/` | Pure rules, schemas, blocks — **no DOM, no IndexedDB** |
| Persistence | `js/db.js` | IndexedDB read/write |
| Sync | `js/cloud.js` | Supabase background sync |

## Data flow

```
User click → view → action.placeAgent()
  → domain.canAssign()     // fail fast with { ok, code, message }
  → store.mutate()
  → db.put()
  → cloud.queueSync()
  → store.subscribe → view.render()
```

## Single sources of truth

- **Blocks & capacity:** `domain/blocks.js`
- **Business rules:** `domain/rules/canAssign.js` (+ sub-rules)
- **Agent shape:** `domain/schemas.js`
- **Visible week:** `store.visibleWeek` only (one key in DB: `settings.visibleWeek`)
- **Forecast edit week:** `store.forecastEditWeek` (separate from visible)

## Forbidden patterns

- Patching `Storage.prototype` or `localStorage.setItem`
- Reading `document.body.innerText` for business logic
- String literals for block keys outside `domain/blocks.js`
- `topCaller` field (use `morningWbdEligible`)
- `WBD 4:30PM` (use `WBD 5:30PM` / `WBD_530PM`)

## IndexedDB stores

| Store | Key | Content |
|-------|-----|---------|
| `agents` | `id` | Agent records |
| `schedules` | `weekKey` | `current` \| `next` |
| `forecasts` | `weekKey` | Forecast rows |
| `settings` | `key` | JSON blobs (wbdMorning, forecastSettings, visibleWeek, …) |
| `requests` | `id` | Request records |
| `exceptions` | `id` | Exception records |
| `snapshots` | `id` | Week backups |

## Gates

See README.md — do not ship UI features before domain tests pass.
