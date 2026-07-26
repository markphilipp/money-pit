import { expect, test } from '@playwright/test';
import path from 'node:path';

const fixture = (name: string) => path.join(__dirname, 'fixtures', name);

test('lands on the empty state, then loads two statements and dedupes the overlap', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('Drop statement CSVs here')).toBeVisible();

  await page.setInputFiles('input[type=file]', [fixture('june.csv'), fixture('july.csv')]);

  // 8 + 6 rows with 2 shared between the exports, minus the payment row hidden by default
  await expect(page.getByRole('heading', { name: /Transactions/ })).toContainText('(11)');
  await expect(page.getByRole('row', { name: /LOWES/ })).toHaveCount(1);
  await expect(page.getByRole('row', { name: /SPOTIFY/ })).toHaveCount(1);

  await expect(page.getByText('Net spend')).toBeVisible();
  await expect(page.getByText('Purchases')).toHaveCount(0);
  await expect(page.getByText('Refunds')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(2);
  await expect(page.locator('tfoot')).toContainText('Total');
});

test('offers the account menu on the empty state', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Drop statement CSVs here')).toBeVisible();

  await page.getByLabel('Account menu').click();
  await expect(page.getByRole('menuitem', { name: 'Category rules…' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /Sign in/ })).toBeDisabled();
});

test('reports a bad file inline and still loads a good one', async ({ page }) => {
  await page.goto('/');

  await page.setInputFiles('input[type=file]', [fixture('broken.csv')]);
  await expect(page.getByRole('alert').filter({ hasText: 'broken.csv' })).toBeVisible();
  await expect(page.getByText('Drop statement CSVs here')).toBeVisible();

  await page.setInputFiles('input[type=file]', [fixture('july.csv')]);
  await expect(page.getByRole('heading', { name: /Transactions/ })).toContainText('(6)');
});
