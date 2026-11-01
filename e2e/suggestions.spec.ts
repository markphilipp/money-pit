import { expect, test } from '@playwright/test';
import path from 'node:path';

const fixture = (name: string) => path.join(__dirname, 'fixtures', name);

test('suggests a rule, keeps a dismissal across an overlapping upload, and re-checks', async ({
  page,
}) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', [fixture('suggestions-a.csv')]);
  await expect(page.getByRole('heading', { name: /Transactions/ })).toBeVisible();

  const banner = page.getByRole('button', { name: /rule suggestions? for Other/ });
  await expect(banner).toHaveText(/1 rule suggestion for Other/);
  await banner.click();
  await expect(page.getByText('Covers 3 rows in Other')).toBeVisible();

  await page.getByRole('button', { name: /^Dismiss contains “PINE HOLLOW FEED STORE”/ }).click();
  await expect(banner).toBeHidden();

  // B repeats one of A's rows, adds more Pine Hollow, and brings Copper Kettle up to three.
  await page.setInputFiles('input[type=file]', [fixture('suggestions-b.csv')]);
  await expect(page.getByRole('row', { name: /PINE HOLLOW FEED STORE #0044/ })).toBeVisible();
  await expect(banner).toHaveText(/1 rule suggestion for Other/);
  await expect(banner).toHaveAttribute('aria-expanded', 'true');
  await expect(
    page.getByRole('button', { name: /^Dismiss contains “COPPER KETTLE ROASTERS”/ }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /PINE HOLLOW/ })).toHaveCount(0);

  await page.reload();
  await expect(banner).toHaveText(/1 rule suggestion for Other/);

  await banner.click();
  await page
    .getByRole('button', { name: /^Create rule for contains “COPPER KETTLE ROASTERS”/ })
    .click();
  await expect(page).toHaveURL(/\/settings\/rules\/new$/);
  await expect(
    page.getByRole('button', { name: /contains “COPPER KETTLE ROASTERS”/ }),
  ).toHaveAttribute('aria-pressed', 'true');
});
