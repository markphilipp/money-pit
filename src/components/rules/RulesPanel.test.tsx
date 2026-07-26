import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '@/store/useAppStore';
import { selectTransactions } from '@/store/selectors';
import { resetStore, seedStore } from '@/test/fixtures';
import { RulesPanel } from './RulesPanel';

const categoryOf = (needle: string) =>
  selectTransactions(useAppStore.getState()).find((t) => t.description.includes(needle))
    ?.categoryId;

async function openPanel() {
  const user = userEvent.setup();
  render(<RulesPanel />);
  await user.click(screen.getByRole('button', { name: /Category rules/ }));
  return user;
}

beforeEach(async () => {
  resetStore();
  await seedStore();
});

describe('RulesPanel', () => {
  it('stays collapsed until asked', async () => {
    const user = userEvent.setup();
    render(<RulesPanel />);
    expect(screen.queryByLabelText('Keywords for Amazon')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Category rules/ }));
    expect(screen.getByLabelText('Keywords for Amazon')).toBeInTheDocument();
  });

  it('re-categorizes immediately when a keyword moves to another rule', async () => {
    const user = await openPanel();
    expect(categoryOf('AMAZON')).toBe('amazon');

    const keywords = screen.getByLabelText('Keywords for Groceries');
    await user.clear(keywords);
    await user.type(keywords, 'AMAZON');

    expect(categoryOf('AMAZON')).toBe('grocery');
  });

  it('adds a custom rule that categorizes matching rows', async () => {
    const user = await openPanel();
    expect(categoryOf('Merchant Offers')).toBe('other');

    await user.type(screen.getByLabelText('New category'), 'Card Perks');
    await user.type(screen.getByLabelText('Keywords'), 'MERCHANT OFFERS, LOWES');
    await user.click(screen.getByRole('button', { name: 'Add rule' }));

    expect(categoryOf('Merchant Offers')).toBe('card-perks');
    expect(categoryOf('LOWES')).toBe('home'); // new rules land last, so the earlier rule still wins
  });

  it('renames and recolors a builtin but refuses to delete it', async () => {
    const user = await openPanel();

    expect(screen.getByLabelText('Delete Payments')).toBeDisabled();
    expect(screen.getByLabelText('Delete Other')).toBeDisabled();

    await user.type(screen.getByLabelText('Name for Payments'), ' Made');
    expect(useAppStore.getState().rules.find((r) => r.id === 'payments')?.name).toBe(
      'Payments Made',
    );
  });

  it('deletes a custom rule and re-derives its rows', async () => {
    const user = await openPanel();

    await user.type(screen.getByLabelText('New category'), 'Card Perks');
    await user.type(screen.getByLabelText('Keywords'), 'MERCHANT OFFERS');
    await user.click(screen.getByRole('button', { name: 'Add rule' }));
    expect(categoryOf('Merchant Offers')).toBe('card-perks');

    await user.click(screen.getByLabelText('Delete Card Perks'));
    expect(categoryOf('Merchant Offers')).toBe('other');
  });

  it('reorders rules so the promoted one wins', async () => {
    const user = await openPanel();

    await user.type(screen.getByLabelText('New category'), 'Marketplace');
    await user.type(screen.getByLabelText('Keywords'), 'MKTPL');
    await user.click(screen.getByRole('button', { name: 'Add rule' }));
    expect(categoryOf('AMAZON')).toBe('amazon');

    for (let i = 0; i < 10; i++) {
      const up = screen.getByLabelText('Move Marketplace up');
      if (up.hasAttribute('disabled')) break;
      await user.click(up);
    }

    expect(categoryOf('AMAZON')).toBe('marketplace');
    expect(useAppStore.getState().rules.at(-1)?.id).toBe('other');
  });
});
