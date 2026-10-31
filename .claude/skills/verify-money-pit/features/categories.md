# Categories

The category list is its own screen at `/categories`: rename, recolor, add and delete categories.
Payments and Other are built in, so they can be renamed and recolored but not deleted.

## Sub-features

- Add a category ("New category" name + color, "Add category"). A name that already exists, ignoring
  case, is rejected inline.
- Rename (`Rename <name>`, then `New name for <name>`, `Save`) and recolor (`<name> color`).
- Delete (`Delete <name>`) opens a confirmation listing the rules and manual overrides that go
  with it. Builtins have a disabled Delete button.
- Each row shows its rule and transaction counts.
- "Rules" links to `/rules`, "Done" to `/`.

## How to get to it (user POV)

Account menu, then "Categories…". Also the "Categories" link on `/rules`, or the URL directly.

## Driving it with drive.mjs

```js
import { expect } from '@playwright/test';
export default async ({ page, shot, fixture }) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', [fixture('june.csv')]);
  await page.getByLabel('Account menu').click();
  await page.getByRole('menuitem', { name: 'Categories…' }).click();
  await expect(page).toHaveURL(/\/categories$/);
  await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete Payments' })).toBeDisabled();
  await page.getByLabel('New category', { exact: true }).fill('Travel');
  await page.getByRole('button', { name: 'Add category' }).click();
  await expect(page.getByText('Travel', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Rename Travel' }).click();
  await page.getByLabel('New name for Travel').fill('Trips');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Trips', { exact: true })).toBeVisible();
  await shot('renamed');
  await page.getByRole('button', { name: 'Delete Trips' }).click();
  await page.getByRole('button', { name: 'Delete category' }).click();
  await expect(page.getByText('Trips', { exact: true })).toHaveCount(0);
  await shot('deleted');
};
```

Proof: the added category appears, the rename takes, the delete dialog removes it, and builtin
Delete stays disabled.

## Gotchas

- Categories persist in sessionStorage today, so the screen shows "Loading categories…" until
  hydration. Wait for the heading's list, not just the URL.
