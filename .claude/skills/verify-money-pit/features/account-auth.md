# Account and auth

The avatar "Account menu" holds upload, reset, rules and sign-in. Better Auth serves `/api/auth/*` on the
same origin. Sign-in UI isn't built yet: the menu item reads "Sign in" with a "coming soon" tag and is disabled.

## Sub-features

- **Account menu, empty state:** "Category rules…" and a disabled "Sign in" item.
- **Account menu, with data:** also "Add statement" and "Start over". "Start over" turns into
  "Confirm reset", and picking that one clears all rows, rules edits and overrides (`resetAll`). It
  lands back on the empty state. Once signed-in sync exists, this deletes account data, so verify it
  asks for confirmation.
- **`GET /api/auth/ok`** returns `{"ok":true}`.
- **`GET /api/auth/get-session`** returns `null` without a cookie. With a valid session cookie it
  returns the user. `name` and `image` are empty by the no-PII rule.
- **Social sign-in:** `POST /api/auth/sign-in/social` returns 404 "Provider not found" until the
  OAuth creds (`GOOGLE_*`, `GITHUB_*`) are set.
- **Stored provider tokens** (`idToken`, `accessToken`, `refreshToken`) are always null in `account`.

## How to get to it (user POV)

The avatar button at the top right of every page. The API isn't user-facing yet; the sign-in UI
lands in plan step 6.

## Driving it with drive.mjs

```js
import { expect } from '@playwright/test';
export default async ({ page, shot, baseURL, log }) => {
  await page.goto('/');
  await page.getByLabel('Account menu').click();
  await expect(page.getByRole('menuitem', { name: /Sign in/ })).toBeDisabled();
  await shot('account-menu');
  const ok = await page.request.get(`${baseURL}/api/auth/ok`);
  log(`/api/auth/ok ${ok.status()} ${await ok.text()}`);
  expect(await ok.json()).toEqual({ ok: true });
  const session = await page.request.get(`${baseURL}/api/auth/get-session`);
  log(`/api/auth/get-session ${session.status()} ${await session.text()}`);
  expect(await session.json()).toBeNull();
};
```

For a signed-in session and the token-stripping check, run `bun run auth:check`. It exercises the
real `getAuth()` against the `dev` DB and deletes its test user.

## Gotchas

- `/api/auth/*` needs `DATABASE_URL` and `BETTER_AUTH_SECRET` in `.env.local`. The UI works
  without them.
- OAuth callbacks only work on `http://localhost:3000` and production. A verification server on
  another port can't complete a real provider login, so use `testUtils` cookies instead (see SKILL.md).
