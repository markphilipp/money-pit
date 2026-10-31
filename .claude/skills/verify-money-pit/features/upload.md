# Upload statements

Load one or more credit-card statement CSVs. Rows are parsed in the browser and merged. A row shared
by two exports appears once, but a row repeated inside one file is kept (`mergeRows` keeps the
highest per-file count of each row). Bad files are reported inline without blocking good ones.

## Sub-features

- First upload from the empty state's drop zone.
- Multi-file upload with overlap dedupe. `june.csv` + `july.csv` give 11 visible rows: 8 + 6, minus
  2 shared, minus the payment row, which is hidden by default.
- A bad file gets an inline `alert` naming the file, while other files still load. `broken.csv`
  gives "Unexpected columns. Expected a header row of …". Other messages are "The file is empty."
  and "No transactions found in this file."
- A later upload adds to existing rows, through the account menu's "Add statement". That input has
  its own alert, with a "Dismiss" button.
- Signed out, the empty state says "Without an account, nothing is uploaded…" and rows persist in
  sessionStorage. Signed in, it says "…saved to your account…". Rows are sent to the account
  (`appendDatasetRows`, in 2000-row chunks) and are not kept in sessionStorage. See
  [account-auth.md](account-auth.md).

## How to get to it (user POV)

- Open `/` with no data. The empty state says "Drop statement CSVs here". Drop files or click to pick.
- Once data is loaded, the account menu (avatar button, "Account menu") has an "Add statement" item.
  It opens the picker for the hidden input labelled "Add statement CSV files".

A native file picker can't be scripted, so drive each input with `setInputFiles`. **Target the input
you mean.** Both inputs are on every page, even the empty state, and the menu's comes first in the
DOM, so a bare `input[type=file]` hits "Add statement". Its errors show in the menu's fixed `alert`
with a Dismiss button, not in the drop zone's inline one.

## Driving it with drive.mjs

```js
import { expect } from '@playwright/test';
export default async ({ page, shot, fixture }) => {
  const count = page.getByRole('heading', { name: /Transactions/ });
  const zone = page.locator('label', { hasText: 'Drop statement CSVs here' }).locator('input');
  await page.goto('/');
  await expect(page.getByText(/Without an account, nothing is uploaded/)).toBeVisible();
  await shot('empty-state');
  await zone.setInputFiles([fixture('broken.csv')]);
  await expect(page.getByRole('alert').filter({ hasText: 'broken.csv' })).toContainText(
    'Unexpected columns',
  );
  await zone.setInputFiles([fixture('june.csv'), fixture('july.csv')]);
  await expect(count).toContainText('(11)');
  await expect(page.getByRole('row', { name: /LOWES/ })).toHaveCount(1);
  await expect(page.getByRole('row', { name: /ONLINE PAYMENT/ })).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(2);
  await shot('loaded-deduped');
  await page.getByLabel('Account menu').click();
  await expect(page.getByRole('menuitem', { name: 'Add statement' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByLabel('Add statement CSV files').setInputFiles([fixture('merchants.csv')]);
  await expect(count).toContainText('(14)');
  await page.reload();
  await expect(count).toContainText('(14)');
  await shot('after-reload');
};
```

Proof: the drop zone's own error, then the loaded table with overlap rows once and both charts,
then "Add statement" adding to it, then the same count after a reload.

## Gotchas

- Only `e2e/fixtures/*.csv` is committable test data, and it's synthetic (Alex and Jamie Sample).
  Never drive with real statements. `statements/` and other `*.csv` are gitignored for that reason.
- The payment row is hidden, so the count is one less than the parsed rows. The account's
  `statement_row` count includes it (`june.csv` → 7 shown, 8 stored).
- A fresh browser context starts empty when signed out. Persistence only shows up within one
  context across `reload()`. Signed in, a fresh context with the same account sees the rows.
