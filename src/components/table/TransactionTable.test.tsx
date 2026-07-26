import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '@/store/useAppStore';
import { resetStore, seedStore } from '@/test/fixtures';
import { TransactionTable } from './TransactionTable';

const bodyRows = () => within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');
const firstCellTexts = () => bodyRows().map((r) => within(r).getAllByRole('cell')[1].textContent);

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

  it('sorts by a header click and flips on the second', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);

    await user.click(screen.getByRole('button', { name: 'Sort by Amount' }));
    expect(bodyRows()[0]).toHaveTextContent('HARRIS TEETER');

    await user.click(screen.getByRole('button', { name: 'Sort by Amount' }));
    expect(bodyRows()[0]).toHaveTextContent('Merchant Offers Credit');

    await user.click(screen.getByRole('button', { name: 'Sort by Description' }));
    expect(bodyRows()[0]).toHaveTextContent('AMAZON');
  });

  it('filters by person from the column header without sorting', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);

    await user.selectOptions(screen.getByLabelText('Filter by person'), 'JAMIE SAMPLE');

    expect(bodyRows()).toHaveLength(2);
    expect(useAppStore.getState().sort).toEqual({ key: 'date', dir: -1 });
  });

  it('filters on absolute amount from the column header', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);

    await user.type(screen.getByLabelText('Minimum amount'), '50');
    expect(bodyRows()).toHaveLength(2);

    await user.type(screen.getByLabelText('Maximum amount'), '100');
    expect(bodyRows()).toHaveLength(1);
    expect(bodyRows()[0]).toHaveTextContent('LOWES');
  });

  it('shows a helpful row when nothing matches', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);
    await user.type(screen.getByLabelText('Minimum amount'), '9999');
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

    await user.selectOptions(screen.getByLabelText('Filter by person'), 'JAMIE SAMPLE');
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

  it('bulk-changes the selection and clears it', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);

    await user.click(within(bodyRows()[0]).getByRole('checkbox'));
    await user.click(within(bodyRows()[1]).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Change category' }));
    await user.click(screen.getByRole('option', { name: /^Pets/ }));

    expect(Object.values(useAppStore.getState().overrides)).toEqual(['pets', 'pets']);
    expect(useAppStore.getState().selectedIds.size).toBe(0);
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
  });

  it('clears a selection from the bulk bar', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);

    await user.click(within(bodyRows()[0]).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Clear selection' }));

    expect(useAppStore.getState().selectedIds.size).toBe(0);
  });

  it('shows payments once the credits toggle is on', async () => {
    render(<TransactionTable />);
    expect(screen.queryByText(/ONLINE PAYMENT/)).not.toBeInTheDocument();

    useAppStore.getState().setFilter({ showCredits: true });
    expect(await screen.findByText(/ONLINE PAYMENT/)).toBeInTheDocument();
  });
});
