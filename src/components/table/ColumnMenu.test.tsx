import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ColumnFilter, ColumnId } from '@/lib/rules/types';
import { ColumnMenu } from './ColumnMenu';

interface Overrides {
  columnId?: ColumnId;
  filter?: ColumnFilter | null;
  options?: { value: string; label: string; color?: string }[];
  active?: boolean;
}

function setup({
  columnId = 'description',
  filter = null,
  options,
  active = false,
}: Overrides = {}) {
  const onSort = vi.fn();
  const onFilter = vi.fn();
  const label = columnId[0].toUpperCase() + columnId.slice(1);
  render(
    <ColumnMenu
      label={label}
      columnId={columnId}
      sort={{ active, dir: 1 }}
      onSort={onSort}
      filter={filter}
      onFilter={onFilter}
      options={options}
    />,
  );
  return { onSort, onFilter, user: userEvent.setup(), label };
}

const open = async (user: ReturnType<typeof userEvent.setup>, label: string) =>
  user.click(screen.getByRole('button', { name: `${label} column menu` }));

describe('ColumnMenu', () => {
  it('sorts in both directions', async () => {
    const { user, onSort, label } = setup();
    await open(user, label);
    await user.click(screen.getByRole('menuitem', { name: 'Sort ascending' }));
    expect(onSort).toHaveBeenCalledWith(1);

    await open(user, label);
    await user.click(screen.getByRole('menuitem', { name: 'Sort descending' }));
    expect(onSort).toHaveBeenLastCalledWith(-1);
  });

  it('shows sort and filter indicators in the header', () => {
    setup({ active: true, filter: { column: 'description', operator: 'contains', value: 'X' } });
    expect(screen.getByRole('button', { name: 'Description column menu' })).toHaveTextContent('▲');
    expect(document.querySelector('svg')).toBeInTheDocument();
  });

  it('emits a typed description filter and a regex hint', async () => {
    const { user, onFilter, label } = setup();
    await open(user, label);

    await user.type(screen.getByLabelText('Description filter value'), 'costco');
    expect(onFilter).toHaveBeenLastCalledWith({
      column: 'description',
      operator: 'contains',
      value: 'costco',
    });

    await user.selectOptions(screen.getByLabelText('Description filter operator'), 'regex');
    expect(onFilter).toHaveBeenLastCalledWith({
      column: 'description',
      operator: 'regex',
      value: 'costco',
    });
    expect(screen.getByText(/JS regex/)).toBeInTheDocument();
  });

  it('emits null once the description value is emptied', async () => {
    const { user, onFilter, label } = setup({
      filter: { column: 'description', operator: 'contains', value: 'a' },
    });
    await open(user, label);
    await user.clear(screen.getByLabelText('Description filter value'));
    expect(onFilter).toHaveBeenLastCalledWith(null);
  });

  it('emits an amount range from the between operator', async () => {
    const { user, onFilter, label } = setup({ columnId: 'amount' });
    await open(user, label);

    await user.selectOptions(screen.getByLabelText('Amount filter operator'), 'between');
    await user.type(screen.getByLabelText('Amount filter value'), '10');
    await user.type(screen.getByLabelText('Amount filter upper value'), '50');

    expect(onFilter).toHaveBeenLastCalledWith({
      column: 'amount',
      operator: 'between',
      value: 10,
      value2: 50,
    });
  });

  it('emits a date filter', async () => {
    const { user, onFilter, label } = setup({ columnId: 'date' });
    await open(user, label);

    await user.selectOptions(screen.getByLabelText('Date filter operator'), 'after');
    await user.type(screen.getByLabelText('Date filter value'), '2026-07-01');

    expect(onFilter).toHaveBeenLastCalledWith({
      column: 'date',
      operator: 'after',
      value: '2026-07-01',
    });
  });

  it('emits a checklist for person and clears it when nothing is checked', async () => {
    const { user, onFilter, label } = setup({
      columnId: 'person',
      options: [
        { value: 'ALEX SAMPLE', label: 'Alex' },
        { value: 'JAMIE SAMPLE', label: 'Jamie' },
      ],
    });
    await open(user, label);

    await user.click(screen.getByRole('checkbox', { name: 'Alex' }));
    expect(onFilter).toHaveBeenLastCalledWith({ column: 'person', values: ['ALEX SAMPLE'] });
  });

  it('unchecks the last checklist entry back to no filter', async () => {
    const { user, onFilter, label } = setup({
      columnId: 'category',
      filter: { column: 'category', values: ['pets'] },
      options: [{ value: 'pets', label: 'Pets', color: '#111' }],
    });
    await open(user, label);

    await user.click(screen.getByRole('checkbox', { name: 'Pets' }));
    expect(onFilter).toHaveBeenLastCalledWith(null);
  });

  it('clears an active filter from the menu', async () => {
    const { user, onFilter, label } = setup({
      filter: { column: 'description', operator: 'contains', value: 'a' },
    });
    await open(user, label);
    await user.click(screen.getByRole('menuitem', { name: 'Clear filter' }));
    expect(onFilter).toHaveBeenLastCalledWith(null);
  });
});
