import { expect, type Page, test } from '@playwright/test';
import path from 'node:path';

const fixture = (name: string) => path.join(__dirname, 'fixtures', name);
const heading = (page: Page) => page.getByRole('heading', { name: /Transactions/ });

async function openUploadedFiles(page: Page) {
  await page.getByLabel('Account menu').click();
  await page.getByRole('menuitem', { name: 'Settings…' }).click();
  await page
    .getByRole('navigation', { name: 'Settings' })
    .getByRole('link', { name: 'Uploaded files' })
    .click();
  await expect(page).toHaveURL(/\/settings\/datasets$/);
}

test('removing a file keeps the rows another file also holds, and survives a reload', async ({
  page,
}) => {
  await page.goto('/');
  // june.csv and july.csv overlap on LOWES and SPOTIFY
  await page.setInputFiles('input[type=file]', [fixture('june.csv'), fixture('july.csv')]);
  await expect(heading(page)).toContainText('(11)');

  await openUploadedFiles(page);
  await expect(page.getByLabel('Remove june.csv').locator('xpath=ancestor::li')).toContainText(
    '8 transactions',
  );
  await page.getByLabel('Remove june.csv').click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('Removes 6 transactions. 2 more also appear in other files');
  await dialog.getByRole('button', { name: 'Remove file' }).click();
  await expect(page.getByLabel('Remove june.csv')).toHaveCount(0);

  await page.getByRole('link', { name: /^Done/ }).click();
  await expect(heading(page)).toContainText('(6)');
  await expect(page.getByRole('row', { name: /LOWES/ })).toHaveCount(1);
  await expect(page.getByRole('row', { name: /SPOTIFY/ })).toHaveCount(1);
  await expect(page.getByRole('row', { name: /DUKE-ENERGY/ })).toHaveCount(0);
  await expect(page.getByRole('row', { name: /APPLE/ })).toHaveCount(1);

  await page.reload();
  await expect(heading(page)).toContainText('(6)');
  await expect(page.getByRole('row', { name: /DUKE-ENERGY/ })).toHaveCount(0);
});

test('removing the last file returns to the empty state with categories and rules intact', async ({
  page,
}) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', [fixture('july.csv')]);
  await expect(heading(page)).toContainText('(6)');

  await openUploadedFiles(page);
  await page.getByLabel('Remove july.csv').click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('only file');
  await dialog.getByRole('button', { name: 'Remove file' }).click();
  await expect(page.getByText('No files uploaded yet.')).toBeVisible();

  await page.getByRole('link', { name: /^Done/ }).click();
  await expect(page.getByText('Drop statement CSVs here')).toBeVisible();

  await page.goto('/settings/rules');
  await expect(page.getByLabel('Edit Home Improvement')).toBeVisible();
});

test('adds a file from the uploaded files page', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', [fixture('july.csv')]);
  await expect(heading(page)).toContainText('(6)');

  await openUploadedFiles(page);
  await page.setInputFiles('input[type=file]', [fixture('june.csv')]);
  await expect(page.getByLabel('Remove june.csv')).toBeVisible();
  await page.getByRole('link', { name: /^Done/ }).click();
  await expect(heading(page)).toContainText('(11)');
});
