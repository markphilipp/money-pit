import { expect, test } from '@playwright/test';
import path from 'node:path';

const fixture = (name: string) => path.join(__dirname, 'fixtures', name);

test('suggests a rule, keeps a dismissal across an overlapping upload, and re-checks', async ({
  page,
}) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', [fixture('suggestions-a.csv')]);
  await expect(page.getByRole('heading', { name: /Transactions/ })).toBeVisible();

  const pill = page.getByRole('button', { name: /^\d+ rule suggestions?$/ });
  const dialog = page.getByRole('dialog', { name: 'Rule suggestions for Other' });
  await expect(pill).toHaveText(/1 rule suggestion/);
  await pill.click();
  await expect(dialog.getByText('Covers 3 rows in Other')).toBeVisible();

  await dialog.getByRole('button', { name: /^Dismiss contains “PINE HOLLOW FEED STORE”/ }).click();
  await expect(dialog).toBeHidden();
  await expect(pill).toBeHidden();

  // B repeats one of A's rows, adds more Pine Hollow, and brings Copper Kettle up to three.
  await page.setInputFiles('input[type=file]', [fixture('suggestions-b.csv')]);
  await expect(page.getByRole('row', { name: /PINE HOLLOW FEED STORE #0044/ })).toBeVisible();
  await expect(pill).toHaveText(/1 rule suggestion/);
  await pill.click();
  await expect(
    dialog.getByRole('button', { name: /^Dismiss contains “COPPER KETTLE ROASTERS”/ }),
  ).toBeVisible();
  await expect(dialog.getByRole('button', { name: /PINE HOLLOW/ })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Close' }).click();

  await page.reload();
  await expect(pill).toHaveText(/1 rule suggestion/);

  await pill.click();
  await dialog
    .getByRole('button', { name: /^Create rule for contains “COPPER KETTLE ROASTERS”/ })
    .click();
  await expect(page).toHaveURL(/\/settings\/rules\/new$/);
  await expect(
    page.getByRole('button', { name: /contains “COPPER KETTLE ROASTERS”/ }),
  ).toHaveAttribute('aria-pressed', 'true');
});
