# Upload statements

Load one or more credit-card statement CSVs. Rows are parsed in the browser, merged, and deduped:
an overlapping row shared by two exports appears once. Bad files are reported inline without
blocking good ones.

## Sub-features

- First upload from the empty state.
- Multi-file upload with overlap dedupe. `june.csv` + `july.csv` give 11 visible rows: 8 + 6, minus
  2 shared, minus the payment row, which is hidden by default.
- A bad file gets an inline `alert` naming the file, while other files still load.
- A later upload adds to existing rows, through the same file input.

## How to get to it (user POV)

- Open `/` with no data. The empty state says "Drop statement CSVs here". Drop files or click to pick.
- Once data is loaded, the account menu (avatar button, "Account menu") has an "Add statement" item.
  It opens the picker for the hidden input labelled "Add statement CSV files". Drive that input
  directly with `setInputFiles`, because a native file picker can't be scripted.

## Driving it with drive.mjs

```js
import { expect } from '@playwright/test';
export default async ({ page, shot, fixture }) => {
  await page.goto('/');
  await expect(page.getByText('Drop statement CSVs here')).toBeVisible();
  await shot('empty-state');
  await page.setInputFiles('input[type=file]', [fixture('june.csv'), fixture('july.csv')]);
  await expect(page.getByRole('heading', { name: /Transactions/ })).toContainText('(11)');
  await expect(page.getByRole('row', { name: /LOWES/ })).toHaveCount(1);
  await expect(page.locator('canvas')).toHaveCount(2);
  await shot('loaded-deduped');
  await page.reload();
  await expect(page.getByRole('heading', { name: /Transactions/ })).toContainText('(11)');
  await shot('after-reload');
};
```

Proof: the empty state, then the loaded table with its count, with overlap rows appearing once and
both charts rendered, then the same count after a reload (sessionStorage persistence).

## Gotchas

- Only `e2e/fixtures/*.csv` is committable test data, and it's synthetic (Alex and Jamie Sample).
  Never drive with real statements. `statements/` and other `*.csv` are gitignored for that reason.
- The payment row is hidden by default, so the count is one less than the parsed rows.
- A fresh browser context starts empty. Persistence only shows up within one context across
  `reload()`.
