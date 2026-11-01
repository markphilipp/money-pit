---
name: verify-money-pit
description: Drive The Money Pit (money-pit Next.js spending dashboard) the way a user does and capture proof. Launches an isolated production server, drives the web UI with headless Playwright (upload CSVs, filter the table, recategorize, edit rules, account menu, sign-in, account sync, delete account) signed out or with a minted signed-in session, and checks what the dev database stored. Use to prove a UI, sync or auth change works in the real app, not just in unit tests.
---

# Verify money-pit

The primary surface is the web UI at `/`, `/settings/rules`, `/settings/rules/new`, `/settings/rules/[id]`, `/sign-in`,
`/privacy` and `/terms`. The secondary surfaces are the Better Auth HTTP API at `/api/auth/*` and
what a signed-in session writes to the `dev` database. Signed out, all statement data lives in the
browser's `sessionStorage` and never reaches the server. Signed in, it's saved to the account and
sessionStorage keeps only filters.

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
- It overrides `BETTER_AUTH_URL` to `http://127.0.0.1:<port>`. `.env.local` points it at the dev
  server's `localhost:3000`, and Better Auth answers 403 to sign-out and other auth POSTs from any
  other origin.
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
node .claude/skills/verify-money-pit/scripts/drive.mjs path/to/scenario.mjs 3310 --signed-in
```

The scenario default-exports
`async ({ page, context, browser, shot, fixture, baseURL, log, account }) => {}`:

- `page` is a Playwright `Page` whose `baseURL` is the instance, so `page.goto('/')` works.
  `context` is its browser context, and `browser` can open a second one.
- `shot(label)` saves a full-page screenshot.
- `fixture(name)` resolves a synthetic CSV in `e2e/fixtures/`: `june.csv`, `july.csv`,
  `merchants.csv`, `broken.csv`, `suggestions-a.csv`, `suggestions-b.csv`.
- `log(msg)` appends to the run log.
- `account` exists only with `--signed-in`. The harness mints a throwaway `dev` user
  (`verify-<uuid>@example.test`) before the scenario and deletes it afterwards, pass or fail.
  - `account.signIn(ctx = context)` adds a session cookie. The scenario decides when, so it can
    upload signed out first to reach the claim dialog. Each call after the first mints a new
    session, because signing out deletes the old one.
  - `account.state()` returns what the `dev` DB holds for the user: `exists`, `rows`, `overrides`,
    `datasets`, `categories` and `rules` (each in order), `preference` (with `dismissedSuggestions`)
    and `sessions` (with `ipAddress`/`userAgent`).
  - `account.userId`.
- Throw, or use `expect` from `@playwright/test`, to fail the run.

The account helpers come from `scripts/session.ts` (bun, reads `.env.local`):
`mint | cookies <userId> | state <userId> | delete <userId> | cleanup`. It mints through Better
Auth's `testUtils`, the same way `e2e/account.ts` does, so no OAuth provider is involved.

Page `console.error` and uncaught errors are logged automatically. Put throwaway scenarios in
`.verify/scenarios/`.

These are the stable handles. They come from the app's ARIA labels and match `e2e/*.spec.ts`:

| What           | Handle                                                                                                                                                                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Upload (empty) | `page.locator('label', { hasText: 'Drop statement CSVs here' }).locator('input').setInputFiles([...])`. A bare `input[type=file]` hits the menu's input instead.                                                                                                                     |
| Upload (menu)  | `getByLabel('Add statement CSV files').setInputFiles([...])`, the input behind "Add statement"                                                                                                                                                                                       |
| Empty state    | `getByText('Drop statement CSVs here')`; signed out `getByText(/Without an account/)`, signed in `getByText(/saved to your account/)`                                                                                                                                                |
| Row count      | `getByRole('heading', { name: /Transactions/ })` shows `(N)`                                                                                                                                                                                                                         |
| A row          | `getByRole('row', { name: /MERCHANT/ })`                                                                                                                                                                                                                                             |
| Column filters | `getByRole('button', { name: 'Person column menu' })`, same for `Amount`/`Date`/`Description`/`Category`. Then e.g. `getByLabel('Amount filter value')`, `getByRole('menuitem', { name: 'Sort ascending' })`                                                                         |
| Bulk selection | `getByRole('checkbox', { name: 'Select all visible rows' })` or `/Select LOWES/`, then the `getByRole('group', { name: 'Selection actions' })` bar's "Change category" / "Create rule" buttons                                                                                       |
| Chart mode     | `getByRole('group', { name: 'Category chart type' }).getByRole('button', { name: 'Bars' })` (or `Person chart type`), which carries `aria-pressed`. Unscoped matches two.                                                                                                            |
| Reset filters  | `getByRole('button', { name: 'Reset' })`                                                                                                                                                                                                                                             |
| Recategorize   | `row.getByTitle('Change category')` (or right-click "Change category…", or the "Selection actions" group), then `getByPlaceholder('Search categories…')`, then `getByRole('dialog', { name: 'Choose category' }).getByRole('option', …)`                                             |
| Rule from row  | Right-click the row, then `getByRole('menuitem', { name: 'Create rule from transaction' })`                                                                                                                                                                                          |
| Account menu   | `getByLabel('Account menu')`, then menuitems "Settings…" (lands on `/settings/rules`; also "Keyboard shortcuts"), "Add statement", "Start over" → `getByRole('alertdialog')` button "Start over", "Sign in…", "Sign out", "Delete account…" → alertdialog button "Delete my account" |
| Settings nav   | `getByRole('navigation', { name: 'Settings' })` links "Uploaded files" / "Categories" / "Rules" (`aria-current="page"` on the current one); exit with the `← Dashboard` link                                                                                                         |
| Categories     | `/settings/categories`: heading "Categories", `Rename <name>` / `Delete <name>`, `getByLabel('New category', { exact: true })` and "Add category"                                                                                                                                    |
| Suggestions    | `getByRole('button', { name: /rule suggestions? for Other/ })`, then `Create rule for <label>` / `Dismiss <label>`                                                                                                                                                                   |
| Claim dialog   | `getByRole('dialog', { name: /Save this session’s statements/ })`, buttons "Save to my account" and "Discard"                                                                                                                                                                        |
| Sign-in page   | `/sign-in`: buttons "Continue with Google" / "Continue with GitHub"                                                                                                                                                                                                                  |
| Rules list     | `/settings/rules`: h2 "Rules", links `Edit <name>` and "New rule", buttons `Move <name> up` / `Move <name> down` / `Delete <name>` (disabled for the builtin)                                                                                                                        |
| Rule editor    | `getByLabel('Category name')`, `getByTestId('value-editor')`, then `getByRole('button', { name: 'Save rule' })` from rows or "Save" on `/settings/rules/<id>`                                                                                                                        |
| Legal pages    | `getByRole('contentinfo').getByRole('link', { name: 'Privacy' })` / `'Terms'`                                                                                                                                                                                                        |
| Auth API       | `curl -s http://127.0.0.1:3310/api/auth/ok` and `/api/auth/get-session` (`null` when signed out)                                                                                                                                                                                     |

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
  - Persistence: `page.reload()`, then assert the state survived. Signed out that proves
    sessionStorage. Signed in, also open a second context with `account.signIn(ctx)`, which proves
    the account.
  - Signed-in writes: poll `account.state()` until the rows, overrides, rules or preference land.
    Don't wait on `networkidle`: it resolves at once on an already-idle page, and a reload then
    aborts the queued write.
  - Privacy: record `page.on('request')`. Signed-out flows must make no request carrying statement
    data. Only same-origin page, asset and RSC fetches are allowed.
- **Signed-in flows need a real session.** Run with `--signed-in`. A real Google or GitHub login
  can't finish on a verification port (the providers only allow the `localhost:3000` and production
  callbacks), so the minted session is the way in. Minted users are named "Test User", because
  `testUtils` skips the OAuth profile mapping.
- **No mocks** except at a production boundary. OAuth providers stay unreachable; don't fake them.
  Proving the sign-in button reaches the provider with the right callback is fine
  (`page.route` the provider URL and abort it).

## Cleanup

```bash
.claude/skills/verify-money-pit/scripts/stop.sh 3310
```

This kills only the process tree whose pid `start.sh` recorded, then removes `.verify/run-<port>/`.
It never kills by process name, and if the port has a listener it didn't start, it leaves that alone
and exits non-zero. `.verify/evidence/` is kept. `drive.mjs --signed-in` deletes its own test user;
if a drive was killed before it could, run `bun .claude/skills/verify-money-pit/scripts/session.ts
cleanup`, which deletes every `verify-*` user. Also delete throwaway scenarios in
`.verify/scenarios/` you no longer need. Run cleanup after every failed attempt too.
