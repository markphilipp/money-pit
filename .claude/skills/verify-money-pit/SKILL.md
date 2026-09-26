---
name: verify-money-pit
description: Drive The Money Pit (money-pit Next.js spending dashboard) the way a user does and capture proof. Launches an isolated production server, drives the web UI with headless Playwright (upload CSVs, filter the table, recategorize, edit rules, account menu) and hits the /api/auth HTTP surface. Use to prove a UI or auth change works in the real app, not just in unit tests.
---

# Verify money-pit

The primary surface is the web UI at `/`, `/rules`, `/rules/new` and `/rules/[id]`. The secondary
surface is the Better Auth HTTP API at `/api/auth/*`. There is no sign-in UI yet. Signed-out, all
statement data lives in the browser's `sessionStorage` and never reaches the server.

Every helper lives in `.claude/skills/verify-money-pit/scripts/` and runs from the repo root. Each
takes a port (default `3310`). Use a different port per concurrent instance. `bun run e2e` owns
`3210`, and `bun run dev` owns `3000`.

## Launch

```bash
.claude/skills/verify-money-pit/scripts/start.sh 3310            # bun run build, then next start
.claude/skills/verify-money-pit/scripts/start.sh 3310 --no-build # reuse the current .next build
```

- It runs a **production** build (`next build` + `next start`), not `next dev`. `next.config.ts`
  sends the CSP and security headers only in production, so a dev server hides CSP breakage.
- It's ready when the script prints `ready: http://127.0.0.1:3310`. The script waits up to 60s for
  `/` to answer.
- State lives in `.verify/run-<port>/` (`pid`, `build.log`, `server.log`). `.verify/` is gitignored.
- The server reads the root `.env.local`, which is Vercel's Development pull. Its `DATABASE_URL`
  must point at the Neon **`dev`** branch. Never point a verification server at production's
  database. `/api/auth/*` needs that DB. The signed-out UI doesn't.
- **Isolation.** Instances on different ports are independent: separate processes, and a fresh
  browser context per drive, so sessionStorage isn't shared. They share the `.next` build output, so
  rebuild before launching several instances, never while one is running from it. They also share
  the `dev` database.

## Doctor

```bash
.claude/skills/verify-money-pit/scripts/doctor.sh 3310
```

This is read-only. It checks that:

- the recorded pid is alive, and the port's listener belongs to that process tree;
- `.next/BUILD_ID` is newer than every file in `src/`, otherwise the build is stale and doesn't
  contain your change;
- `/` returns 200 with a `Content-Security-Policy` header;
- `/api/auth/ok` returns `{"ok":true}`.

It also prints the redacted DB endpoint so you can confirm it's the `dev` branch. Run it first, and
again whenever anything looks off. It exits non-zero on any problem.

## Drive

Write a scenario module and run it through the harness:

```bash
node .claude/skills/verify-money-pit/scripts/drive.mjs path/to/scenario.mjs 3310
```

The scenario default-exports `async ({ page, shot, fixture, baseURL, log }) => {}`:

- `page` is a Playwright `Page` whose `baseURL` is the instance, so `page.goto('/')` works.
- `shot(label)` saves a full-page screenshot.
- `fixture(name)` resolves a synthetic CSV in `e2e/fixtures/`: `june.csv`, `july.csv`,
  `merchants.csv`, `broken.csv`.
- `log(msg)` appends to the run log.
- Throw, or use `expect` from `@playwright/test`, to fail the run.

Page `console.error` and uncaught errors are logged automatically. Put throwaway scenarios in
`.verify/scenarios/`.

These are the stable handles. They come from the app's ARIA labels and match `e2e/*.spec.ts`:

| What           | Handle                                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Upload         | `page.setInputFiles('input[type=file]', [...])`. The hidden input's label is "Add statement CSV files".                                                            |
| Empty state    | `getByText('Drop statement CSVs here')`                                                                                                                            |
| Row count      | `getByRole('heading', { name: /Transactions/ })` shows `(N)`                                                                                                       |
| A row          | `getByRole('row', { name: /MERCHANT/ })`                                                                                                                           |
| Column filters | `getByRole('button', { name: 'Person column menu' })`, same for `Amount`/`Date`/`Description`. Then e.g. `getByLabel('Amount filter value')`                       |
| Chart mode     | `getByRole('button', { name: 'Bars' })`, which carries `aria-pressed`                                                                                              |
| Reset filters  | `getByRole('button', { name: 'Reset' })`                                                                                                                           |
| Recategorize   | `row.getByTitle('Change category')`, then `getByPlaceholder('Search categories…')`, then `getByRole('dialog', { name: 'Choose category' }).getByRole('option', …)` |
| Rule from row  | Right-click the row, then `getByRole('menuitem', { name: 'Create rule from transaction' })`                                                                        |
| Account menu   | `getByLabel('Account menu')`, then `getByRole('menuitem', { name: 'Category rules…' })`                                                                            |
| Rules list     | `/rules`: heading "Category rules", `Edit <name>` / `Move <name> up` / `Move <name> down` / `Delete <name>`, and links "New rule" and "Done"                       |
| Rule editor    | `getByLabel('Category name')`, `getByTestId('value-editor')`, `getByRole('button', { name: 'Save rule' })`                                                         |
| Auth API       | `curl -s http://127.0.0.1:3310/api/auth/ok` and `/api/auth/get-session` (`null` when signed out)                                                                   |

Per-feature recipes are in `features/`. Read `features/README.md` and drive **every** entry point
the map lists for the feature you're proving, not just the convenient one.

## Evidence

Each drive writes `.verify/evidence/<timestamp>-<scenario>/`, with numbered screenshots plus
`log.txt`. The log ends in `RESULT: PASS` or `RESULT: FAIL <stack>`, and a failure screenshot is
taken automatically. Evidence survives cleanup.

Proof standards:

- **Drive the real user path.** Use clicks, file inputs, menus and URLs. Never call Zustand setters,
  write `sessionStorage` directly, or use test-only endpoints to fake a state.
- **Capture the action and the result.** Take a `shot` before the interaction and after it, and
  assert the changed state (row count, pill text, URL). Don't settle for a single final frame.
- **Verify side effects, not just pixels.**
  - Persistence: `page.reload()`, then assert the state survived. It's in sessionStorage today.
  - Rows written when signed in (future steps): query the `dev` branch.
  - Privacy: record `page.on('request')`. Signed-out flows must make no request carrying statement
    data. Only same-origin page, asset and RSC fetches are allowed.
- **Signed-in flows need a real session.** There is no sign-in UI yet. Mint a cookie the way
  `scripts/auth-session-check.ts` does, with Better Auth's `testUtils` on a test-only instance, then
  `context.addCookies`. Delete the test user afterwards.
- **No mocks** except at a production boundary. OAuth providers stay unreachable; don't fake them.

## Cleanup

```bash
.claude/skills/verify-money-pit/scripts/stop.sh 3310
```

This kills only the process tree whose pid `start.sh` recorded, then removes `.verify/run-<port>/`.
It never kills by process name, and if the port has a listener it didn't start, it leaves that alone
and exits non-zero. `.verify/evidence/` is kept. Also delete any test users a signed-in scenario
created, and any throwaway scenarios in `.verify/scenarios/` you no longer need. Run cleanup after
every failed attempt too.
