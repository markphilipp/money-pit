# Recategorize transactions

Override a row's category by hand. A manual category beats every rule, and it shows in the row's
category pill and in the category chart.

## Sub-features

- Single-row override from the pill.
- Searching the category list in the picker.
- Overrides persist across a reload.
- A rule edit can offer to clear manual categories ("Clear N manual category…" checkbox in the rule
  editor). See [rules.md](rules.md).

## How to get to it (user POV)

Upload a statement. Every row has a category pill (title "Change category"). Clicking it opens the
"Choose category" dialog, which has a search box.

## Driving it with drive.mjs

```js
import { expect } from '@playwright/test';
export default async ({ page, shot, fixture }) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', [fixture('june.csv')]);
  const row = page.getByRole('row', { name: /DUKE-ENERGY/ });
  const pill = row.getByTitle('Change category');
  await shot('before');
  await pill.click();
  await page.getByPlaceholder('Search categories…').fill('home');
  await page
    .getByRole('dialog', { name: 'Choose category' })
    .getByRole('option', { name: /Home Improvement/ })
    .click();
  await expect(pill).toContainText('Home Improvement');
  await shot('after');
  await page.reload();
  await expect(
    page.getByRole('row', { name: /DUKE-ENERGY/ }).getByTitle('Change category'),
  ).toContainText('Home Improvement');
  await shot('after-reload');
};
```

Proof: the pill text changes, and it's still the new category after a reload.

## Gotchas

- Override ids are derived by hashing row fields. Re-uploading the same file keeps them, but a
  different export of the same transaction may not match. See `docs/data-model.md`.
