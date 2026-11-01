# Account, sign-in and sync

Accounts are optional. Signed out, everything stays in the tab. Signing in (Google or GitHub, via
Better Auth on `/api/auth/*`) saves statements, rules, overrides, chart modes and sort to the account
in Postgres. Every local server uses the `dev` branch. The only personal data kept is the email.

## Sub-features

- **Account menu** ("Account menu" avatar, top right of every page):
  - always: "Settings…" and "Keyboard shortcuts";
  - with data (none of these on the empty state): "Add statement", and "Start over". "Start over"
    opens an alertdialog titled "Start over?" with "Cancel" and a "Start over" button. Cancel keeps
    every row. Confirming clears rows, rule edits and overrides (`resetAll`) and lands on the empty
    state. Signed in, it also wipes the account's rows and resets its categories, rules and
    preference, but keeps the account;
  - signed out: "Sign in…", an enabled link to `/sign-in`;
  - signed in: "Sign out", and "Delete account…" → alertdialog "Delete your account?" with "Cancel"
    and "Delete my account", which deletes the user (everything cascades) and signs out. Failures
    show an alert: "Couldn’t sign out, so you’re still signed in. Try again." or "Couldn’t delete your account. Try again."
- **`/sign-in`**: heading "Sign in", "Continue with Google" / "Continue with GitHub", a line linking
  the terms and the privacy policy, a privacy note, and "Back to the dashboard". A provider without
  credentials answers 404 and the page says "<Provider> sign-in isn’t set up yet.", and the buttons
  re-enable. A signed-in visitor is redirected to `/`.
- **Claim dialog**: signing in with rows still in the tab opens "Save this session’s statements to
  your account?", with "Save to my account" (focused, so Enter saves) and "Discard". Escape and
  outside clicks don't close it. Chart modes and sort carry over unless they're still the defaults.
- **Sync**: after the account snapshot loads, every change is queued to a server action
  (`createDataset`/`appendDatasetRows`/`removeDataset`, `setOverrides`, `replaceCategories`,
  `setPreference`; `loadSnapshot` and `claimLocal` run once at sign-in). A `role="status"` save
  toast reports "Saving…" and "Saved". A failed write reads "Couldn’t save. Retrying (n of 3)…",
  then "Couldn’t save. Your last change was undone." (Dismiss) or "Couldn’t save, and your account
  is unreachable." (Reload). sessionStorage keeps only `filters` and `ruleSources`.
- **Empty state copy**: signed out "Without an account, nothing is uploaded…", signed in "…saved
  to your account…".
- **What's stored**: user `name`/`image` empty for OAuth sign-ups, provider tokens (`idToken`,
  `accessToken`, `refreshToken`) null, session `ipAddress`/`userAgent` null (`bun run auth:check`
  asserts all of it).
- **`/api/auth`**: `GET /ok` → `{"ok":true}`; `GET /get-session` → `null` without a cookie, or the
  session; `POST /sign-in/social` → a provider redirect URL, or 404 "Provider not found" until that
  provider's OAuth creds (`GOOGLE_*`, `GITHUB_*`) are set.
- **Footer**: "Privacy" → `/privacy` ("Privacy policy"), "Terms" → `/terms` ("Terms of service").
  Both are static pages that answer 200.

## How to get to it (user POV)

The avatar button on every page, the "Sign in…" item, and the footer links. A real Google or GitHub
login can't be scripted here (see Gotchas), so signed-in drives use a minted session.

## Driving it with drive.mjs

Run with `--signed-in` (see SKILL.md): the harness mints a throwaway user, and `account.signIn()`
adds a fresh session for it whenever the scenario calls it.

```js
import { expect } from '@playwright/test';
export default async ({ page, browser, baseURL, shot, fixture, log, account }) => {
  const bodies = [];
  page.on('request', (r) => r.postData() && bodies.push(r.postData()));
  const signedOut = page.getByText(/Without an account, nothing is uploaded/);
  const menu = (name) => page.getByRole('menuitem', { name });
  const bars = page
    .getByRole('group', { name: 'Category chart type' })
    .getByRole('button', { name: 'Bars' });
  const confirm = (name) => page.getByRole('alertdialog').getByRole('button', { name });
  await page.goto('/');
  await expect(signedOut).toBeVisible();
  await page.getByLabel('Account menu').click();
  await expect(menu('Settings…')).toBeVisible();
  await expect(menu('Sign in…')).toBeEnabled();
  await expect(menu('Sign out')).toHaveCount(0);
  await shot('menu-signed-out');
  await page.keyboard.press('Escape');
  await page
    .locator('label', { hasText: 'Drop statement CSVs here' })
    .locator('input')
    .setInputFiles([fixture('june.csv')]);
  await expect(page.getByRole('heading', { name: /Transactions/ })).toContainText('(7)');
  await bars.click();
  expect(bodies.filter((b) => /DUKE|LOWES/.test(b))).toEqual([]);
  const ok = await page.request.get(`${baseURL}/api/auth/ok`);
  expect(await ok.json()).toEqual({ ok: true });
  expect(await (await page.request.get(`${baseURL}/api/auth/get-session`)).json()).toBeNull();

  await page.getByLabel('Account menu').click();
  await menu('Sign in…').click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: 'terms' })).toHaveAttribute(
    'href',
    '/terms',
  );
  let authorize;
  await page.route('https://accounts.google.com/**', (r) => {
    authorize = new URL(r.request().url());
    return r.abort();
  });
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect
    .poll(() => authorize?.searchParams.get('redirect_uri'))
    .toContain('/callback/google');
  await shot('sign-in');

  await account.signIn();
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: /Save this session’s statements/ });
  await expect(dialog.getByRole('button', { name: 'Save to my account' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await shot('claim-dialog');
  await page.keyboard.press('Enter');
  await expect(bars).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => account.state().rows).toBe(8);
  const stored = account.state();
  log(
    `preference ${JSON.stringify(stored.preference)} sessions ${JSON.stringify(stored.sessions)}`,
  );
  expect(stored.preference.chartMode).toBe('bar');
  expect(stored.sessions.every((s) => !s.ipAddress && !s.userAgent)).toBe(true);
  const kept = await page.evaluate(() => sessionStorage.getItem('money-pit'));
  expect(Object.keys(JSON.parse(kept).state).sort()).toEqual(['filters', 'ruleSources']);

  await page.goto('/sign-in');
  await expect(page).toHaveURL(/\/$/);
  const fresh = await browser.newContext({ baseURL });
  await account.signIn(fresh);
  const other = await fresh.newPage();
  await other.goto('/');
  await expect(other.getByRole('heading', { name: /Transactions/ })).toContainText('(7)');
  await fresh.close();

  await page.getByLabel('Account menu').click();
  await shot('menu-signed-in');
  await menu('Start over').click();
  await shot('start-over-dialog');
  await confirm('Cancel').click();
  await expect(page.getByRole('heading', { name: /Transactions/ })).toContainText('(7)');
  await page.getByLabel('Account menu').click();
  await menu('Start over').click();
  await confirm('Start over').click();
  await expect.poll(() => account.state().rows).toBe(0);
  await page.reload();
  await expect(page.getByText(/saved to your account/)).toBeVisible();
  await page.getByLabel('Account menu').click();
  await menu('Sign out').click();
  await expect(signedOut).toBeVisible();

  await account.signIn();
  await page.goto('/');
  await page.getByLabel('Account menu').click();
  await menu('Delete account…').click();
  await confirm('Delete my account').click();
  await expect(signedOut).toBeVisible();
  expect(account.state().exists).toBe(false);
  await shot('deleted');

  await page.getByRole('contentinfo').getByRole('link', { name: 'Privacy' }).click();
  await expect(page.getByRole('heading', { name: 'Deleting your data' })).toBeVisible();
  await page.getByRole('contentinfo').getByRole('link', { name: 'Terms' }).click();
  await expect(page.getByRole('heading', { name: 'Terms of service' })).toBeVisible();
};
```

Proof: no statement data in any signed-out request, the sign-in page reaching Google with this
server's callback, the claim landing 8 rows and the `bar` preference in the account, a second
browser seeing the same data, Start over keeping the account (and Cancel keeping the rows), Sign
out, and Delete account removing the user.

## Gotchas

- `/api/auth/*` needs `DATABASE_URL` and `BETTER_AUTH_SECRET` in `.env.local`. The signed-out UI
  works without them.
- The verification server only works for sign-out, delete and every other auth POST because
  `start.sh` sets `BETTER_AUTH_URL` to its own origin. Better Auth rejects any other origin with 403.
- A real OAuth login can't finish on a verification port: the providers only allow the
  `localhost:3000` and production callbacks. That's also why a minted session is the way in.
- Minted users come from `testUtils`, which skips the OAuth profile mapping, so their name is "Test
  User". Check the empty-name rule after a real sign-in, not on a minted user.
- Don't wait for a write with `networkidle`. Poll `account.state()` instead.
- `bun run auth:check` covers the stored-data rules against a real `getAuth()`, and
  `bun run e2e:signed-in` runs the Playwright versions of these flows.
