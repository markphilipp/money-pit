import { expect, test } from '@playwright/test';
import path from 'node:path';

const fixture = (name: string) => path.join(__dirname, 'fixtures', name);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', [fixture('june.csv')]);
  await expect(page.getByRole('heading', { name: /Transactions/ })).toContainText('(7)');
});

test('right-click excludes a category from the bar chart and Reset restores it', async ({
  page,
}) => {
  const heading = page.getByRole('heading', { name: /Transactions/ });
  await page
    .getByRole('group', { name: 'Category chart type' })
    .getByRole('button', { name: 'Bars' })
    .click();
  const bars = page.getByLabel('Spending by category, bar chart');
  const box = await bars.boundingBox();
  const topBar = { x: box!.width * 0.45, y: box!.height * 0.18 };

  await bars.click({ button: 'right', position: topBar });
  await page.getByRole('menuitem', { name: /^Exclude/ }).click();
  await expect(heading).not.toContainText('(7)');

  await bars.click({ button: 'right', position: topBar });
  await expect(page.getByRole('menuitem', { name: /^Include/ })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Show all categories' })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.reload();
  await expect(heading).not.toContainText('(7)');

  await page.getByRole('button', { name: 'Reset filters' }).click();
  await expect(heading).toContainText('(7)');
});

test('right-click excludes a cardholder from the donut and Show all clears it', async ({
  page,
}) => {
  const heading = page.getByRole('heading', { name: /Transactions/ });
  const donut = page.getByLabel('Spending by cardholder, donut chart');
  const box = await donut.boundingBox();
  const ring = { x: box!.width * 0.44 + 120, y: box!.height * 0.5 };

  await donut.click({ button: 'right', position: ring });
  await page.getByRole('menuitem', { name: /^Exclude/ }).click();
  await expect(heading).not.toContainText('(7)');

  await donut.click({ button: 'right', position: ring });
  await page.getByRole('menuitem', { name: 'Show all cardholders' }).click();
  await expect(heading).toContainText('(7)');
});

test('right-clicking empty chart space opens no menu', async ({ page }) => {
  const donut = page.getByLabel('Spending by cardholder, donut chart');
  const box = await donut.boundingBox();
  await donut.click({
    button: 'right',
    position: { x: box!.width - 5, y: box!.height - 5 },
  });
  await expect(page.getByRole('menuitem')).toHaveCount(0);
});
