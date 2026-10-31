# Account and auth

The avatar "Account menu" holds upload, reset, categories, rules and sign-in. Better Auth serves
`/api/auth/*` on the same origin. Signed out, the menu's "Sign in…" is an enabled link to
`/sign-in`. Signed in, it shows "Sign out" and "Delete account…" instead.

## Sub-features

- **Account menu, empty state:** "Categories…", "Category rules…" and "Sign in…". No "Add
  statement" or "Start over" until there is data.
- **Account menu, with data:** also "Add statement" and "Start over". "Start over" opens an
  alertdialog titled "Start over?" with Cancel and a "Start over" button. Cancel keeps every row.
  Confirming clears rows, rule edits and overrides (`resetAll`) and lands on the empty state.
- **`/sign-in`:** heading "Sign in", one "Continue with <provider>" button per provider (Google and
  GitHub), links to `/terms` and `/privacy`, a privacy note, and a "Back to the dashboard" link.
  Without OAuth creds a provider click shows a `role="alert"` reading "<Provider> sign-in isn't set
  up yet." and the buttons re-enable.
- **`/privacy`, `/terms`:** static pages, 200.
- **Signed in** (needs a minted cookie, see SKILL.md): a `role="status"` save toast reports saving,
  `/sign-in` redirects to `/`, and signing in on a tab that holds signed-out rows asks "Save this
  session's statements to your account?" (Discard / Save to my account).
- **`GET /api/auth/ok`** returns `{"ok":true}`.
- **`GET /api/auth/get-session`** returns `null` without a cookie. With a valid session cookie it
  returns the user. `name` and `image` are empty by the no-PII rule.
- **Social sign-in:** `POST /api/auth/sign-in/social` returns 404 "Provider not found" until the
  OAuth creds (`GOOGLE_*`, `GITHUB_*`) are set.
- **Stored provider tokens** (`idToken`, `accessToken`, `refreshToken`) are always null in `account`.

## How to get to it (user POV)

The avatar button at the top right of every page. "Sign in…" leads to `/sign-in`, which can also be
opened directly. The API itself isn't user-facing.

## Driving it with drive.mjs

```js
import { expect } from '@playwright/test';
export default async ({ page, shot, fixture, baseURL, log }) => {
  await page.goto('/');
  await page.getByLabel('Account menu').click();
  await expect(page.getByRole('menuitem', { name: 'Categories…' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Category rules…' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Start over' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Sign out' })).toHaveCount(0);
  await shot('account-menu');
  await page.getByRole('menuitem', { name: 'Sign in…' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Continue with / }).first()).toBeVisible();
  await shot('sign-in');
  const ok = await page.request.get(`${baseURL}/api/auth/ok`);
  expect(await ok.json()).toEqual({ ok: true });
  const session = await page.request.get(`${baseURL}/api/auth/get-session`);
  expect(await session.json()).toBeNull();

  await page.goto('/');
  await page.setInputFiles('input[type=file]', [fixture('june.csv')]);
  const count = page.getByRole('heading', { name: /Transactions/ });
  await expect(count).toContainText('(7)');
  await page.getByLabel('Account menu').click();
  await page.getByRole('menuitem', { name: 'Start over' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await shot('start-over-dialog');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(count).toContainText('(7)');

  await page.getByLabel('Account menu').click();
  await page.getByRole('menuitem', { name: 'Start over' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Start over' }).click();
  await expect(page.getByText('Drop statement CSVs here')).toBeVisible();
  await shot('after-start-over');
  for (const path of ['/privacy', '/terms']) {
    expect((await page.request.get(`${baseURL}${path}`)).status()).toBe(200);
  }
};
```

The Continue buttons start a real OAuth redirect, so the scenario only asserts they render. For a
signed-in session and the token-stripping check, run `bun run auth:check`. It exercises the
real `getAuth()` against the `dev` DB and deletes its test user.

## Gotchas

- `/api/auth/*` needs `DATABASE_URL` and `BETTER_AUTH_SECRET` in `.env.local`. The UI works
  without them.
- OAuth callbacks only work on `http://localhost:3000` and production. A verification server on
  another port can't complete a real provider login, so use `testUtils` cookies instead (see SKILL.md).
- Signed-in Start over wipes the account's rows and resets its categories and rules but keeps the
  account. "Delete account…" is the one that removes it.
