import { expect, test } from '@playwright/test';
import path from 'node:path';

const fixture = (name: string) => path.join(__dirname, 'fixtures', name);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', [fixture('june.csv'), fixture('july.csv')]);
  await expect(page.getByRole('heading', { name: /Transactions/ })).toContainText('(11)');
});

const rows = (page: import('@playwright/test').Page) => page.locator('tbody tr');

test('? opens the shortcuts dialog and Esc closes it', async ({ page }) => {
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('shortcuts stay quiet while typing in search, then work again after leaving it', async ({
  page,
}) => {
  await page.keyboard.press('/');
  const search = page.getByLabel('Search description');
  await expect(search).toBeFocused();
  await page.keyboard.type('acrl?');
  await expect(search).toHaveValue('acrl?');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('tr[aria-current]')).toHaveCount(0);

  await search.fill('');
  await search.blur();
  await page.keyboard.press('l');
  await expect(rows(page).first()).toHaveAttribute('aria-current', 'true');
});

test('moves, selects and clears from the keyboard, and keeps working after a checkbox click', async ({
  page,
}) => {
  await page.keyboard.press('ArrowUp');
  await expect(rows(page).last()).toHaveAttribute('aria-current', 'true');
  await page.keyboard.press('l');
  await page.keyboard.press('ArrowDown');
  await expect(rows(page).nth(1)).toHaveAttribute('aria-current', 'true');

  await page.keyboard.press('Space');
  await expect(rows(page).nth(1).getByRole('checkbox')).toBeChecked();

  await rows(page).nth(3).getByRole('checkbox').click();
  await page.keyboard.press('a');
  await expect(page.getByText('11 selected')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByText(/selected/)).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('tr[aria-current]')).toHaveCount(0);
});

test('c recategorizes the highlighted row without typing the key into the picker', async ({
  page,
}) => {
  await page.keyboard.press('l');
  await page.keyboard.press('c');
  const picker = page.getByRole('dialog', { name: 'Choose category' });
  await expect(picker).toBeVisible();
  await expect(page.getByPlaceholder('Search categories…')).toHaveValue('');
  await picker.getByRole('option').nth(1).click();
  await expect(picker).toBeHidden();
});

test('r opens the rule editor for the highlighted row', async ({ page }) => {
  await page.keyboard.press('l');
  await page.keyboard.press('r');
  await page.waitForURL('**/settings/rules/new');
});

test('the highlighted row never hides under the pinned header while stepping through a short window', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 560 });
  await page.keyboard.press('l');
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('ArrowDown');
    const { rowTop, theadBottom } = await page.evaluate(() => ({
      rowTop: document.querySelector('tr[aria-current]')!.getBoundingClientRect().top,
      theadBottom: document.querySelector('thead')!.getBoundingClientRect().bottom,
    }));
    expect(rowTop).toBeGreaterThanOrEqual(theadBottom - 1);
  }
});
