# Categories

Categories are separate from rules: a category is what a row is filed under, a rule is what files
it there. The category list is its own Settings section at `/settings/categories`: rename, recolor, add and delete
categories. Payments and Other are built in, so they can be renamed and recolored but not deleted.

## Sub-features

- Add a category ("New category" name + color, "Add category", which stays disabled until the name
  is valid). A name that already exists, ignoring case, is rejected inline with a `role="alert"`
  inside the form. Scope to the form: Next's route announcer is a second `alert`.
- Rename (`Rename <name>`, then `New name for <name>`; Enter or `Save` commits, Escape cancels) and
  recolor (`<name> color`).
- Delete (`Delete <name>`) opens a confirmation listing the rules and manual overrides that go
  with it. Builtins have a disabled Delete button.
- Each row shows its rule and transaction counts.
- The Settings nav switches to the other sections, and "Done" goes to `/`.

## How to get to it (user POV)

Account menu, then "Settings…" (lands on `/settings/rules`), then "Categories" in the Settings nav.
Or `/settings/categories` directly; `/categories` redirects there.

## Driving it with drive.mjs

```js
import { expect } from '@playwright/test';
export default async ({ page, shot, fixture }) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', [fixture('june.csv')]);
  await page.getByLabel('Account menu').click();
  await page.getByRole('menuitem', { name: 'Settings…' }).click();
  await expect(page).toHaveURL(/\/settings\/rules$/);
  await page
    .getByRole('navigation', { name: 'Settings' })
    .getByRole('link', { name: 'Categories' })
    .click();
  await expect(page).toHaveURL(/\/settings\/categories$/);
  await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete Other' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Delete Payments' })).toBeDisabled();
  await page.getByLabel('New category', { exact: true }).fill('Travel');
  await page.getByRole('button', { name: 'Add category' }).click();
  await expect(page.getByRole('button', { name: 'Rename Travel' })).toBeVisible();
  await page.getByLabel('New category', { exact: true }).fill('travel');
  await expect(page.locator('form').getByRole('alert')).toBeVisible();
  await shot('added-and-duplicate-rejected');
  await page.getByRole('button', { name: 'Rename Travel' }).click();
  await page.getByLabel('New name for Travel').fill('Trips');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Rename Trips' })).toBeVisible();
  await shot('renamed');
  await page.getByRole('button', { name: 'Delete Trips' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await shot('delete-dialog');
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: /^Delete category/ })
    .click();
  await expect(page.getByRole('button', { name: 'Rename Trips' })).toHaveCount(0);
  await shot('deleted');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Rename Trips' })).toHaveCount(0);
};
```

Proof: builtins can't be deleted, a duplicate name is rejected, the added category appears, a
rename commits, and a deleted category stays gone after a reload.

## Gotchas

- Deleting a category also removes every rule filing into it and every override pointing at it.
  A category with rules makes the confirm button read "Delete category and N rules".
- Signed in, categories and rules are written together to the `category` and `rule` tables.
- Signed out, categories persist in sessionStorage, so the screen shows "Loading categories…" until
  hydration. Wait for the heading's list, not just the URL.
