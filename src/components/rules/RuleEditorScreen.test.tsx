import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HEADER, csvFile, resetStore } from '@/test/fixtures';
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
  useAppStore.getState().openRuleEditor(idsFor(descriptions));
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
    expect(state.ruleEditor).toBeNull();
    expect(state.selectedIds.size).toBe(0);
    expect(state.rules.find((r) => r.id === 'blue-ridge-bakery')).toBeTruthy();

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

  it('goes back to the dashboard without saving', async () => {
    const user = userEvent.setup();
    await openEditor(BAKERIES);
    render(<RuleEditorScreen />);

    await user.click(screen.getByRole('button', { name: '← Back' }));

    expect(useAppStore.getState().ruleEditor).toBeNull();
    expect(useAppStore.getState().rules.some((r) => r.id === 'blue-ridge-bakery')).toBe(false);
  });
});
