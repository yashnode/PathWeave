# PathWeave

PathWeave is a visual 6-month study planner for **DSA + Math/ML interview prep**.  
It turns a long checklist into a more navigable board so you can track progress day by day without endless scrolling.

## Intention

- Make a large preparation plan feel manageable.
- Keep daily decisions simple: one main task, clear reason, clear learning target.
- Blend **structure** (months, topics, review cadence) with **flexibility** (filters, progress state, quick navigation).
- Keep the app lightweight and easy to host as static files.

## What It Does

- Builds a 180-day plan from `plan.json`.
- Maps DSA tasks from `dsa_dump.json`.
- Renders days in a **snake-board layout** for compact navigation.
- Shows richer details in a dedicated panel on selection.
- Supports filters:
  - Month
  - DSA topic
  - Math topic
- Tracks progress in `localStorage`:
  - Task completion
  - Active month (defaults to Month 1)
- Keeps offline-safe data loading via embedded fallbacks:
  - `plan-data.js`
  - `dsa-data.js`

## Data Design

`dsa_dump.json` items are normalized to:

- `id`
- `topic`
- `title`
- `url`
- `difficulty` (`easy|medium|hard|unknown`)
- `priority` (`core|stretch`)

The app normalizes and validates data at runtime (URL cleanup, schema checks, dedupe).

## Project Structure

- `index.html` — app shell
- `styles.css` — UI styling and responsive layout
- `app.js` — rendering, filtering, progress, data loading
- `plan.json` — month-by-month plan
- `dsa_dump.json` — DSA source data
- `plan-data.js` / `dsa-data.js` — fallback embedded datasets

## Run Locally

You can open `index.html` directly, but serving over HTTP is recommended:

```bash
python -m http.server 5500
```

Then open:

`http://localhost:5500`

## Deploy

This is a static frontend and can be deployed on:

- GitHub Pages
- Netlify
- Vercel (static)

## Roadmap Ideas

- View switch: snake board / classic list
- Difficulty-aware day balancing
- Search by problem title
- Import/export progress JSON
