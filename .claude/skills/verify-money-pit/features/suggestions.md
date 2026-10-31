# Rule suggestions

The dashboard proposes description-based rules for rows stuck in Other. Suggestions are derived on
every render from the loaded rows, so an upload re-checks for free. Only dismissals are stored.

## Sub-features

- **Banner:** `section` "Rule suggestions" with a toggle button reading "N rule suggestion(s) for
  Other" (`aria-expanded`). It renders nothing when there are no suggestions.
- **Cards** (expanded, at most 5, then "Showing the 5 largest of N."): the label (`contains “…”`,
  curly quotes), "Covers N rows in Other", up to 3 sample descriptions, `Create rule for <label>`
  and `Dismiss <label>`.
- **A suggestion needs 3 or more similar Other rows.** Rows with a manual override, or already
  categorized, never count, and a pattern that would also match a categorized row is dropped.
- **Create rule** seeds `/settings/rules/new` with the covered rows. The matching "Suggested rules" card is
  `aria-pressed`.
- **Dismiss** is remembered across reload and later uploads. Signed in it syncs to the account.
- **Selection path:** ticking rows and clicking the BulkBar "Create rule" button is the same
  editor. See [rules.md](rules.md).

## How to get to it (user POV)

Upload a statement with a recurring unrecognised merchant. The banner sits between the charts and
the transactions table.

## Driving it with drive.mjs

```js
import { expect } from '@playwright/test';
export default async ({ page, shot, fixture, baseURL, log }) => {
  const offOrigin = [];
  page.on('request', (r) => {
    if (!r.url().startsWith(baseURL)) offOrigin.push(r.url());
  });
  await page.goto('/');
  await page.setInputFiles('input[type=file]', [fixture('suggestions-a.csv')]);
  const banner = page.getByRole('button', { name: /rule suggestions? for Other/ });
  await expect(banner).toHaveText(/1 rule suggestion for Other/);
  await banner.click();
  await expect(page.getByText('Covers 3 rows in Other')).toBeVisible();
  await shot('expanded');

  await page.getByRole('button', { name: /^Dismiss contains “PINE HOLLOW FEED STORE”/ }).click();
  await expect(banner).toBeHidden();
  await page.reload();
  await expect(page.getByRole('heading', { name: /Transactions/ })).toBeVisible();
  await expect(banner).toBeHidden();

  await page.setInputFiles('input[type=file]', [fixture('suggestions-b.csv')]);
  await expect(page.getByRole('row', { name: /PINE HOLLOW FEED STORE #0044/ })).toBeVisible();
  await expect(banner).toHaveText(/1 rule suggestion for Other/);
  await banner.click();
  await expect(page.getByRole('button', { name: /PINE HOLLOW/ })).toHaveCount(0);
  await shot('rechecked');

  await page
    .getByRole('button', { name: /^Create rule for contains “COPPER KETTLE ROASTERS”/ })
    .click();
  await expect(page).toHaveURL(/\/settings\/rules\/new$/);
  await page.getByLabel('Category name').fill('Coffee');
  await page.getByRole('button', { name: 'Save rule' }).click();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Transactions/ })).toBeVisible();
  await expect(banner).toBeHidden();
  await shot('none-left');
  expect(offOrigin, 'signed-out suggestions make no off-origin request').toEqual([]);
};
```

Proof: the banner and card on the first upload, a dismissal that survives a reload and an
overlapping upload, the other merchant appearing once it reaches 3 rows, and the banner gone once a
saved rule claims the rows. No request leaves the origin.

## Gotchas

- Fixtures `suggestions-a.csv` and `suggestions-b.csv` are the only ones that cluster. `june.csv`
  and `july.csv` have no merchant with 3 Other rows, so they show no banner.
- The expanded state is component state. It stays open if the last suggestion is dismissed and a
  later upload brings one back.
- Signed in, dismissals live in `preference.dismissed_suggestions`, not in the tab. Check the `dev`
  DB, not `sessionStorage`.
