import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '@/store/useAppStore';
import { csvFile, resetStore, SAMPLE_CSV, SECOND_CSV } from '@/test/fixtures';
import { TransactionTable } from './TransactionTable';

const bodyRows = () => within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');
const dates = () => bodyRows().map((r) => within(r).getAllByRole('cell')[1].textContent);
const combobox = () => screen.getByRole('combobox', { name: 'Filter by period' });
const option = (name: RegExp | string) => screen.getByRole('option', { name });
const state = () => useAppStore.getState();

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 6, 15, 12));
  await resetStore();
  await state().uploadFiles([csvFile(SAMPLE_CSV, 'june.csv'), csvFile(SECOND_CSV, 'second.csv')]);
});

afterEach(() => vi.useRealTimers());

describe('PeriodFilter', () => {
  it('shows an empty "All dates" input until a period is chosen', () => {
    render(<TransactionTable />);
    expect(combobox()).toHaveValue('');
    expect(combobox()).toHaveAttribute('placeholder', 'All dates');
    expect(combobox()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Clear date filter' })).not.toBeInTheDocument();
  });

  it('groups the options and opens on click', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);
    await user.click(combobox());

    expect(combobox()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('group')).toHaveLength(3);
    expect(screen.getByRole('group', { name: 'Statements' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Months in your data' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Recent' })).toBeInTheDocument();
    expect(option(/^june\.csv/)).toHaveTextContent('Jun 16 – Jul 3');
    expect(option('Custom range…')).toBeInTheDocument();
  });

  it('leaves out the statements group with a single file', async () => {
    const user = userEvent.setup();
    act(() => state().removeDataset(state().datasets[1].id));
    render(<TransactionTable />);
    await user.click(combobox());
    expect(screen.queryByRole('group', { name: 'Statements' })).not.toBeInTheDocument();
  });

  it('filters to a chosen statement', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);
    await user.click(combobox());
    await user.click(option(/^second\.csv/));

    expect(dates()).toEqual(['06/29/2026', '06/15/2026']);
    expect(combobox()).toHaveValue('second.csv');
    expect(combobox()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Clear date filter' })).toBeInTheDocument();
  });

  it('filters to a whole month and names it', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);
    await user.click(combobox());
    await user.click(option('June 2026'));

    expect(dates()).toEqual(['06/29/2026', '06/16/2026', '06/15/2026']);
    expect(combobox()).toHaveValue('June 2026');
    expect(state().filters.columnFilters.date).toEqual({
      column: 'date',
      operator: 'between',
      value: '2026-06-01',
      value2: '2026-06-30',
    });
  });

  it('resolves a recent preset to absolute dates', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);
    await user.click(combobox());
    await user.click(option(/^Last 30 days/));

    expect(dates()).toHaveLength(6);
    expect(dates()).not.toContain('06/15/2026');
    expect(combobox()).toHaveValue('Jun 16 – Jul 15, 2026');
  });

  it('takes typed shorthand with Enter', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);
    await user.click(combobox());
    await user.type(combobox(), '30d');

    expect(option(/^Last 30 days/)).toHaveTextContent('Jun 16 – Jul 15, 2026');
    await user.keyboard('{Enter}');
    expect(dates()).toHaveLength(6);
    expect(combobox()).toHaveValue('Jun 16 – Jul 15, 2026');
  });

  it('filters the options by substring', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);
    await user.click(combobox());
    await user.type(combobox(), 'JUN');

    expect(option(/^june\.csv/)).toBeInTheDocument();
    expect(option('June 2026')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /second\.csv/ })).not.toBeInTheDocument();
  });

  it('says nothing matches but still offers a custom range', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);
    await user.click(combobox());
    await user.type(combobox(), 'zzz');

    expect(screen.getByText('No matching period')).toBeInTheDocument();
    expect(option('Custom range…')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(1);
  });

  it('writes a custom range live and closes with Done', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);
    await user.click(combobox());
    await user.click(option('Custom range…'));

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-06-29' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-07-01' } });
    expect(dates()).toEqual(['07/01/2026', '07/01/2026', '06/29/2026']);
    expect(screen.getByLabelText('From')).toHaveValue('2026-06-29');

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByLabelText('From')).not.toBeInTheDocument();
    expect(combobox()).toHaveValue('Jun 29 – Jul 1, 2026');
  });

  it('goes back from the custom range to the list, and Escape closes everything', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);
    await user.click(combobox());
    await user.click(option('Custom range…'));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.click(option('Custom range…'));
    await user.keyboard('{Escape}');
    expect(screen.queryByLabelText('From')).not.toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(combobox()).toHaveFocus();
  });

  it('keeps one period at a time', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);

    await user.click(combobox());
    await user.click(option(/^second\.csv/));
    expect(state().filters.statementIds).toHaveLength(1);

    await user.click(combobox());
    await user.click(option('July 2026'));
    expect(state().filters.statementIds).toEqual([]);
    expect(state().filters.columnFilters.date).toBeDefined();
    expect(combobox()).toHaveValue('July 2026');

    await user.click(combobox());
    await user.click(option(/^june\.csv/));
    expect(state().filters.columnFilters.date).toBeUndefined();
    expect(combobox()).toHaveValue('june.csv');
  });

  it('clears with the x button', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);
    await user.click(combobox());
    await user.click(option('June 2026'));
    await user.click(screen.getByRole('button', { name: 'Clear date filter' }));

    expect(bodyRows()).toHaveLength(7);
    expect(combobox()).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Clear date filter' })).not.toBeInTheDocument();
  });

  it('clears with Reset', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);
    await user.click(combobox());
    await user.click(option(/^second\.csv/));
    await user.click(screen.getByRole('button', { name: 'Reset' }));

    expect(bodyRows()).toHaveLength(7);
    expect(combobox()).toHaveValue('');
  });

  it('shows a statement and a date filter set elsewhere together', () => {
    act(() => {
      state().setPeriod({ statementId: state().datasets[0].id });
      state().setColumnFilter('date', {
        column: 'date',
        operator: 'between',
        value: '2026-06-01',
        value2: '2026-06-30',
      });
    });
    render(<TransactionTable />);
    expect(combobox()).toHaveValue('june.csv · June 2026');
  });

  it('empties the input when its statement is removed', () => {
    act(() => state().setPeriod({ statementId: state().datasets[1].id }));
    render(<TransactionTable />);
    expect(combobox()).toHaveValue('second.csv');
    act(() => state().removeDataset(state().datasets[1].id));
    expect(combobox()).toHaveValue('');
    expect(bodyRows()).toHaveLength(6);
  });

  it('closes on an outside click', async () => {
    const user = userEvent.setup();
    render(<TransactionTable />);
    await user.click(combobox());
    await user.click(screen.getByLabelText('Search description'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  describe('keyboard', () => {
    const active = () => combobox().getAttribute('aria-activedescendant');
    const activeOption = () => document.getElementById(active()!)!;

    it('opens with ArrowDown and moves the active option', async () => {
      const user = userEvent.setup();
      render(<TransactionTable />);
      await user.click(combobox());
      await user.keyboard('{Escape}');
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');

      await user.keyboard('{ArrowDown}');
      expect(combobox()).toHaveAttribute('aria-expanded', 'true');
      expect(activeOption()).toHaveTextContent(/^june\.csv/);

      await user.keyboard('{ArrowDown}');
      expect(activeOption()).toHaveTextContent(/^second\.csv/);
      await user.keyboard('{ArrowUp}{ArrowUp}');
      expect(activeOption()).toHaveTextContent(/^june\.csv/);
    });

    it('jumps with Home and End, and clamps at the ends', async () => {
      const user = userEvent.setup();
      render(<TransactionTable />);
      await user.click(combobox());

      await user.keyboard('{End}');
      expect(activeOption()).toHaveTextContent('Custom range…');
      await user.keyboard('{ArrowDown}');
      expect(activeOption()).toHaveTextContent('Custom range…');
      await user.keyboard('{Home}');
      expect(activeOption()).toHaveTextContent(/^june\.csv/);
    });

    it('chooses with Enter and closes with Escape', async () => {
      const user = userEvent.setup();
      render(<TransactionTable />);
      await user.click(combobox());
      await user.keyboard('{ArrowDown}{Enter}');
      expect(dates()).toEqual(['06/29/2026', '06/15/2026']);
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');

      await user.click(screen.getByRole('button', { name: 'Clear date filter' }));
      await user.click(combobox());
      await user.keyboard('{Escape}');
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
      expect(bodyRows()).toHaveLength(7);
    });
  });
});
