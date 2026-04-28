# IMS Coach OS · Consolidated repo

This is the unified Flask/HTML repo. All previous separate modules
now live here and share navigation, design tokens, and routing.

## Routes

| Path                  | Serves                       | Notes |
|-----------------------|------------------------------|-------|
| `/`                   | SPA · Dashboard view         | hash routes inside |
| `/dashboard`          | SPA · Dashboard alias        | |
| `/generator`          | SPA · opens Assessment wizard| `app.js` translates path→hash |
| `/assessment`         | SPA · opens Assessment wizard| alias |
| `/exercise-library`   | `web/exercise-library.html`  | shared sidebar |
| `/calendar`           | `web/calendar.html`          | wraps `IMS_Master_Calendar.jsx` via Babel-standalone |
| `/program-review`     | `web/program-review.html`    | loads `/api/demo/program` |
| `/session-notes`      | `web/session-notes.html`     | placeholder · reads localStorage notes |

## APIs

| Path                       | Methods   | Notes |
|----------------------------|-----------|-------|
| `/api/generate`            | POST      | **Untouched · existing PDF flow** |
| `/api/library/exercises`   | GET       | existing · 1049 exercises |
| `/api/library/health`      | GET       | existing |
| `/api/demo/program`        | GET       | new · returns Amanda demo |
| `/api/calendar/events`     | GET, POST | new · in-memory store |
| `/api/session-notes`       | GET, POST | new · in-memory store |
| `/api/program/review/save` | POST      | new · in-memory store |

## Shared frontend assets (`web/assets/`)

| File                  | Purpose |
|-----------------------|---------|
| `ims-ui.css`          | Design tokens, nav, buttons, cards (used by sister pages) |
| `ims-nav.js`          | Renders shared sidebar from MODULES registry; auto-highlights active |
| `ims-storage.js`      | localStorage helpers · forward-compatible with future Supabase |
| `ims-api.js`          | fetch helpers for all endpoints; falls back gracefully |
| `program-review.js`   | Program-Review page logic (replace, dose, notes, calendar push) |
| `ims-master-calendar.jsx` | Reference source kept alongside the inlined calendar.html |

## Module registry

Single source of truth for nav: edit `web/assets/ims-nav.js`'s
`MODULES` array; nav and active-state are then automatic on every
page that includes `<aside data-ims-sidebar></aside>` or hosts
the auto-render hook.

## What's left untouched

- `generator/*` · engine
- `libraries/*` · all JSON libraries
- `tests/*` · 154 tests still pass
- `assets/*` · IMS logos
- `/api/generate` · PDF flow
