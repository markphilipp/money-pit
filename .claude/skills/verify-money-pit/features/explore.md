# Explore the table and charts

Filter, sort and chart the loaded transactions. Signed out, filters, sort and chart modes persist across a reload (signed in, only filters do; the account holds the rest).

## Sub-features

- Column menus: `Person`, `Category`, `Amount`, `Date` and `Description`, each via its "<Col> column
  menu" button. Each also offers sort and "Clear filter".
  - Person and Category are checklists.
  - Amount and Date have an operator plus value inputs ("Amount filter value", "Amount filter
    upper value"). The Amount operator defaults to `gte`, so `20` means 20 or more.
  - Description has a text filter.
- Charts:
  - Spending by category and spending by cardholder each have their own Donut/Bars toggle with
    `aria-pressed`, in groups named "Category chart type" and "Person chart type". Scope every
    `Bars` locator to one group: unscoped it matches both buttons and Playwright throws.
  - Clicking a slice or bar toggles that category or person filter.
- Charts pane: the "Hide charts" / "Show charts" button collapses it (it becomes `inert` and
  `aria-hidden`), and the "Resize charts" separator drags or steps with Arrow Up/Down by 20px. Both
  persist in `localStorage` (`money-pit:charts-pane`). Below 820px the pane is static and the bar is
  hidden.
- Table footer total. `tfoot` contains "Total" and the filtered sum.
- "Reset" clears every filter. The "Search description" box filters by text.
- Payments are hidden by default (7 of `june.csv`'s 8 rows show).
- Reload keeps filters and both chart modes.

## How to get to it (user POV)

Upload any statement on `/`. The table, charts and column menus appear above and below the fold.
The chart area is sticky.

## Driving it with drive.mjs

```js
import { expect } from '@playwright/test';
export default async ({ page, shot, fixture }) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', [fixture('june.csv')]);
  const count = page.getByRole('heading', { name: /Transactions/ });
  await expect(count).toContainText('(7)');
  await shot('loaded');
  await page.getByRole('button', { name: 'Person column menu' }).click();
  await page.getByRole('checkbox', { name: 'Jamie' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Amount column menu' }).click();
  await page.getByLabel('Amount filter value').fill('20');
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
  await shot('reset');
};
```

Proof: the count narrows as each filter applies, the footer total matches, and the category chart
mode and filtered count survive a reload while the cardholder chart stays on donut. The charts
pane hides, shows and resizes. Reset restores the full count.

## Gotchas

- Close each column menu (`Escape`) before opening the next. They're Radix popovers.
- Filters persist in sessionStorage by design (`docs/architecture.md`), so the reload check is part
  of the feature, not an accident.
