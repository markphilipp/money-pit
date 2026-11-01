# Explore the table and charts

Filter, sort, select and chart the loaded transactions. Filters, sort and chart modes persist across
a reload.

## Sub-features

- Column menus for `Date`, `Description`, `Category`, `Person` and `Amount`, each via its
  "<Col> column menu" button. Every menu has "Sort ascending", "Sort descending", a filter section
  and "Clear filter". Filters apply live while the menu is open.
  - Category and Person are checklists. Person options use short names ("Jamie").
  - Amount and Date have an operator select ("Amount filter operator", default `≥`; Date default
    "On") and "… filter value". "… filter upper value" appears only for "between".
  - Description has an operator select (includes regex and glob) and "Description filter value".
- "Search description" box above the table.
- Sort: the default is date descending. The trigger shows ▲ or ▼ for the sorted column.
- Charts:
  - Spending by category and spending by cardholder each have their own Donut/Bars toggle with
    `aria-pressed`, in groups named "Category chart type" and "Person chart type". Scope every
    `Bars` locator to one group: unscoped it matches both buttons and Playwright throws.
  - Clicking a slice or bar toggles that category or person filter. Each chart ignores its own
    filter, so unselected slices dim instead of disappearing.
- Charts pane: the "Hide charts" / "Show charts" button collapses it (it becomes `inert` and
  `aria-hidden`), and the "Resize charts" separator drags or steps with Arrow Up/Down by 20px. Both
  persist in `localStorage` (`money-pit:charts-pane`). Below 820px the pane is static and the bar is
  hidden.
- Table footer: `tfoot` shows "Total" and the filtered sum.
- Payments are hidden by default (7 of `june.csv`'s 8 rows show).
- Bulk selection: "Select all visible rows" and per-row "Select <description>" open a bar with
  "N selected", "Change category" and "Create rule". Selection doesn't survive a reload.
- "Reset" clears every filter, the search box and the selection. It does not reset chart modes or
  sort.
- Persistence: signed out, filters, sort and both chart modes are in sessionStorage. Signed in, only
  filters are. Chart modes and sort are saved to the account (`setPreference`) and come back from it.

## How to get to it (user POV)

Upload any statement on `/`. The charts sit above the table and stay sticky while scrolling, on
screens wider than 820px.

## Driving it with drive.mjs

```js
import { expect } from '@playwright/test';
export default async ({ page, shot, fixture }) => {
  await page.goto('/');
  await page
    .locator('label', { hasText: 'Drop statement CSVs here' })
    .locator('input')
    .setInputFiles([fixture('june.csv')]);
  const count = page.getByRole('heading', { name: /Transactions/ });
  await expect(count).toContainText('(7)');
  await expect(
    page.getByRole('group', { name: 'Category chart type' }).getByRole('button', { name: 'Donut' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await shot('loaded');
  await page.getByRole('button', { name: 'Person column menu' }).click();
  await page.getByRole('checkbox', { name: 'Jamie' }).click();
  await page.keyboard.press('Escape');
  await expect(count).toContainText('(3)');
  await page.getByRole('button', { name: 'Amount column menu' }).click();
  await page.getByLabel('Amount filter value').fill('20');
  await page.getByRole('menuitem', { name: 'Sort ascending' }).click();
  await page.keyboard.press('Escape');
  await expect(count).toContainText('(1)');
  await expect(page.locator('tfoot')).toContainText('$64.20');
  const categoryBars = page
    .getByRole('group', { name: 'Category chart type' })
    .getByRole('button', { name: 'Bars' });
  const personBars = page
    .getByRole('group', { name: 'Person chart type' })
    .getByRole('button', { name: 'Bars' });
  await categoryBars.click();
  await expect(categoryBars).toHaveAttribute('aria-pressed', 'true');
  await expect(personBars).toHaveAttribute('aria-pressed', 'false');
  await shot('filtered-bars');
  await page.reload();
  await expect(categoryBars).toHaveAttribute('aria-pressed', 'true');
  await expect(count).toContainText('(1)');
  await expect(page.getByRole('button', { name: 'Amount column menu' })).toContainText('▲');
  await shot('after-reload');
  await page.getByRole('button', { name: 'Hide charts' }).click();
  await expect(page.getByRole('button', { name: 'Show charts' })).toBeVisible();
  await page.getByRole('button', { name: 'Show charts' }).click();
  const handle = page.getByRole('separator', { name: 'Resize charts' });
  const before = Number(await handle.getAttribute('aria-valuenow'));
  await handle.focus();
  await page.keyboard.press('ArrowUp');
  expect(Number(await handle.getAttribute('aria-valuenow'))).toBe(before - 20);
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(count).toContainText('(7)');
  await expect(categoryBars).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('checkbox', { name: 'Select all visible rows' }).check();
  await expect(page.getByText('7 selected')).toBeVisible();
  await shot('reset-and-selected');
};
```

Proof: the count narrows as each filter applies, the footer total matches, and the category chart
mode, filters and sort survive a reload while the cardholder chart stays on donut. The charts pane
hides, shows and resizes. Reset restores the full count but keeps chart mode, and bulk selection
opens its bar.

## Gotchas

- The column menus are Radix DropdownMenus with `modal={false}`. Close each (`Escape`) before
  opening the next.
- Signed in, the chart-mode and sort write is queued in the background. Wait on the account
  (`account.state().preference`) before a reload, not on `networkidle`.
