# Uploaded files (datasets)

**Entry points.** Account menu "Uploaded files…" (always shown), then `/datasets` directly. The page
also holds its own drop zone for adding files.

**Drive (signed out).**

1. Upload `june.csv` and `july.csv` on `/`: the heading shows `(11)`. They overlap on LOWES and SPOTIFY.
2. Account menu → "Uploaded files…". Each row shows its file name, count and date range; each Remove
   button is named `Remove <file>`.
3. `Remove june.csv` → the alertdialog reads "Removes 6 transactions. 2 more also appear in other
   files and stay." "Cancel" closes it with both files still listed. Open it again → "Remove file".
4. The "Done" link → heading `(6)`, LOWES and SPOTIFY rows still present, DUKE-ENERGY gone.
5. Reload: still `(6)`. `sessionStorage['money-pit'].state` holds `datasets` (one, `july.csv`) and no `rawRows`.
6. Remove `july.csv` (dialog says it is the only file) → empty state, and `/rules` still lists the rules.

```js
import { expect } from '@playwright/test';
export default async ({ page, shot, fixture, log }) => {
  const requests = [];
  page.on('request', (r) => requests.push(r));
  const heading = (n) =>
    expect(
      page.getByRole('heading', { name: new RegExp(`Transactions \\(${n}\\)`) }),
    ).toBeVisible();
  await page.goto('/');
  await page.setInputFiles('input[type=file]', [fixture('june.csv'), fixture('july.csv')]);
  await heading(11);
  await page.getByLabel('Account menu').click();
  await page.getByRole('menuitem', { name: 'Uploaded files…' }).click();
  await expect(page).toHaveURL(/\/datasets$/);
  await expect(page.getByText('Drop more statement CSVs here')).toBeVisible();
  await shot('datasets-list');
  await page.getByRole('button', { name: 'Remove june.csv' }).click();
  await expect(page.getByRole('alertdialog')).toContainText(
    'Removes 6 transactions. 2 more also appear in other files and stay.',
  );
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Remove june.csv' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove june.csv' }).click();
  await page.getByRole('button', { name: 'Remove file' }).click();
  await page.getByRole('link', { name: 'Done' }).click();
  await heading(6);
  await expect(page.getByRole('row', { name: /LOWES/ })).toHaveCount(1);
  await expect(page.getByRole('row', { name: /DUKE-ENERGY/ })).toHaveCount(0);
  await page.reload();
  await heading(6);
  const state = await page.evaluate(() => JSON.parse(sessionStorage['money-pit']).state);
  expect(state.datasets.map((d) => d.name)).toEqual(['july.csv']);
  expect(state.rawRows).toBeUndefined();
  await page.goto('/datasets');
  await page.getByRole('button', { name: 'Remove july.csv' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('only file');
  await page.getByRole('button', { name: 'Remove file' }).click();
  await expect(page.getByText('No files uploaded yet.')).toBeVisible();
  await page.goto('/rules');
  await expect(page.getByRole('link', { name: /Edit Home Improvement/ })).toBeVisible();
  const origin = new URL(page.url()).origin;
  expect(requests.filter((r) => !r.url().startsWith(origin))).toEqual([]);
  expect(requests.filter((r) => r.method() === 'POST')).toEqual([]);
  await shot('after-remove-all');
};
```

**Proves.** Removal is exact for overlapping files, persists across reload, and removing the last file
resets data but not categories or rules. Privacy: no external requests and no POSTs.

**Drive (signed in).** Run with `--signed-in`. Removing a file, adding a category and dismissing a
suggestion all reach the account, and a reload still shows the account's files:

```js
import { expect } from '@playwright/test';
export default async ({ page, shot, fixture, account }) => {
  await account.signIn();
  await page.goto('/');
  await expect(page.getByText('Drop statement CSVs here')).toBeVisible();
  await page.setInputFiles('input[type=file]', [fixture('june.csv'), fixture('july.csv')]);
  await expect(page.getByRole('heading', { name: /Transactions \(11\)/ })).toBeVisible();
  await expect
    .poll(() => account.state().datasets.map((d) => d.name))
    .toEqual(['june.csv', 'july.csv']);
  await expect.poll(() => account.state().rows).toBe(12);

  await page.setInputFiles('input[type=file]', [fixture('suggestions-a.csv')]);
  await page.getByRole('button', { name: /rule suggestion/ }).click();
  await page
    .getByRole('button', { name: /^Dismiss/ })
    .first()
    .click();
  await expect.poll(() => account.state().preference?.dismissedSuggestions.length).toBe(1);

  await page.goto('/datasets');
  await page.getByRole('button', { name: 'Remove june.csv' }).click();
  await page.getByRole('button', { name: 'Remove file' }).click();
  await expect
    .poll(() => account.state().datasets.map((d) => d.name))
    .toEqual(['july.csv', 'suggestions-a.csv']);
  await expect.poll(() => account.state().rows).toBeLessThan(12 + 5);

  await page.goto('/categories');
  await page.getByLabel('New category', { exact: true }).fill('Trips');
  await page.getByRole('button', { name: 'Add category' }).click();
  await expect.poll(() => account.state().categories.some((c) => c.name === 'Trips')).toBe(true);

  await page.reload();
  await page.goto('/datasets');
  await expect(page.getByRole('button', { name: 'Remove july.csv' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove june.csv' })).toHaveCount(0);
  const stored = await page.evaluate(() => JSON.parse(sessionStorage['money-pit']).state);
  expect(Object.keys(stored).sort()).toEqual(['filters', 'ruleSources']);
  await shot('signed-in-after-reload');
};
```
