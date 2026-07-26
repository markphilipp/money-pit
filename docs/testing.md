# Testing

## Where a test belongs

Testing trophy, weighted like this:

1. **Unit (`src/lib/*.test.ts`)** — parsing, dedupe, hashing, categorization, the rule engine,
   formatting. Cheap and exhaustive; any new business rule gets its cases here.
2. **Integration (RTL, `*.test.tsx`)** — the bulk of the confidence. Render the real component
   against the **real store**; don't mock the store or the selectors. If a test needs a mocked
   store to pass, the component is probably reaching for state it shouldn't.
3. **E2E (`e2e/*.spec.ts`)** — only what needs a real browser: file inputs, canvas rendering,
   reload persistence.

Coverage is collected for `src/lib/**` and `src/store/**` only (`bun run test:coverage`).

## Fixtures — `src/test/fixtures.ts`

`SAMPLE_CSV` / `SECOND_CSV` (which overlaps `SAMPLE_CSV` by one row, for dedupe tests), `csvFile()`,
`seedStore()` and `resetStore()`. Prefer seeding through `uploadFiles` over hand-building store
state — it exercises the real parse/merge path.

All fixture data is synthetic "Alex/Jamie Sample". Never paste a real statement into a test, and
never commit a CSV outside `e2e/fixtures/`.

## Vitest setup — `vitest.setup.ts`

jsdom is missing two things the app uses; both are shimmed there:

- `Blob.prototype.text` — used by `uploadFiles`.
- `ResizeObserver` — a no-op class is enough, `useHeightVar` only needs it to exist.

`afterEach` runs `cleanup()` and clears `sessionStorage`, so tests don't leak persisted state into
each other. Environment is jsdom with globals on; `@/` resolves to `src/`.

## Playwright — `playwright.config.ts`

Chromium only. Specs run against the static export served from `out/` on port 3210, so
**`bun run build` must run first**. Existing specs cover the empty state, multi-file upload with
overlap dedupe, inline per-file errors, column-menu filtering + reload persistence, recategorizing
from a pill, creating a rule from a row, inducing a merchant rule from several selected rows
(`merchants.csv` — three stores of one synthetic merchant), managing rules from the account menu,
and bulk selection.

`testDir: './e2e'` is the only scoping. Do not add a `testIgnore` for `**/.worktrees/**` —
Playwright matches those against absolute paths, so a checkout that itself sits under `.worktrees/`
would silently discover zero tests.
