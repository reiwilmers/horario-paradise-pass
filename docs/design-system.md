# Design System — Paradise Pass Horario

## Brand tokens (`css/tokens.css`)

- Primary: `#063b46` (teal-900)
- Accent: `#0b8b8f`, `#ea634a` (coral CTA)
- Gold highlight: `#f4b84a`

## Schedule area colors

| Area | Background | Text |
|------|------------|------|
| Sala 8:50 | `#cfe9ff` | `#0b426e` |
| Cierre Sala | `#1d5f9f` | white |
| Lobby 7:00 | `#e95c55` | white |
| Lobby 8:00 | `#cdefcf` | `#195b25` |
| Lobby 9:00 | `#76c77d` | `#103d17` |
| Cierre Lobby | `#178f46` | white |
| WBD 5:30PM | `#1e3a5f` | white |
| Posible Off | `#b68ce6` | `#30124f` |
| Off | `#ffd966` | `#4b3400` |
| General tag | `#f08a24` | white |

## Components

### AgentChip
- Always `background: white`, `color: #0f172a`
- WBD badge: pill `#0f766e` / white text, separate from name

### SelectAgent (add agent dropdown)
- Explicit dark text: `color: #0f172a !important` on `select` and `option`
- Never inherit row tone color

### CategoryPill
- TOP `#15803d`, MA `#f59e0b`, MB `#dc2626`, SUP `#111827`, GTE `#374151`
- One click opens change; second click saves

### EmptySlot
- Dashed border, label "Espacio libre"
- No WBD checkbox

### RuleSection (Equipo)
- Collapsed by default
- Badge count when agent has special rules

## Layout

- Sidebar 180px desktop; bottom nav mobile (max 5 items)
- Schedule grid: min-width ~980px, horizontal scroll on small screens
- Spacing scale: 4, 8, 12, 16, 24, 32px

## Typography

- Font: Inter, system-ui
- Cell text: 11px bold
- Body: 14px
- Panel title: 18–20px black weight
