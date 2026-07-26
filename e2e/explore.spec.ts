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

  await expect(page.locator('input[value="Merchant Offers Credit NY"]')).toBeVisible();
  await page.getByLabel('Category name').fill('Merchant Credits');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(row.getByTitle('Change category')).toContainText('Merchant Credits');
});

test('manages rules from the user menu', async ({ page }) => {
  await page.getByLabel('Account menu').click();
  await page.getByRole('menuitem', { name: 'Category rules…' }).click();

  const manager = page.getByRole('dialog').filter({ hasText: 'First matching rule wins' });
  await expect(manager.getByText(/description contains LOWE/)).toBeVisible();

  await manager.getByLabel('Delete Groceries').click();
  await expect(manager.getByLabel('Delete Groceries')).toHaveCount(0);
  await page.keyboard.press('Escape');

  await expect(
    page.getByRole('row', { name: /WALMART/ }).getByTitle('Change category'),
  ).toContainText('Other');
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
