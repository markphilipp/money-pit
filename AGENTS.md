# AGENTS.md

## What this is

money-pit ("The Money Pit"): a client-only spending dashboard. Upload credit-card statement CSVs,
auto-categorize them with rules, chart by category/cardholder, correct rows by hand. Next renders
and routes; every byte of statement data stays in the browser, in `sessionStorage`, and the server
never sees any of it. This file and `docs/` are
the source of truth — `README.md` is an intentionally bare placeholder while the app is still
changing shape, so don't mine it for detail or expand it without being asked.

## Stack

Next.js 16 App Router, server-rendered on Vercel, React 19, Zustand,
CSS Modules over tokens in `src/app/globals.css`. Routes are real routes — `/`, `/rules`,
`/rules/new`, `/rules/[id]` — not screens swapped by store state. Chart.js 4 via react-chartjs-2, TanStack Table v8,
react-querybuilder, Radix UI. Vitest + React Testing Library, Playwright for e2e. **bun** is the
package manager.

## Commands

```bash
bun run dev            # next dev
bun run build          # production build to .next/
bun run start          # next start
bun run lint           # eslint
bun run typecheck      # tsc --noEmit
bun run test           # vitest run  (also test:watch, test:coverage)
bun run e2e            # playwright — needs `bun run build` first, it runs `next start`
bun run format         # prettier
```

Use `bun` / `bunx`, never `npm` / `npx`. `package-lock.json`, `yarn.lock` and `pnpm-lock.yaml` are
gitignored on purpose — `bun.lock` is the only lockfile.

## Hard rules

- **No network calls, no analytics, no telemetry.** Privacy is a constraint of this app, not a
  feature. A change that sends statement data anywhere is wrong by definition. The server renders
  markup and nothing else — no statement data reaches it, there is no database, and the production
  CSP in `next.config.ts` pins `connect-src` to `'self'` so the browser enforces this too.
- **Never commit real financial data.** `statements/`, `*.csv` (except `e2e/fixtures/*.csv`) and
  `prototype/data.js` are gitignored. Every committed fixture uses synthetic "Alex/Jamie Sample"
  data.
- **Don't add derived fields to persisted state.** `Transaction[]` is derived from raw CSV rows +
  rules + overrides on read; only the raw inputs are persisted.
- Business rules belong in `src/lib/` (pure, no React), not in components.

## Layout

```
src/lib/          pure domain logic: CSV parsing, categorization, rule engine, ids, formatting
src/store/        Zustand store, selectors, React hooks
src/components/   by feature area: charts, table, rules, upload, layout, common
src/hooks/        shared React hooks (sticky-offset measurement)
src/app/          App Router routes (/, /rules, /rules/new, /rules/[id]), global tokens
e2e/              Playwright specs + synthetic CSV fixtures
prototype/        original single-file dashboard, kept for visual reference only
docs/             the sub-documents below
```

## Where to look

Read the doc for the area you're touching; skip the rest.

| Doc                                          | Read it when                                                                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| [docs/architecture.md](docs/architecture.md) | Touching `src/store/`, adding state, wiring a component to data, or wondering why something re-renders or fails to persist.                       |
| [docs/data-model.md](docs/data-model.md)     | Touching `src/lib/` — CSV format, dedupe on re-upload, transaction ids, categorization precedence, the rule/filter condition engine.              |
| [docs/ui.md](docs/ui.md)                     | Touching `src/components/` or `src/app/` — component map, the sticky charts/header layout, charts, table, rules UI, styling tokens, brand assets. |
| [docs/testing.md](docs/testing.md)           | Writing or fixing tests, or deciding which layer a test belongs in.                                                                               |
| [docs/tooling.md](docs/tooling.md)           | Touching config, CI, deploy, or working inside a git worktree.                                                                                    |
