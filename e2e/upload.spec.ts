import { expect, type Page, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const fixture = (name: string) => path.join(__dirname, 'fixtures', name);

// Drives the drop zone's own onDrop handler, not the hidden <input>, by building a DataTransfer
// with real File contents in the page and dispatching it as a native drop event.
async function dropFiles(page: Page, selector: string, filePaths: string[]) {
  const files = filePaths.map((p) => ({
    name: path.basename(p),
    base64: fs.readFileSync(p).toString('base64'),
  }));
  const dataTransfer = await page.evaluateHandle((files) => {
    const dt = new DataTransfer();
    for (const f of files) {
      const bytes = Uint8Array.from(atob(f.base64), (c) => c.charCodeAt(0));
      dt.items.add(new File([bytes], f.name, { type: 'text/csv' }));
    }
    return dt;
  }, files);
  await page.dispatchEvent(selector, 'drop', { dataTransfer });
}

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
  await page.getByRole('menuitem', { name: 'Sign in…' }).click();

  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByText(/You don’t need an account/)).toBeVisible();
});

test('reports a bad file inline and still loads a good one', async ({ page }) => {
  await page.goto('/');

  await page.setInputFiles('input[type=file]', [fixture('broken.csv')]);
  await expect(page.getByRole('alert').filter({ hasText: 'broken.csv' })).toBeVisible();
  await expect(page.getByText('Drop statement CSVs here')).toBeVisible();

  await page.setInputFiles('input[type=file]', [fixture('july.csv')]);
  await expect(page.getByRole('heading', { name: /Transactions/ })).toContainText('(6)');
});

test('reports a bad file dragged onto the drop zone, then loads a good one dragged there', async ({
  page,
}) => {
  await page.goto('/');

  await dropFiles(page, 'text=Drop statement CSVs here', [fixture('broken.csv')]);
  await expect(page.getByRole('alert').filter({ hasText: 'broken.csv' })).toBeVisible();
  await expect(page.getByText('Drop statement CSVs here')).toBeVisible();

  await dropFiles(page, 'text=Drop statement CSVs here', [fixture('june.csv')]);
  await expect(page.getByRole('heading', { name: /Transactions/ })).toContainText('(7)');
});

test('clicking the drop zone opens the native file picker', async ({ page }) => {
  await page.goto('/');

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByText('Drop statement CSVs here').click(),
  ]);
  await chooser.setFiles(fixture('june.csv'));

  await expect(page.getByRole('heading', { name: /Transactions/ })).toContainText('(7)');
});
