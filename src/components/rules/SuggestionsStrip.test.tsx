import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '@/store/useAppStore';
import { selectTransactions } from '@/store/selectors';
import { csvFile, HEADER, resetStore, SAMPLE_CSV, seedStore } from '@/test/fixtures';
import { routerMock } from '@/test/router';
import { SuggestionsStrip } from './SuggestionsStrip';

const state = () => useAppStore.getState();

const merchantRows = (name: string, stores: string[]) =>
  stores.map(
    (store, i) => `Cleared,07/0${i + 1}/2026,"${name} #${store} CHARLOTTE NC",9.99,,ALEX SAMPLE`,
  );

const SUGGESTIBLE_CSV = [
  HEADER,
  ...merchantRows('QUILLFEATHER SUPPLY', ['0001', '0002', '0003']),
  ...merchantRows('ZORBAMART', ['0101', '0102', '0103', '0104']),
].join('\n');

const banner = () => screen.getByRole('button', { name: /rule suggestions? for Other/ });

describe('SuggestionsStrip', () => {
  beforeEach(resetStore);

  it('renders nothing when no row is left in Other to learn from', async () => {
    await seedStore(SAMPLE_CSV);
    const { container } = render(<SuggestionsStrip />);
    expect(container).toBeEmptyDOMElement();
  });

  it('starts as a collapsed one-line banner', async () => {
    await seedStore(SUGGESTIBLE_CSV);
    render(<SuggestionsStrip />);

    expect(banner()).toHaveTextContent('2 rule suggestions for Other');
    expect(banner()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /^Create rule/ })).not.toBeInTheDocument();
  });

  it('expands to cards that say what they cover, largest first', async () => {
    const user = userEvent.setup();
    await seedStore(SUGGESTIBLE_CSV);
    render(<SuggestionsStrip />);
    await user.click(banner());

    expect(banner()).toHaveAttribute('aria-expanded', 'true');
    const cards = screen.getAllByRole('listitem').filter((li) => li.querySelector('button'));
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('contains “ZORBAMART”');
    expect(cards[0]).toHaveTextContent('Covers 4 rows in Other');
    expect(within(cards[0]).getAllByText(/^ZORBAMART #/)).toHaveLength(3);
    expect(cards[1]).toHaveTextContent('Covers 3 rows in Other');
  });

  it('seeds the rule editor with every covered row and navigates there', async () => {
    const user = userEvent.setup();
    await seedStore(SUGGESTIBLE_CSV);
    render(<SuggestionsStrip />);
    await user.click(banner());
    await user.click(screen.getByRole('button', { name: 'Create rule for contains “ZORBAMART”' }));

    const zorba = selectTransactions(state())
      .filter((t) => t.description.startsWith('ZORBAMART'))
      .map((t) => t.id);
    expect([...state().ruleSources].sort()).toEqual([...zorba].sort());
    expect(routerMock.push).toHaveBeenCalledWith('/rules/new');
  });

  it('dismisses a suggestion for good and keeps focus on the banner', async () => {
    const user = userEvent.setup();
    await seedStore(SUGGESTIBLE_CSV);
    render(<SuggestionsStrip />);
    await user.click(banner());
    await user.click(screen.getByRole('button', { name: 'Dismiss contains “ZORBAMART”' }));

    expect(state().dismissedSuggestions).toHaveLength(1);
    expect(banner()).toHaveTextContent('1 rule suggestion for Other');
    expect(banner()).toHaveFocus();
    expect(screen.queryByText(/ZORBAMART #/)).not.toBeInTheDocument();
  });

  it('disappears once the last suggestion is dismissed', async () => {
    const user = userEvent.setup();
    await seedStore(SUGGESTIBLE_CSV);
    const { container } = render(<SuggestionsStrip />);
    await user.click(banner());
    await user.click(screen.getByRole('button', { name: /^Dismiss contains “ZORBAMART”/ }));
    await user.click(
      screen.getByRole('button', { name: /^Dismiss contains “QUILLFEATHER SUPPLY”/ }),
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('keeps a dismissal after an upload that adds more of the same merchant', async () => {
    const user = userEvent.setup();
    await seedStore(SUGGESTIBLE_CSV);
    render(<SuggestionsStrip />);
    await user.click(banner());
    await user.click(screen.getByRole('button', { name: /^Dismiss contains “ZORBAMART”/ }));

    const more = [HEADER, ...merchantRows('ZORBAMART', ['0201', '0202'])].join('\n');
    await act(() => state().uploadFiles([csvFile(more, 'more.csv')]));

    expect(
      await screen.findByRole('button', { name: /1 rule suggestion for Other/ }),
    ).toBeVisible();
    expect(screen.queryByText(/ZORBAMART #/)).not.toBeInTheDocument();
  });

  it('shows at most five cards and says how many were left out', async () => {
    const user = userEvent.setup();
    const merchants = [
      'QUILLFEATHER',
      'ZORBAMART',
      'PLINKO',
      'FRUMBLE',
      'WIDGETRY',
      'SNAZZLE',
      'GLORP',
    ];
    const csv = [
      HEADER,
      ...merchants.flatMap((m) => merchantRows(`${m} SUPPLY`, ['01', '02', '03'])),
    ];
    await seedStore(csv.join('\n'));
    render(<SuggestionsStrip />);
    await user.click(banner());

    expect(screen.getAllByRole('button', { name: /^Create rule for/ })).toHaveLength(5);
    expect(screen.getByText('Showing the 5 largest of 7.')).toBeInTheDocument();
  });
});
