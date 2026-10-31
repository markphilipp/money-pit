# Categories

Categories are separate from rules: a category is what a row is filed under, a rule is what files
it there. `/categories` adds, renames, recolors and deletes them.

## Sub-features

- **List** (`/categories`, heading "Categories"): one row per category with its rule and
  transaction counts.
- **Add:** the "New category" field and "Add category" button, which stays disabled until the name
  is valid. A name already in use (any case) is rejected with a `role="alert"` inside the form. Scope to the form: Next's route announcer is a second `alert`.
- **Rename:** `Rename <name>` swaps in the `New name for <name>` input. Enter or Save commits,
  Escape cancels.
- **Delete:** `Delete <name>` opens a confirm dialog listing the rules that go with it. The builtins
  "Payments" and "Other" can be renamed but their Delete button is disabled.
- Links: "Rules" goes to `/rules`, "Done" and "← Back" go to `/`.

## How to get to it (user POV)

Account menu, then "Categories…". Also the "Categories" link on `/rules`, and the direct URL.

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
  await expect(page.getByRole('button', { name: 'Delete Other' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Delete Payments' })).toBeDisabled();

  await page.getByRole('textbox', { name: 'New category' }).fill('Travel');
  await page.getByRole('button', { name: 'Add category' }).click();
  await expect(page.getByRole('button', { name: 'Rename Travel' })).toBeVisible();
  await page.getByRole('textbox', { name: 'New category' }).fill('travel');
  await expect(page.locator('form').getByRole('alert')).toBeVisible();
  await shot('added-and-duplicate-rejected');

  await page.getByRole('button', { name: 'Rename Travel' }).click();
  await page.getByLabel('New name for Travel').fill('Trips');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Rename Trips' })).toBeVisible();

  await page.getByRole('button', { name: 'Delete Trips' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await shot('delete-dialog');
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: /^Delete category/ })
    .click();
  await expect(page.getByRole('button', { name: 'Rename Trips' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Rename Trips' })).toHaveCount(0);
};
```

Proof: builtins can't be deleted, a duplicate name is rejected, a rename commits, and a deleted
category stays gone after a reload.

## Gotchas

- Deleting a category also removes every rule filing into it and every override pointing at it.
  A category with rules makes the confirm button read "Delete category and N rules".
- Signed in, categories and rules are written together to the `category` and `rule` tables.
