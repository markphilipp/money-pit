import { expect, test } from '@playwright/test';
import path from 'node:path';

const fixture = (name: string) => path.join(__dirname, 'fixtures', name);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', [fixture('june.csv')]);
  await expect(page.getByRole('heading', { name: /Transactions/ })).toBeVisible();
});

test('filters through the column headers and survives a reload', async ({ page }) => {
  await page.getByLabel('Filter by person').selectOption('JAMIE SAMPLE');
  await expect(page.getByRole('heading', { name: /Transactions/ })).toContainText('(3)');

  await page.getByLabel('Minimum amount').fill('20');
  await expect(page.getByRole('heading', { name: /Transactions/ })).toContainText('(1)');
  await expect(page.getByRole('row', { name: /WALMART/ })).toBeVisible();

  await page.getByRole('button', { name: 'Bars' }).click();
  await page.reload();

  await expect(page.getByRole('button', { name: 'Bars' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: /Transactions/ })).toContainText('(1)');
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
