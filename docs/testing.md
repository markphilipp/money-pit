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

`afterEach` runs `cleanup()`, resets the router spies and clears `sessionStorage`, so tests don't
leak state into each other. Environment is jsdom with globals on; `@/` resolves to `src/`.

`next/navigation` and `next/link` are stubbed globally in `vitest.setup.ts` — the App Router hooks
need a router context that only exists inside a running Next app. Assert navigation against
`routerMock.push` from `src/test/router.ts`; real navigation is Playwright's job.

`resetStore()` awaits `persist.rehydrate()`, so components render past the `useHydrated()` gate as
they would on the app's second paint. `beforeEach` must await it.

## Auth session check — `bun run auth:check`

`scripts/auth-session-check.ts` runs against the Neon branch in `.env.local`, not in vitest. It
builds a test-only instance with Better Auth's `testUtils` plugin (kept out of `src/auth`, so the
privileged helpers never ship), saves a throwaway user, signs a session cookie, and asserts the real
`getAuth().api.getSession` reads that user back and returns `null` for a forged signature or an
unknown token. `saveUser` goes through the same `databaseHooks` as an OAuth sign-up, so the script
also asserts the user was seeded with `defaultRules` in order. The user is deleted in `finally`,
and the script checks the delete cascaded to its rules. It lives outside `bun run test` because CI has no
database and unit runs must stay hermetic.

## Playwright — `playwright.config.ts`

Chromium only. Specs run against `next start` on port 3210, so **`bun run build` must run first**.
Existing specs cover the empty state, multi-file upload with overlap dedupe, inline per-file errors,
column-menu filtering + reload persistence, recategorizing from a pill, creating a rule from a row,
inducing a merchant rule from several selected rows (`merchants.csv` — three stores of one synthetic
merchant), managing rules on `/rules`, editing a rule on its own URL and returning through browser
history, the 404 status for an unknown URL, and bulk selection.

Routing assertions belong here, not in the unit tests: this is the only layer running a real
router.

`testDir: './e2e'` is the only scoping. Do not add a `testIgnore` for `**/.worktrees/**` —
Playwright matches those against absolute paths, so a checkout that itself sits under `.worktrees/`
would silently discover zero tests.
