import { expect, test } from '@playwright/test';
import path from 'node:path';

const fixture = (name: string) => path.join(__dirname, 'fixtures', name);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', [fixture('june.csv')]);
  await expect(page.getByRole('heading', { name: /Transactions/ })).toBeVisible();
});

test('filters through the column menus and survives a reload', async ({ page }) => {
  await page.getByRole('button', { name: 'Person column menu' }).click();
  await page.getByRole('checkbox', { name: 'Jamie' }).click();
  await expect(page.getByRole('heading', { name: /Transactions/ })).toContainText('(3)');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Amount column menu' }).click();
  await page.getByLabel('Amount filter value').fill('20');
  await expect(page.getByRole('heading', { name: /Transactions/ })).toContainText('(1)');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('row', { name: /WALMART/ })).toBeVisible();
  await expect(page.locator('tfoot')).toContainText('$64.20');

  await page
    .getByRole('group', { name: 'Category chart type' })
    .getByRole('button', { name: 'Bars' })
    .click();
  await page.reload();

  await expect(
    page.getByRole('group', { name: 'Category chart type' }).getByRole('button', { name: 'Bars' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: /Transactions/ })).toContainText('(1)');

  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.getByRole('heading', { name: /Transactions/ })).toContainText('(7)');
});

test('recategorizes a row from the category pill', async ({ page }) => {
  const row = page.getByRole('row', { name: /DUKE-ENERGY/ });
  await row.getByTitle('Change category').click();

  await page.getByPlaceholder('Search categories…').fill('home');
  await page
    .getByRole('dialog', { name: 'Choose category' })
    .getByRole('option', { name: /Home Improvement/ })
    .click();

  await expect(row.getByTitle('Change category')).toContainText('Home Improvement');
});

test('creates a rule from a row and applies it immediately', async ({ page }) => {
  const row = page.getByRole('row', { name: /Merchant Offers/ });
  await expect(row.getByTitle('Change category')).toContainText('Other');

  await row.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Create rule from transaction' }).click();

  await expect(page).toHaveURL(/\/rules\/new$/);
  await expect(page.getByRole('heading', { name: 'New rule from 1 transaction' })).toBeVisible();
  await expect(page.getByTestId('value-editor')).toHaveValue('Merchant Offers');
  await page.getByLabel('Category name').fill('Merchant Credits');
  await page.getByRole('button', { name: 'Save rule' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(row.getByTitle('Change category')).toContainText('Merchant Credits');
});

test('suggests a merchant rule from several selected rows', async ({ page }) => {
  await page.setInputFiles('input[type=file]', [fixture('merchants.csv')]);
  await expect(page.getByRole('row', { name: /BLUE RIDGE BAKERY #0311/ })).toBeVisible();

  for (const store of ['#0042', '#0117']) {
    await page
      .getByRole('row', { name: new RegExp(store) })
      .getByRole('checkbox')
      .check();
  }
  await page.getByRole('button', { name: 'Create rule' }).click();

  const suggestion = page.getByRole('button', { name: /contains “BLUE RIDGE BAKERY”/ });
  await expect(suggestion).toContainText('matches all 2 selected + 1 other');
  await expect(suggestion).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('heading', { name: 'Also matches 1 other transaction' }),
  ).toBeVisible();

  await expect(page.getByLabel('Category name')).toHaveValue('Blue Ridge Bakery');
  await page.getByRole('button', { name: 'Save rule' }).click();

  // the unselected third bakery row is categorized too — rules apply to the whole history
  await expect(
    page.getByRole('row', { name: /BLUE RIDGE BAKERY #0311/ }).getByTitle('Change category'),
  ).toContainText('Blue Ridge Bakery');
});

test('manages rules on their own route, reached from the user menu', async ({ page }) => {
  await page.getByLabel('Account menu').click();
  await page.getByRole('menuitem', { name: 'Category rules…' }).click();

  await expect(page).toHaveURL(/\/rules$/);
  await expect(page.getByText(/description contains LOWE/)).toBeVisible();

  await page.getByLabel('Delete Groceries').click();
  await expect(page.getByLabel('Delete Groceries')).toHaveCount(0);

  await page.getByRole('link', { name: 'Done' }).click();
  await expect(
    page.getByRole('row', { name: /WALMART/ }).getByTitle('Change category'),
  ).toContainText('Other');
});

test('reassigns a rule to a different category on its own URL and comes back through history', async ({
  page,
}) => {
  await page.goto('/rules');
  await page.getByLabel('Edit Home Improvement').click();

  await expect(page).toHaveURL(/\/rules\/home$/);
  await expect(page.getByLabel('Category')).toHaveValue('home');
  await page.getByLabel('Category').selectOption('pets');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page).toHaveURL(/\/rules$/);
  const moved = page.locator('li', { hasText: 'description contains LOWE' });
  await expect(moved).toContainText('Pets');

  // the reassignment survives a full server round-trip, not just a client-side transition
  await page.reload();
  await expect(moved).toContainText('Pets');

  await page.goBack();
  await expect(page.getByLabel('Category')).toHaveValue('pets');
});

test('renames a category from its own screen', async ({ page }) => {
  await page.getByLabel('Account menu').click();
  await page.getByRole('menuitem', { name: 'Categories…' }).click();

  await expect(page).toHaveURL(/\/categories$/);
  const groceriesRow = page.locator('li', { has: page.getByLabel('Rename Groceries') });
  await expect(groceriesRow).toContainText('1 rule · 1 transaction');

  await page.getByLabel('Rename Groceries').click();
  await page.getByLabel('New name for Groceries').fill('Food');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Groceries')).toHaveCount(0);

  await page.getByRole('link', { name: 'Done' }).click();
  await expect(
    page.getByRole('row', { name: /WALMART/ }).getByTitle('Change category'),
  ).toContainText('Food');
});

test('warns before deleting a category that rules depend on', async ({ page }) => {
  await page.getByLabel('Account menu').click();
  await page.getByRole('menuitem', { name: 'Categories…' }).click();

  await page.getByLabel('Delete Groceries').click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('will be deleted too');
  await dialog.getByRole('button', { name: /Delete category and/ }).click();

  await expect(page.getByText('Groceries')).toHaveCount(0);
  await page.getByRole('link', { name: 'Done' }).click();
  await expect(
    page.getByRole('row', { name: /WALMART/ }).getByTitle('Change category'),
  ).toContainText('Other');
});

test('serves a 404 for an unknown URL and a message for an unknown rule', async ({ page }) => {
  const missing = await page.goto('/nope');
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();

  await page.goto('/rules/not-a-rule');
  await expect(page.getByRole('heading', { name: 'Rule not found' })).toBeVisible();
});

test('bulk-selects rows and rewrites their category', async ({ page }) => {
  await page.getByLabel('Select all visible rows').check();
  await expect(page.getByText('7 selected')).toBeVisible();

  await page.getByRole('button', { name: 'Change category' }).click();
  await page
    .getByRole('dialog', { name: 'Choose category' })
    .getByRole('option', { name: /Pets/ })
    .click();

  await expect(page.getByText('7 selected')).toHaveCount(0);
  await expect(
    page.getByRole('row', { name: /LOWES/ }).getByTitle('Change category'),
  ).toContainText('Pets');
});

test('links the privacy policy and terms from every page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('contentinfo').getByRole('link', { name: 'Privacy' }).click();
  await expect(page.getByRole('heading', { name: 'Privacy policy' })).toBeVisible();
  await page.getByRole('contentinfo').getByRole('link', { name: 'Terms' }).click();
  await expect(page.getByRole('heading', { name: 'Terms of service' })).toBeVisible();
});
