import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HEADER, csvFile, resetStore } from '@/test/fixtures';
import { routerMock } from '@/test/router';
import { selectTransactions } from '@/store/selectors';
import { useAppStore } from '@/store/useAppStore';
import { RuleEditorScreen } from './RuleEditorScreen';

const BAKERY_CSV = [
  HEADER,
  'Cleared,07/01/2026,"BLUE RIDGE BAKERY #0042 CHARLOTTE NC",18.37,,ALEX SAMPLE',
  'Cleared,07/05/2026,"BLUE RIDGE BAKERY #0117 RALEIGH NC",22.10,,JAMIE SAMPLE',
  'Cleared,07/06/2026,"BLUE RIDGE BAKERY #0311 ASHEVILLE NC",9.99,,JAMIE SAMPLE',
  'Cleared,07/07/2026,"HARRIS TEETER #0042 CHARLOTTE NC",118.37,,ALEX SAMPLE',
  'Cleared,07/08/2026,"LOWES #01111 BELMONT NC",86.14,,ALEX SAMPLE',
].join('\n');

const idsFor = (descriptions: string[]) => {
  const txns = selectTransactions(useAppStore.getState());
  return descriptions.map((d) => txns.find((t) => t.description === d)!.id);
};

async function openEditor(descriptions: string[]) {
  await useAppStore.getState().uploadFiles([csvFile(BAKERY_CSV)]);
  useAppStore.getState().setRuleSources(idsFor(descriptions));
}

const BAKERIES = ['BLUE RIDGE BAKERY #0042 CHARLOTTE NC', 'BLUE RIDGE BAKERY #0117 RALEIGH NC'];

const section = (name: RegExp | string) =>
  screen.getByRole('heading', { name }).closest('section') as HTMLElement;

describe('RuleEditorScreen', () => {
  beforeEach(resetStore);

  it('leads with the induced merchant core and counts what else it would catch', async () => {
    await openEditor(BAKERIES);
    render(<RuleEditorScreen />);

    const cards = within(section('Suggested rules')).getAllByRole('button');
    expect(cards[0]).toHaveTextContent('contains “BLUE RIDGE BAKERY”');
    expect(cards[0]).toHaveTextContent('matches all 2 selected + 1 other');
    expect(cards[0]).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Category name')).toHaveValue('Blue Ridge Bakery');
  });

  it('focuses the new category name on arrival', async () => {
    await openEditor(BAKERIES);
    render(<RuleEditorScreen />);

    expect(screen.getByLabelText('Category name')).toHaveFocus();
  });

  it('always offers the exact descriptions as the last starting point', async () => {
    await openEditor(BAKERIES);
    render(<RuleEditorScreen />);

    const cards = within(section('Suggested rules')).getAllByRole('button');
    expect(cards.at(-1)).toHaveTextContent('one condition per description (2)');

    const user = userEvent.setup();
    await user.click(cards.at(-1)!);

    expect(screen.getByDisplayValue(BAKERIES[0])).toBeInTheDocument();
    expect(screen.getByDisplayValue(BAKERIES[1])).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /No other transactions match/ }),
    ).toBeInTheDocument();
  });

  it('lists the other transactions the rule would also claim', async () => {
    await openEditor(BAKERIES);
    render(<RuleEditorScreen />);

    const matches = section(/Also matches 1 other transaction/);
    expect(within(matches).getByText('BLUE RIDGE BAKERY #0311 ASHEVILLE NC')).toBeInTheDocument();
    expect(within(matches).queryByText('LOWES #01111 BELMONT NC')).not.toBeInTheDocument();
  });

  it('warns when an edit would drop one of the selected transactions', async () => {
    const user = userEvent.setup();
    await openEditor(BAKERIES);
    render(<RuleEditorScreen />);

    const value = screen.getByDisplayValue('BLUE RIDGE BAKERY');
    await user.clear(value);
    await user.type(value, 'BLUE RIDGE BAKERY #0042');

    expect(screen.getByRole('alert')).toHaveTextContent(
      '1 of the 2 transactions you selected will NOT match this rule',
    );
    const row = screen.getByText(BAKERIES[1]).closest('tr') as HTMLElement;
    expect(within(row).getByText('will not match')).toBeInTheDocument();
  });

  it('treats an emptied builder as "no rule yet" rather than a rule that excludes everything', async () => {
    const user = userEvent.setup();
    await openEditor(BAKERIES);
    render(<RuleEditorScreen />);

    await user.clear(screen.getByDisplayValue('BLUE RIDGE BAKERY'));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(/Add a condition to preview/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save rule' })).toBeDisabled();
  });

  it('flags a row an earlier rule already claims', async () => {
    await openEditor(['HARRIS TEETER #0042 CHARLOTTE NC']);
    render(<RuleEditorScreen />);

    const row = screen.getByText('HARRIS TEETER #0042 CHARLOTTE NC').closest('tr') as HTMLElement;
    expect(within(row).getByText('stays in Groceries')).toBeInTheDocument();
  });

  it('saves the rule and applies it to every match, not just the selection', async () => {
    const user = userEvent.setup();
    await openEditor(BAKERIES);
    render(<RuleEditorScreen />);

    await user.click(screen.getByRole('button', { name: 'Save rule' }));

    const state = useAppStore.getState();
    expect(state.ruleSources).toEqual([]);
    expect(routerMock.push).toHaveBeenCalledWith('/');
    expect(state.selectedIds.size).toBe(0);
    expect(state.categories.find((c) => c.id === 'blue-ridge-bakery')).toBeTruthy();
    expect(state.rules.some((r) => r.categoryId === 'blue-ridge-bakery')).toBe(true);

    const bakeries = selectTransactions(state).filter((t) => t.description.includes('BAKERY'));
    expect(bakeries).toHaveLength(3);
    expect(bakeries.every((t) => t.categoryId === 'blue-ridge-bakery')).toBe(true);
  });

  it('offers to clear the manual categories that would otherwise shadow the rule', async () => {
    const user = userEvent.setup();
    await openEditor(BAKERIES);
    useAppStore.getState().setOverride(idsFor([BAKERIES[0]]), 'pets');
    render(<RuleEditorScreen />);

    const row = screen.getByText(BAKERIES[0]).closest('tr') as HTMLElement;
    expect(within(row).getByText('manual category wins')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save rule' }));

    const state = useAppStore.getState();
    expect(state.overrides).toEqual({});
    expect(selectTransactions(state).find((t) => t.description === BAKERIES[0])!.categoryId).toBe(
      'blue-ridge-bakery',
    );
  });

  it('keeps the manual categories when the offer is declined', async () => {
    const user = userEvent.setup();
    await openEditor(BAKERIES);
    useAppStore.getState().setOverride(idsFor([BAKERIES[0]]), 'pets');
    render(<RuleEditorScreen />);

    await user.click(screen.getByRole('checkbox', { name: /Clear 1 manual category/ }));
    await user.click(screen.getByRole('button', { name: 'Save rule' }));

    expect(Object.values(useAppStore.getState().overrides)).toEqual(['pets']);
  });

  it('routes back to the rules list without saving', async () => {
    const user = userEvent.setup();
    await openEditor(BAKERIES);
    render(<RuleEditorScreen />);

    await user.click(screen.getByRole('button', { name: '← All rules' }));

    expect(routerMock.push).toHaveBeenCalledWith('/settings/rules');
    expect(useAppStore.getState().ruleSources).toEqual([]);
    expect(useAppStore.getState().rules.some((r) => r.id === 'blue-ridge-bakery')).toBe(false);
  });

  it('cancels back to the dashboard', async () => {
    const user = userEvent.setup();
    await openEditor(BAKERIES);
    render(<RuleEditorScreen />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(routerMock.push).toHaveBeenCalledWith('/');
    expect(useAppStore.getState().ruleSources).toEqual([]);
  });

  it('falls back to a hand-written rule when nothing was selected', async () => {
    await useAppStore.getState().uploadFiles([csvFile(BAKERY_CSV)]);
    render(<RuleEditorScreen />);

    expect(await screen.findByRole('heading', { name: 'New rule' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Suggested rules' })).not.toBeInTheDocument();
  });

  describe('adding to an existing rule', () => {
    async function openWithTreatsRule() {
      await openEditor(BAKERIES);
      const store = useAppStore.getState();
      store.addCategory({ id: 'treats', name: 'Treats', color: '#aa5500' });
      store.addRule({
        id: 'treats-rule',
        categoryId: 'treats',
        conditions: {
          combinator: 'or',
          rules: [
            { field: 'description', operator: 'contains', value: 'LOWES' },
            { field: 'description', operator: 'contains', value: 'GELATO' },
          ],
        },
      });
    }

    type User = ReturnType<typeof userEvent.setup>;

    const startAdding = (user: User) =>
      user.click(screen.getByRole('radio', { name: 'Add to existing rule' }));

    const picker = () => screen.getByRole('combobox', { name: 'Existing rule' });

    const rulesListed = () => within(screen.getByRole('listbox')).queryAllByRole('option');

    const pickTreats = async (user: User) => {
      await startAdding(user);
      await user.click(
        within(screen.getByRole('listbox')).getByRole('option', { name: /^Treats/ }),
      );
    };

    it('hides the control when only builtin rules exist', async () => {
      await openEditor(BAKERIES);
      useAppStore.setState((s) => ({ rules: s.rules.filter((r) => r.builtin) }));
      render(<RuleEditorScreen />);

      expect(screen.queryByRole('radiogroup', { name: 'Rule target' })).not.toBeInTheDocument();
      expect(screen.getByLabelText('Category name')).toBeInTheDocument();
    });

    it('defaults to a new rule', async () => {
      await openWithTreatsRule();
      render(<RuleEditorScreen />);

      expect(screen.getByRole('radio', { name: 'New rule' })).toBeChecked();
      expect(screen.queryByRole('combobox', { name: 'Existing rule' })).not.toBeInTheDocument();
    });

    it('starts with no rule chosen and Save disabled', async () => {
      const user = userEvent.setup();
      await openWithTreatsRule();
      render(<RuleEditorScreen />);

      await startAdding(user);

      expect(picker()).toHaveFocus();
      expect(picker()).toHaveValue('');
      expect(
        screen.getByRole('heading', { name: 'Add 2 transactions to an existing rule' }),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText('Category')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Category name')).not.toBeInTheDocument();
      expect(screen.getByDisplayValue('BLUE RIDGE BAKERY')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('LOWES')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save rule' })).toBeDisabled();
    });

    it('offers only non-builtin rules, with their conditions', async () => {
      const user = userEvent.setup();
      await openWithTreatsRule();
      render(<RuleEditorScreen />);

      await startAdding(user);

      const options = rulesListed().map((o) => o.textContent);
      expect(options.some((o) => o?.startsWith('Treats'))).toBe(true);
      expect(options.some((o) => o?.includes('description contains LOWES or'))).toBe(true);
      expect(options.some((o) => o?.startsWith('Payments'))).toBe(false);
    });

    it('filters the rules by label as you type', async () => {
      const user = userEvent.setup();
      await openWithTreatsRule();
      render(<RuleEditorScreen />);

      await startAdding(user);
      await user.type(picker(), 'TREATS');

      const options = rulesListed();
      expect(options).toHaveLength(1);
      expect(options[0]).toHaveTextContent(/^Treats/);
    });

    it('finds a rule by a term in its conditions', async () => {
      const user = userEvent.setup();
      await openWithTreatsRule();
      render(<RuleEditorScreen />);

      await startAdding(user);
      await user.type(picker(), 'gelato');

      const options = rulesListed();
      expect(options).toHaveLength(1);
      expect(options[0]).toHaveTextContent(/^Treats/);
    });

    it('says so when no rule matches the search', async () => {
      const user = userEvent.setup();
      await openWithTreatsRule();
      render(<RuleEditorScreen />);

      await startAdding(user);
      await user.type(picker(), 'zzzz-nothing');

      expect(rulesListed()).toHaveLength(0);
      expect(screen.getByText('No matching rule')).toBeInTheDocument();
    });

    it('picks the highlighted rule with Enter', async () => {
      const user = userEvent.setup();
      await openWithTreatsRule();
      render(<RuleEditorScreen />);

      await startAdding(user);
      await user.type(picker(), 'gelato{Enter}');

      expect(picker()).toHaveValue('Treats');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Category')).toHaveValue('Treats');
      expect(screen.getByRole('button', { name: 'Save rule' })).toBeEnabled();
    });

    it('closes the list on Escape without choosing', async () => {
      const user = userEvent.setup();
      await openWithTreatsRule();
      render(<RuleEditorScreen />);

      await startAdding(user);
      await user.keyboard('{Escape}');

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save rule' })).toBeDisabled();
    });

    it('locks the category and merges the suggestion into the rule', async () => {
      const user = userEvent.setup();
      await openWithTreatsRule();
      render(<RuleEditorScreen />);

      await pickTreats(user);

      expect(screen.getByLabelText('Category')).toBeDisabled();
      expect(screen.getByLabelText('Category')).toHaveValue('Treats');
      expect(screen.queryByLabelText('Category name')).not.toBeInTheDocument();
      expect(screen.getByDisplayValue('LOWES')).toBeInTheDocument();
      expect(screen.getByDisplayValue('BLUE RIDGE BAKERY')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: 'Add 2 transactions to Treats rule' }),
      ).toBeInTheDocument();
    });

    it('re-merges when another suggestion is picked and re-seeds when switching back', async () => {
      const user = userEvent.setup();
      await openWithTreatsRule();
      render(<RuleEditorScreen />);

      await pickTreats(user);
      const cards = within(section('Suggested rules')).getAllByRole('button');
      await user.click(cards.at(-1)!);

      expect(screen.getByDisplayValue('LOWES')).toBeInTheDocument();
      expect(screen.getByDisplayValue(BAKERIES[0])).toBeInTheDocument();
      expect(screen.queryByDisplayValue('BLUE RIDGE BAKERY')).not.toBeInTheDocument();

      await user.click(screen.getByRole('radio', { name: 'New rule' }));
      expect(screen.queryByDisplayValue('LOWES')).not.toBeInTheDocument();
      expect(screen.getByDisplayValue(BAKERIES[0])).toBeInTheDocument();
      expect(screen.getByLabelText('Category name')).toBeInTheDocument();
    });

    it('lists only the rows the rule did not already match as newly matched', async () => {
      const user = userEvent.setup();
      await openWithTreatsRule();
      render(<RuleEditorScreen />);

      await pickTreats(user);

      const matches = section(/Also newly matches 1 other transaction/);
      expect(within(matches).getByText('BLUE RIDGE BAKERY #0311 ASHEVILLE NC')).toBeInTheDocument();
      expect(within(matches).queryByText('LOWES #01111 BELMONT NC')).not.toBeInTheDocument();
    });

    it('saves into the chosen rule without adding a rule or category', async () => {
      const user = userEvent.setup();
      await openWithTreatsRule();
      render(<RuleEditorScreen />);
      const before = useAppStore.getState();

      await pickTreats(user);
      await user.click(screen.getByRole('button', { name: 'Save rule' }));

      const state = useAppStore.getState();
      expect(state.rules).toHaveLength(before.rules.length);
      expect(state.categories).toHaveLength(before.categories.length);
      const rule = state.rules.find((r) => r.id === 'treats-rule')!;
      expect(rule.categoryId).toBe('treats');
      expect(rule.conditions).toEqual({
        combinator: 'or',
        rules: [
          { field: 'description', operator: 'contains', value: 'LOWES' },
          { field: 'description', operator: 'contains', value: 'GELATO' },
          { field: 'description', operator: 'contains', value: 'BLUE RIDGE BAKERY' },
        ],
      });
      expect(routerMock.push).toHaveBeenCalledWith('/');

      const bakeries = selectTransactions(state).filter((t) => t.description.includes('BAKERY'));
      expect(bakeries.every((t) => t.categoryId === 'treats')).toBe(true);
    });

    it('keeps a selected row an earlier rule claims tagged as staying put', async () => {
      const user = userEvent.setup();
      await openEditor(['HARRIS TEETER #0042 CHARLOTTE NC']);
      const store = useAppStore.getState();
      store.addCategory({ id: 'treats', name: 'Treats', color: '#aa5500' });
      store.addRule({
        id: 'treats-rule',
        categoryId: 'treats',
        conditions: {
          combinator: 'or',
          rules: [{ field: 'description', operator: 'contains', value: 'LOWES' }],
        },
      });
      render(<RuleEditorScreen />);

      await pickTreats(user);

      const row = screen.getByText('HARRIS TEETER #0042 CHARLOTTE NC').closest('tr') as HTMLElement;
      expect(within(row).getByText('stays in Groceries')).toBeInTheDocument();
    });
  });
});
