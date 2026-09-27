import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './account';

const fixture = (name: string) => path.join(__dirname, 'fixtures', name);
const heading = (page: Page) => page.getByRole('heading', { name: /Transactions/ });
const pill = (page: Page) =>
  page.getByRole('row', { name: /DUKE-ENERGY/ }).getByTitle('Change category');
const merchantOffersPill = (page: Page) =>
  page.getByRole('row', { name: /Merchant Offers/ }).getByTitle('Change category');
const storedKeys = async (page: Page) =>
  Object.keys(
    JSON.parse((await page.evaluate(() => sessionStorage.getItem('money-pit')))!).state,
  ).sort();

async function uploadAndEdit(page: Page) {
  await page.setInputFiles('input[type=file]', [fixture('june.csv')]);
  await expect(heading(page)).toContainText('(7)');
  await pill(page).click();
  await page.getByPlaceholder('Search categories…').fill('home');
  await page
    .getByRole('dialog', { name: 'Choose category' })
    .getByRole('option', { name: /Home Improvement/ })
    .click();
  await page.getByLabel('Account menu').click();
  await page.getByRole('menuitem', { name: 'Category rules…' }).click();
  await page.getByLabel('Move Groceries up').click();
  await page.getByRole('link', { name: 'Categories' }).click();
  await page.getByLabel('Rename Home Improvement').click();
  await page.getByLabel('New name for Home Improvement').fill('Renovations');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Renovations')).toBeVisible();
}

test.describe('signed in', { tag: '@signed-in' }, () => {
  test('saves uploads, overrides and rule edits to the account', async ({
    page,
    account,
    browser,
    baseURL,
  }) => {
    await account.signIn();
    await page.goto('/');
    await expect(page.getByText(/saved to your account/)).toBeVisible();
    await uploadAndEdit(page);
    expect(await storedKeys(page)).toEqual(['filters', 'ruleSources']);

    const fresh = await browser.newContext({ baseURL });
    await account.signIn(fresh);
    const again = await fresh.newPage();
    // The first page's writes may still be in flight; a fresh load only sees what has landed.
    await expect(async () => {
      await again.goto('/');
      await expect(heading(again)).toContainText('(7)', { timeout: 2000 });
      await expect(pill(again)).toContainText('Renovations', { timeout: 2000 });
      await again.goto('/rules');
      await expect(again.getByLabel(/^Edit /).first()).toHaveAttribute(
        'aria-label',
        'Edit Groceries',
        { timeout: 2000 },
      );
    }).toPass();
    await fresh.close();
  });

  test('saves a signed-out session to the account on sign-in', async ({ page, account }) => {
    await page.goto('/');
    await uploadAndEdit(page);
    await page.goto('/');
    await page
      .getByRole('group', { name: 'Category chart type' })
      .getByRole('button', { name: 'Bars' })
      .click();
    await account.signIn();
    await page.goto('/');

    const prompt = page.getByRole('dialog', { name: /Save this session’s statements/ });
    await expect(prompt.getByRole('button', { name: 'Save to my account' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(pill(page)).toContainText('Renovations');
    await expect(
      page
        .getByRole('group', { name: 'Category chart type' })
        .getByRole('button', { name: 'Bars' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(await storedKeys(page)).toEqual(['filters', 'ruleSources']);

    await page.reload();
    await expect(heading(page)).toContainText('(7)');
    await expect(pill(page)).toContainText('Renovations');
    await expect(
      page
        .getByRole('group', { name: 'Category chart type' })
        .getByRole('button', { name: 'Bars' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(prompt).toHaveCount(0);
  });

  test('deletes a category and its rule to the account, surviving a reload', async ({
    page,
    account,
  }) => {
    await account.signIn();
    await page.goto('/');
    await expect(page.getByText(/saved to your account/)).toBeVisible();
    await page.setInputFiles('input[type=file]', [fixture('june.csv')]);
    await expect(heading(page)).toContainText('(7)');
    await expect.poll(account.rowCount).toBe(8);

    await page.getByLabel('Account menu').click();
    await page.getByRole('menuitem', { name: 'Categories…' }).click();
    await page.getByLabel('New category').fill('Travel');
    await page.getByRole('button', { name: 'Add category' }).click();
    await page.getByRole('link', { name: 'Done' }).click();

    const row = page.getByRole('row', { name: /Merchant Offers/ });
    await row.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Create rule from transaction' }).click();
    await expect(page).toHaveURL(/\/rules\/new$/);
    await page.getByLabel('Category').selectOption('travel');
    await page.getByRole('button', { name: 'Save rule' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(merchantOffersPill(page)).toContainText('Travel');

    await page.getByLabel('Account menu').click();
    await page.getByRole('menuitem', { name: 'Categories…' }).click();
    await page.getByLabel('Delete Travel').click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('will be deleted too');
    await dialog.getByRole('button', { name: /Delete category and/ }).click();
    await expect(page.getByText('Travel')).toHaveCount(0);

    await page.getByRole('link', { name: 'Done' }).click();
    await expect(merchantOffersPill(page)).toContainText('Other');

    // the deletion survives a full server round-trip, not just the tab's own state
    await page.reload();
    await expect(heading(page)).toContainText('(7)');
    await expect(merchantOffersPill(page)).toContainText('Other');
    await page.goto('/categories');
    await expect(page.getByText('Travel')).toHaveCount(0);
  });

  test('reads a pre-split account from category_rule and upgrades it on first save', async ({
    page,
    account,
  }) => {
    await account.seedLegacyCategoryRules([
      {
        id: 'coffee',
        name: 'Coffee',
        color: '#6b4f3a',
        conditions: {
          combinator: 'or',
          rules: [{ field: 'description', operator: 'contains', value: 'STARBUCKS' }],
        },
      },
      {
        id: 'other',
        name: 'Other',
        color: '#8A8F98',
        conditions: { combinator: 'and', rules: [] },
        builtin: true,
      },
    ]);
    expect(await account.categoryIds()).toEqual([]);

    await account.signIn();
    await page.goto('/');
    await expect(page.getByText(/saved to your account/)).toBeVisible();

    await page.getByLabel('Account menu').click();
    await page.getByRole('menuitem', { name: 'Categories…' }).click();
    await expect(page.getByText('Coffee')).toBeVisible();
    // reading the legacy table doesn't write anything until something actually changes
    expect(await account.categoryIds()).toEqual([]);

    await page.getByLabel('New category').fill('Travel');
    await page.getByRole('button', { name: 'Add category' }).click();

    await expect.poll(account.categoryIds).toEqual(['coffee', 'travel', 'other']);
    expect(await account.ruleIds()).toEqual(['coffee']);
  });

  test('starts over, keeping the account, then deletes it', async ({ page, account }) => {
    await account.signIn();
    await page.goto('/');
    await expect(page.getByText(/saved to your account/)).toBeVisible();
    await page.setInputFiles('input[type=file]', [fixture('june.csv')]);
    await expect(heading(page)).toContainText('(7)');
    await expect.poll(account.rowCount).toBe(8);

    await page.getByLabel('Account menu').click();
    await page.getByRole('menuitem', { name: 'Start over' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Start over' }).click();
    // Reloading mid-write would abort the reset, and networkidle resolves at once on an idle page.
    await expect.poll(account.rowCount).toBe(0);
    await page.reload();
    await expect(page.getByText(/saved to your account/)).toBeVisible();

    await page.getByLabel('Account menu').click();
    await page.getByRole('menuitem', { name: 'Delete account…' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete my account' }).click();
    await expect(page.getByText(/Without an account, nothing is uploaded/)).toBeVisible();
    expect(await account.exists()).toBe(false);
  });
});
