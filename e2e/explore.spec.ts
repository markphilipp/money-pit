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

  await page.getByRole('button', { name: 'Bars' }).click();
  await page.reload();

  await expect(page.getByRole('button', { name: 'Bars' })).toHaveAttribute('aria-pressed', 'true');
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

test('edits a rule on its own URL and comes back through history', async ({ page }) => {
  await page.goto('/rules');
  await page.getByLabel('Edit Home Improvement').click();

  await expect(page).toHaveURL(/\/rules\/home$/);
  await page.getByLabel('Category name').fill('Renovations');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page).toHaveURL(/\/rules$/);
  await expect(page.getByText('Renovations')).toBeVisible();

  // the rule survives a full server round-trip, not just a client-side transition
  await page.reload();
  await expect(page.getByText('Renovations')).toBeVisible();

  await page.goBack();
  await expect(page.getByLabel('Category name')).toHaveValue('Renovations');
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
