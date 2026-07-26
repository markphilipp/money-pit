import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '@/store/useAppStore';
import { resetStore, seedStore } from '@/test/fixtures';
import { TransactionTable } from './TransactionTable';

const bodyRows = () => within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');
const firstCellTexts = () => bodyRows().map((r) => within(r).getAllByRole('cell')[1].textContent);
const openMenu = (user: ReturnType<typeof userEvent.setup>, column: string) =>
  user.click(screen.getByRole('button', { name: `${column} column menu` }));

beforeEach(async () => {
  resetStore();
  await seedStore();
});

describe('TransactionTable', () => {
  it('lists non-payment rows newest first with the count in the title', () => {
    render(<TransactionTable />);
    expect(screen.getByText('(6)')).toBeInTheDocument();
    expect(firstCellTexts()).toEqual([
      '07/03/2026',
      '07/02/2026',
      '07/01/2026',
      '07/01/2026',
      '06/29/2026',
      '06/16/2026',
    ]);
  });

  it('styles credits in green', () => {
    render(<TransactionTable />);
    const creditRow = bodyRows().at(-1)!;
    expect(within(creditRow).getByText('−$2.15').className).toMatch(/credit/);
  });

  it('totals the visible rows in the footer', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);
    const footer = screen.getAllByRole('rowgroup')[2];
    expect(within(footer).getByText('Total')).toBeInTheDocument();
    expect(within(footer).getByText('$251.47')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search description'), 'lowes');
    expect(within(footer).getByText('$86.14')).toBeInTheDocument();
  });

  it('sorts from the column menu in the direction asked for', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);

    await openMenu(user, 'Amount');
    await user.click(screen.getByRole('menuitem', { name: 'Sort descending' }));
    expect(bodyRows()[0]).toHaveTextContent('HARRIS TEETER');

    await openMenu(user, 'Amount');
    await user.click(screen.getByRole('menuitem', { name: 'Sort ascending' }));
    expect(bodyRows()[0]).toHaveTextContent('Merchant Offers Credit');
    expect(useAppStore.getState().sort).toEqual({ key: 'amount', dir: 1 });
  });

  it('filters by a person checklist without sorting', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);

    await openMenu(user, 'Person');
    await user.click(screen.getByRole('checkbox', { name: 'Jamie' }));

    expect(bodyRows()).toHaveLength(2);
    expect(useAppStore.getState().sort).toEqual({ key: 'date', dir: -1 });
  });

  it('filters on an amount range from the column menu', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);

    await openMenu(user, 'Amount');
    await user.selectOptions(screen.getByLabelText('Amount filter operator'), 'between');
    await user.type(screen.getByLabelText('Amount filter value'), '50');
    expect(bodyRows()).toHaveLength(2);

    await user.type(screen.getByLabelText('Amount filter upper value'), '100');
    expect(bodyRows()).toHaveLength(1);
    expect(bodyRows()[0]).toHaveTextContent('LOWES');
  });

  it('clears a column filter again from the menu', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);

    await openMenu(user, 'Category');
    await user.click(screen.getByRole('checkbox', { name: 'Groceries' }));
    expect(bodyRows()).toHaveLength(1);
    await user.keyboard('{Escape}');

    await openMenu(user, 'Category');
    await user.click(screen.getByRole('menuitem', { name: 'Clear filter' }));
    expect(bodyRows()).toHaveLength(6);
  });

  it('shows a row when nothing matches', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);
    await openMenu(user, 'Amount');
    await user.type(screen.getByLabelText('Amount filter value'), '9999');
    expect(screen.getByText(/No transactions match these filters/)).toBeInTheDocument();
  });

  it('reassigns a single row through the pill picker', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);

    await user.click(within(bodyRows()[0]).getByTitle('Change category'));
    await user.click(screen.getByRole('option', { name: /^Pets/ }));

    expect(within(bodyRows()[0]).getByTitle('Change category')).toHaveTextContent('Pets');
    expect(Object.values(useAppStore.getState().overrides)).toEqual(['pets']);
  });

  it('drives the picker from the keyboard and never offers Payments', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);

    await user.click(within(bodyRows()[0]).getByTitle('Change category'));
    expect(screen.queryByRole('option', { name: /^Payments/ })).not.toBeInTheDocument();

    await user.keyboard('gro');
    expect(within(screen.getByRole('dialog')).getAllByRole('option')).toHaveLength(1);
    await user.keyboard('{Enter}');

    expect(within(bodyRows()[0]).getByTitle('Change category')).toHaveTextContent('Groceries');
  });

  it('closes the picker on Escape without changing anything', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);

    await user.click(within(bodyRows()[0]).getByTitle('Change category'));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(useAppStore.getState().overrides).toEqual({});
  });

  it('select-all covers only the filtered rows', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);

    await openMenu(user, 'Person');
    await user.click(screen.getByRole('checkbox', { name: 'Jamie' }));
    await user.keyboard('{Escape}');
    await user.click(screen.getByLabelText('Select all visible rows'));

    expect(useAppStore.getState().selectedIds.size).toBe(2);
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('marks select-all indeterminate for a partial selection', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);

    await user.click(within(bodyRows()[0]).getByRole('checkbox'));

    const selectAll = screen.getByLabelText('Select all visible rows') as HTMLInputElement;
    expect(selectAll.indeterminate).toBe(true);
    expect(selectAll.checked).toBe(false);
  });

  it('bulk-changes the selection and offers no clear button', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);

    await user.click(within(bodyRows()[0]).getByRole('checkbox'));
    await user.click(within(bodyRows()[1]).getByRole('checkbox'));
    expect(screen.queryByRole('button', { name: /clear selection/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Change category' }));
    await user.click(screen.getByRole('option', { name: /^Pets/ }));

    expect(Object.values(useAppStore.getState().overrides)).toEqual(['pets', 'pets']);
    expect(useAppStore.getState().selectedIds.size).toBe(0);
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
  });

  it('opens the rule editor on just the row from the row context menu', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);

    await user.pointer({ keys: '[MouseRight]', target: bodyRows()[0] });
    await user.click(screen.getByRole('menuitem', { name: 'Create rule from transaction' }));

    expect(useAppStore.getState().ruleEditor?.sourceIds).toHaveLength(1);
  });

  it('opens the rule editor on the whole selection from the bulk bar', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);

    await user.click(within(bodyRows()[0]).getByRole('checkbox'));
    await user.click(within(bodyRows()[1]).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Create rule' }));

    const { ruleEditor, selectedIds } = useAppStore.getState();
    expect(ruleEditor?.sourceIds).toEqual([...selectedIds]);
    expect(ruleEditor?.sourceIds).toHaveLength(2);
  });

  it('selects a row from its context menu', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);

    await user.pointer({ keys: '[MouseRight]', target: bodyRows()[1] });
    await user.click(screen.getByRole('menuitem', { name: 'Select row' }));

    expect(useAppStore.getState().selectedIds.size).toBe(1);
  });

  it('resets filters and selection from the header', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);

    await user.type(screen.getByLabelText('Search description'), 'lowes');
    await user.click(within(bodyRows()[0]).getByRole('checkbox'));
    expect(bodyRows()).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Reset' }));

    expect(bodyRows()).toHaveLength(6);
    expect(useAppStore.getState().selectedIds.size).toBe(0);
  });

  it('always hides payments', () => {
    render(<TransactionTable />);
    expect(screen.queryByText(/ONLINE PAYMENT/)).not.toBeInTheDocument();
  });
});
