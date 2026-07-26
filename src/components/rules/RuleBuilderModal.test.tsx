import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { keywordsToGroup } from '@/lib/rules/engine';
import { useAppStore } from '@/store/useAppStore';
import { resetStore } from '@/test/fixtures';
import { RuleBuilderModal } from './RuleBuilderModal';

const rules = () => useAppStore.getState().rules;

beforeEach(() => {
  resetStore();
});

describe('RuleBuilderModal', () => {
  it('creates a rule from a draft prefill', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <RuleBuilderModal
        open
        onClose={onClose}
        draft={{ conditions: keywordsToGroup(['COSTCO WHSE']) }}
      />,
    );

    expect(screen.getByDisplayValue('COSTCO WHSE')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Category name'), 'Big Box');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const created = rules().find((r) => r.id === 'big-box')!;
    expect(created.conditions).toEqual(keywordsToGroup(['COSTCO WHSE']));
    expect(created.name).toBe('Big Box');
    expect(onClose).toHaveBeenCalled();
  });

  it('edits an existing rule in place', async () => {
    const user = userEvent.setup();
    render(
      <RuleBuilderModal open onClose={vi.fn()} rule={rules().find((r) => r.id === 'pets')!} />,
    );

    const name = screen.getByLabelText('Category name');
    await user.clear(name);
    await user.type(name, 'Critters');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(rules().find((r) => r.id === 'pets')?.name).toBe('Critters');
    expect(rules()).toHaveLength(12);
  });

  it('deletes a rule from edit mode', async () => {
    const user = userEvent.setup();
    render(
      <RuleBuilderModal open onClose={vi.fn()} rule={rules().find((r) => r.id === 'pets')!} />,
    );

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(rules().some((r) => r.id === 'pets')).toBe(false);
  });

  it('hides condition editing and delete for the fallback rule', () => {
    render(
      <RuleBuilderModal open onClose={vi.fn()} rule={rules().find((r) => r.id === 'other')!} />,
    );

    expect(screen.getByText('Fallback — no conditions')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Rule' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('keeps builtin conditions while allowing a color change', async () => {
    const user = userEvent.setup();
    const payments = rules().find((r) => r.id === 'payments')!;
    render(<RuleBuilderModal open onClose={vi.fn()} rule={payments} />);

    await user.click(screen.getByLabelText('Rule color'));
    await user.click(screen.getByLabelText('#1E8E82'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const after = rules().find((r) => r.id === 'payments')!;
    expect(after.color).toBe('#1E8E82');
    expect(after.conditions).toEqual(payments.conditions);
  });
});
