# Rules

Rules map transactions to categories. The first matching rule wins, in list order. "Payments" is
the only builtin rule, pinned last and not deletable. "Other" is a builtin category with no rule:
it's what nothing else claims, so it has no row in the list. Categories live on their own Settings
section, see [categories.md](categories.md).

## Sub-features

- **Rules list** (`/settings/rules`, h2 "Rules", inside the Settings shell: h1 "Settings", a nav named
  "Settings" and a "← Dashboard" link to `/`):
  - reorder with `Move <name> up` / `Move <name> down`;
  - `Edit <name>` opens `/settings/rules/<id>`;
  - `Delete <name>`, rendered but disabled for the builtin (title "Built-in rules cannot be
    deleted"), and its Move buttons are disabled too;
  - a rule's name is numbered ("Groceries #2") when its category has several rules, and
    `Edit`/`Move`/`Delete` use that name;
  - "New rule" goes to `/settings/rules/new`. Other sections are reached through the Settings nav.
- **Rule editor from a selection** (`/settings/rules/new` after a row or bulk or suggestion entry):
  - "Category name" (only while the choice is a new category, the default here);
  - a condition builder (react-querybuilder; the value input has `data-testid="value-editor"`);
  - a "Matches" preview section;
  - "Save rule", which is disabled while invalid and returns to `/`;
  - "Cancel", which returns to `/`;
  - "← All rules", a button that clears the selection and goes to `/settings/rules`;
  - when manual categories shadow the rule, a "Clear N manual categor…" checkbox, ticked by default.
- **Hand-written and edit form** (`/settings/rules/new` with no selection, and
  `/settings/rules/<id>`): a "Category" select, "Save", "Cancel" and a "← All rules" link, no
  "Matches" or "Suggested rules". Save, Cancel and Delete (non-builtin rules only) return to
  `/settings/rules`. A
  builtin's page disables the select and says "Built-in rule — conditions are fixed".
- **Create from one row**: right-click the row, pick "Create rule from transaction", and land on
  `/settings/rules/new` prefilled ("New rule from 1 transaction").
- **Create from several rows**: tick the row checkboxes (`Select <description>`), click "Create rule",
  and see suggested rules ("Suggested rules", e.g. a `contains “…”` button with `aria-pressed`;
  the quotes are curly). The BulkBar button's name is "Create rule", so use `{ exact: true }` when the
  suggestions banner is expanded: its `Create rule for <label>` buttons substring-match.
- **Create from a dashboard suggestion:** see [suggestions.md](suggestions.md).
- **Unknown id**: `/settings/rules/does-not-exist` shows "Rule not found" with a "← All rules" link.

## How to get to it (user POV)

- Account menu, then "Settings…", which lands on `/settings/rules`.
- The suggestions banner on `/` (see [suggestions.md](suggestions.md)).
- From the table: right-click a row, or multi-select rows and use "Create rule".
- Direct URLs `/settings/rules`, `/settings/rules/new` and `/settings/rules/<id>`. They're real
  routes, and `[id]` is server-rendered. `/settings` and the old `/rules/**` URLs redirect here.

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
  await expect(page).toHaveURL(/\/settings\/rules\/new$/);
  await expect(page.getByTestId('value-editor')).toHaveValue('Merchant Offers');
  await page.getByLabel('Category name').fill('Merchant Credits');
  await shot('editor-prefilled');
  await page.getByRole('button', { name: 'Save rule' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(row.getByTitle('Change category')).toContainText('Merchant Credits');
  await shot('applied');
  await page.getByLabel('Account menu').click();
  await page.getByRole('menuitem', { name: 'Settings…' }).click();
  await expect(page).toHaveURL(/\/settings\/rules$/);
  await expect(page.getByRole('heading', { name: 'Rules', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete Payments' })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Other/ })).toHaveCount(0);
  await shot('rules-list');
};
```

Proof: the prefilled editor, the saved rule immediately recategorizing the row on `/`, and the new
rule in `/settings/rules`, with the builtin Payments rule not deletable and no "Other" row.

## Gotchas

- Order matters. After a reorder, prove the effect on a row that two rules both match, not just the
  list order.
- A new rule is inserted above the Payments rule, never below it.
- Rules persist in sessionStorage under the key `categorization`. Signed in they sync to the `rule`
  and `category` tables (`category_rule` is the legacy pre-split table), so check those rows in the
  `dev` DB.
