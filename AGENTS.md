# AGENTS.md

## What this is

money-pit: a client-only spending dashboard. Upload credit-card statement CSVs, auto-categorize by
merchant keyword, chart by category/cardholder, correct rows manually. No backend — everything runs
in the browser, state lives in `sessionStorage` only. See `README.md` for the full feature/CSV-format
rundown.

## Stack

- Next.js 16 App Router, static export (`output: 'export'`) — deploys as a static bundle to Netlify.
- React 19, Zustand store (`src/store`), CSS Modules over tokens in `src/app/globals.css`.
- Chart.js 4 via react-chartjs-2, TanStack Table v8, react-querybuilder, Radix UI primitives.
- Vitest + React Testing Library for unit/integration tests, Playwright for e2e.

## Layout

- `src/lib/` — pure domain logic (CSV parsing, categorization, hashing/ids, formatting). No React.
  Heavily unit-tested; this is where business rules should live.
- `src/store/` — Zustand store + selectors. `Transaction[]` is derived from raw CSV rows + rules +
  manual overrides, not stored directly — don't add derived fields to persisted state.
- `src/components/` — grouped by feature area (`charts`, `table`, `rules`, `upload`, `layout`,
  `common`).
- `prototype/` — original single-file dashboard kept for visual reference; `prototype/data.js` (real
  statement data) is gitignored, don't commit real financial data anywhere in the repo.
- `e2e/fixtures/` — synthetic CSV fixtures ("Alex/Jamie Sample" data). Keep all committed fixtures
  synthetic.

## Commands

- `bun run dev` / `bun run build` / `bun run start`
- `bun run lint`, `bun run typecheck`, `bun run test`, `bun run test:coverage`
- `bun run e2e` — requires `bun run build` first (serves from `out/`)
- `bun run format`

## Conventions

- Testing trophy: most weight on `src/lib` unit tests and RTL integration tests wired to the real
  store; Playwright only for what needs a real browser (file inputs, canvas, reload persistence).
- No network calls, no analytics, no telemetry — privacy is a hard constraint of this app, not just
  a feature.
- CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests, build, e2e on every PR and push to
  `main`.
