# Category rules

Rules map transactions to categories. The first matching rule wins, in list order. Two builtins,
"Payments" and "Other", are pinned last and can't be deleted.

## Sub-features

- **Rules list** (`/rules`, heading "Category rules"):
  - reorder with `Move <name> up` / `Move <name> down`;
  - `Edit <name>` opens `/rules/<id>`;
  - `Delete <name>`, which builtins don't have;
  - "New rule" goes to `/rules/new`, and "Done" goes back to `/`.
- **Rule editor**:
  - "Category name";
  - a condition builder (react-querybuilder; the value input has `data-testid="value-editor"`);
  - a "Matches" preview section;
  - "Save rule", which is disabled while invalid;
  - "← Back".
- **Create from one row**: right-click the row, pick "Create rule from transaction", and land on
  `/rules/new` prefilled ("New rule from 1 transaction").
- **Create from several rows**: tick the row checkboxes (`Select <description>`), click "Create rule",
  and see suggested rules ("Suggested rules", e.g. a `contains "…"` button with `aria-pressed`).
- **Unknown id**: `/rules/does-not-exist` shows "Rule not found".

## How to get to it (user POV)

- Account menu, then "Category rules…", which goes to `/rules`.
- From the table: right-click a row, or multi-select rows and use "Create rule".
- Direct URLs `/rules`, `/rules/new` and `/rules/<id>`. They're real routes, and `[id]` is
  server-rendered.

## Driving it with drive.mjs

```js
import { expect } from '@playwright/test';
export default async ({ page, shot, fixture }) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', [fixture('june.csv')]);
  const row = page.getByRole('row', { name: /Merchant Offers/ });
  await expect(row.getByTitle('Change category')).toContainText('Other');
  await row.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Create rule from transaction' }).click();
  await expect(page).toHaveURL(/\/rules\/new$/);
  await expect(page.getByTestId('value-editor')).toHaveValue('Merchant Offers');
  await page.getByLabel('Category name').fill('Merchant Credits');
  await shot('editor-prefilled');
  await page.getByRole('button', { name: 'Save rule' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(row.getByTitle('Change category')).toContainText('Merchant Credits');
  await shot('applied');
  await page.getByLabel('Account menu').click();
  await page.getByRole('menuitem', { name: 'Category rules…' }).click();
  await expect(page.getByRole('heading', { name: 'Category rules' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete Payments' })).toHaveCount(0);
  await shot('rules-list');
};
```

Proof: the prefilled editor, the saved rule immediately recategorizing the row on `/`, and the new
rule in `/rules`, with builtins not deletable.

## Gotchas

- Order matters. After a reorder, prove the effect on a row that two rules both match, not just the
  list order.
- A new rule is inserted above the builtins, never below "Other".
- Rules persist in sessionStorage today. When signed-in sync lands (plan step 4), also verify the
  `category_rule` rows in the `dev` DB.
