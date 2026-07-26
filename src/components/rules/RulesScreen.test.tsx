import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { keywordsToGroup } from '@/lib/rules/engine';
import { useAppStore } from '@/store/useAppStore';
import { resetStore } from '@/test/fixtures';
import { RulesScreen } from './RulesScreen';

const row = (name: string) => screen.getByLabelText(`Edit ${name}`).closest('li') as HTMLElement;

describe('RulesScreen', () => {
  beforeEach(resetStore);

  it('lists every rule with a link to its own page', async () => {
    render(<RulesScreen />);

    expect(await screen.findByRole('heading', { name: 'Category rules' })).toBeInTheDocument();
    expect(screen.getByLabelText('Edit Groceries')).toHaveAttribute('href', '/rules/grocery');
    expect(row('Groceries')).toHaveTextContent(/description contains/i);
  });

  it('reorders a rule, which is what decides who wins a tie', async () => {
    const user = userEvent.setup();
    useAppStore.getState().addRule({
      id: 'bakery',
      name: 'Bakery',
      color: '#abc123',
      conditions: keywordsToGroup(['BAKERY']),
    });
    render(<RulesScreen />);

    const before = useAppStore.getState().rules.findIndex((r) => r.id === 'bakery');
    await user.click(await screen.findByLabelText('Move Bakery up'));

    expect(useAppStore.getState().rules.findIndex((r) => r.id === 'bakery')).toBe(before - 1);
  });

  it('deletes a rule but refuses to delete a built-in', async () => {
    const user = userEvent.setup();
    render(<RulesScreen />);

    await user.click(await screen.findByLabelText('Delete Groceries'));
    expect(useAppStore.getState().rules.some((r) => r.id === 'grocery')).toBe(false);

    expect(screen.getByLabelText('Delete Other')).toBeDisabled();
  });

  it('clears any leftover selection before a hand-written rule', async () => {
    const user = userEvent.setup();
    useAppStore.getState().setRuleSources(['stale-id']);
    render(<RulesScreen />);

    await user.click(await screen.findByRole('link', { name: 'New rule' }));

    expect(useAppStore.getState().ruleSources).toEqual([]);
  });
});
