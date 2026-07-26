import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '@/store/useAppStore';
import { resetStore } from '@/test/fixtures';
import { RulesManagerModal } from './RulesManagerModal';

const builderProps: unknown[] = [];

vi.mock('./RuleBuilderModal', () => ({
  RuleBuilderModal: (props: { open: boolean; rule?: { id: string } }) => {
    builderProps.push(props);
    return props.open ? <div data-testid="builder">{props.rule?.id ?? 'new'}</div> : null;
  },
}));

const state = () => useAppStore.getState();
const lastBuilder = () => builderProps.at(-1) as { open: boolean; rule?: { id: string } };

beforeEach(() => {
  builderProps.length = 0;
  resetStore();
});

describe('RulesManagerModal', () => {
  it('lists every rule in match order with a condition summary', () => {
    render(<RulesManagerModal open onClose={vi.fn()} />);
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(12);
    expect(rows[0]).toHaveTextContent('Home Improvement');
    expect(rows[0]).toHaveTextContent('description contains LOWE or');
    expect(rows.at(-1)).toHaveTextContent('No conditions');
  });

  it('reorders and deletes through the store', async () => {
    const user = userEvent.setup();
    render(<RulesManagerModal open onClose={vi.fn()} />);

    await user.click(screen.getByLabelText('Move Groceries up'));
    expect(state().rules[0].id).toBe('grocery');

    await user.click(screen.getByLabelText('Delete Pets'));
    expect(state().rules.some((r) => r.id === 'pets')).toBe(false);
  });

  it('pins builtins: they cannot be reordered or deleted', () => {
    render(<RulesManagerModal open onClose={vi.fn()} />);
    const fallback = screen.getAllByRole('listitem').at(-1)!;
    expect(within(fallback).getByLabelText('Move Other up')).toBeDisabled();
    expect(within(fallback).getByLabelText('Delete Other')).toBeDisabled();
  });

  it('opens the builder empty for New rule and prefilled for Edit', async () => {
    const user = userEvent.setup();
    render(<RulesManagerModal open onClose={vi.fn()} />);
    expect(lastBuilder().open).toBe(false);

    await user.click(screen.getByRole('button', { name: 'New rule' }));
    expect(lastBuilder()).toMatchObject({ open: true, rule: undefined });

    await user.click(screen.getByLabelText('Edit Amazon'));
    expect(lastBuilder().rule?.id).toBe('amazon');
  });
});
