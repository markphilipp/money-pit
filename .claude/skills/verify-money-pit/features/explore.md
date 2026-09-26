# Explore the table and charts

Filter, sort and chart the loaded transactions. Filters and chart mode persist across a reload.

## Sub-features

- Column menus: `Person`, `Amount`, `Date` and `Description`, each via its "<Col> column menu" button.
  - Person is a checklist.
  - Amount and Date have an operator plus value inputs ("Amount filter value", "Amount filter
    upper value").
  - Description has a text filter.
- Charts:
  - Spending by category. The "Chart type" group has a "Bars" toggle with `aria-pressed`; the
    alternative is a donut.
  - Spending by cardholder, a donut.
- Table footer total. `tfoot` contains "Total" and the filtered sum.
- "Reset" clears every filter.
- Reload keeps filters and chart mode.

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
  await page.getByRole('button', { name: 'Bars' }).click();
  await shot('filtered-bars');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Bars' })).toHaveAttribute('aria-pressed', 'true');
  await expect(count).toContainText('(1)');
  await shot('after-reload');
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(count).toContainText('(7)');
  await shot('reset');
};
```

Proof: the count narrows as each filter applies, the footer total matches, and the chart mode and
filtered count survive a reload. Reset restores the full count.

## Gotchas

- Close each column menu (`Escape`) before opening the next. They're Radix popovers.
- Filters persist in sessionStorage by design (`docs/architecture.md`), so the reload check is part
  of the feature, not an accident.
