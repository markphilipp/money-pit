# Recategorize transactions

Override a row's category by hand. A manual category beats every rule, and it shows in the row's
category pill and in the category chart.

## Sub-features

- Override from the pill, from the row context menu ("Change category…"), or from the selection
  bar's "Change category" button (bulk).
- The picker lists categories alphabetically and never offers Payments.
- Searching the picker. A search with no match offers `Create category “<query>”`, which adds the
  category and files the targeted rows under it (Enter does the same). Payments is hidden, so
  searching it offers nothing.
- The picker's search box has focus on open, from all three entry points.
- Overrides and the created category persist across a reload.
- A rule edit can offer to clear manual categories ("Clear N manual category…" checkbox in the rule
  editor). See [rules.md](rules.md).

## How to get to it (user POV)

Upload a statement. Every row has a category pill (title "Change category"). Clicking it opens the
"Choose category" dialog, which has a search box. Right-clicking a row, or ticking rows and using
the selection bar ("Selection actions" group), reaches the same dialog.

## Driving it with drive.mjs

```js
import { expect } from '@playwright/test';
export default async ({ page, shot, fixture }) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', [fixture('june.csv')]);
  const row = page.getByRole('row', { name: /DUKE-ENERGY/ });
  const pill = row.getByTitle('Change category');
  const dialog = page.getByRole('dialog', { name: 'Choose category' });
  const search = page.getByPlaceholder('Search categories…');
  await pill.click();
  await expect(search).toBeFocused();
  const names = await dialog.getByRole('option').allTextContents();
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  await search.fill('Gym');
  await expect(dialog.getByRole('option')).toHaveCount(0);
  await shot('no-match-offer');
  await dialog.getByRole('button', { name: 'Create category “Gym”' }).click();
  await expect(pill).toContainText('Gym');
  await shot('created');
  await page.reload();
  await expect(
    page.getByRole('row', { name: /DUKE-ENERGY/ }).getByTitle('Change category'),
  ).toContainText('Gym');
  await page.getByRole('row', { name: /TACO BELL/ }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Change category…' }).click();
  await expect(search).toBeFocused();
  await search.fill('Fast Snacks');
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('row', { name: /TACO BELL/ }).getByTitle('Change category'),
  ).toContainText('Fast Snacks');
  await page
    .getByRole('row', { name: /SPOTIFY/ })
    .getByRole('checkbox')
    .check();
  await page
    .getByRole('group', { name: 'Selection actions' })
    .getByRole('button', { name: 'Change category' })
    .click();
  await expect(search).toBeFocused();
  await search.fill('Payments');
  await expect(dialog.getByRole('button', { name: /Create category/ })).toHaveCount(0);
  await shot('payments-not-offered');
};
```

Proof: options are sorted, the no-match offer appears, the created category shows on the pill and
survives a reload, and the search box is focused from the pill, the context menu and the bulk bar.

## Gotchas

- Override ids are derived by hashing row fields. Re-uploading the same file keeps them, but a
  different export of the same transaction may not match. See `docs/data-model.md`.
- Radix returns focus to the context menu's trigger as it closes. A focus assertion straight after
  the menu click is what catches a regression there.
