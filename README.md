# money-pit

Where does it all go? Upload a credit-card statement export and see where the money's actually
leaking — auto-categorized by merchant keyword, charted by category and cardholder, correctable row
by row.

Everything runs in the browser. No backend, no accounts, no uploads: your statement is parsed in the
tab and forgotten when you close it (session-only state in `sessionStorage`).

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

Drop one or more statement CSVs onto the landing page. The dashboard replaces it; use **＋ Add
statement** in the header to merge in more exports (duplicated rows across overlapping exports are
deduped) and **Start over** to clear everything.

## CSV format

A header row is required, exactly:

```
Status,Date,Description,Debit,Credit,Member Name
```

- `Date` is `MM/DD/YYYY`.
- `Debit` and `Credit` are mutually exclusive per row; credits are negative numbers in the `Credit`
  column.
- Anything else is rejected per file with an inline error — the other files in the same drop still
  load.

## What it does

- **Auto-categorization** by keyword rules (first matching rule wins). Edit, recolor, reorder, add
  and delete rules in the **Category rules** panel; `Payments` and `Other` are built in and can be
  renamed but not deleted.
- **Manual corrections** always win over rules: click a category pill for one row, or check several
  rows and use the bulk bar.
- **Charts** — category donut/bars (mode persists for the session) and a cardholder donut. Clicking a
  slice filters everything below it; unselected slices dim rather than disappear so they stay
  clickable.
- **Table filters** live in the column headers (person dropdown, amount min/max), with description
  search and a payments/credits toggle in the bar above.
- Statement payments are excluded from charts and totals always, and from the table unless
  "Show payments & credits" is on.

## Scripts

| Command                 | What it does                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `npm run dev`           | Next.js dev server                                                                 |
| `npm run build`         | Static export to `out/`                                                            |
| `npm start`             | Serve the built `out/` locally                                                     |
| `npm run lint`          | ESLint                                                                             |
| `npm run typecheck`     | `tsc --noEmit`                                                                     |
| `npm test`              | Vitest unit + RTL integration tests                                                |
| `npm run test:coverage` | Same, with coverage for `lib/` and `store/`                                        |
| `npm run e2e`           | Playwright (chromium); builds are served from `out/`, so run `npm run build` first |
| `npm run format`        | Prettier                                                                           |

## Architecture

- Next.js 16 App Router with `output: 'export'` — the whole app is a static bundle.
- Zustand store (`src/store`) persisted to `sessionStorage`; `Transaction[]` is derived from raw CSV
  rows + rules + manual overrides rather than stored.
- Pure domain logic in `src/lib` (CSV parsing, categorization, ids, formatting) — no React, heavily
  unit-tested.
- Chart.js 4 via react-chartjs-2, TanStack Table v8 (headless), CSS Modules over design tokens in
  `src/app/globals.css`.
- `prototype/` keeps the original single-file dashboard for visual reference. `prototype/data.js`
  (real statement data) stays gitignored.

Testing follows the trophy: many unit tests for `src/lib`, most of the weight in RTL integration
tests wired to the real store, and a handful of Playwright specs for what only a real browser proves
(file inputs, canvas rendering, reload persistence).

## Deploy

Netlify builds `npm run build` and publishes `out/` (see `netlify.toml`). To connect the repo, in the
Netlify UI: **Add new site → Import an existing project → pick this GitHub repo**. Build command and
publish directory are read from `netlify.toml`; no environment variables are needed. After that,
`main` auto-deploys and every PR gets a deploy preview.

GitHub Actions (`.github/workflows/ci.yml`) runs lint, typecheck, tests, build and E2E on every PR
and push to `main`.

## Privacy

No data ever leaves the browser: there is no server, no analytics, and no network calls with your
statement. Committed fixtures use synthetic "Alex/Jamie Sample" data only.
