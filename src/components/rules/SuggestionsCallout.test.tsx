import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '@/store/useAppStore';
import { selectTransactions } from '@/store/selectors';
import { csvFile, HEADER, resetStore, SAMPLE_CSV, seedStore } from '@/test/fixtures';
import { routerMock } from '@/test/router';
import { SuggestionsCallout } from './SuggestionsCallout';

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

const pill = () => screen.getByRole('button', { name: /rule suggestions?$/, hidden: true });
const dialog = () => screen.getByRole('dialog', { name: 'Rule suggestions for Other' });

describe('SuggestionsCallout', () => {
  beforeEach(resetStore);

  it('renders nothing when no row is left in Other to learn from', async () => {
    await seedStore(SAMPLE_CSV);
    const { container } = render(<SuggestionsCallout />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a pill with the count, pluralized, and no dialog until clicked', async () => {
    await seedStore(SUGGESTIBLE_CSV);
    render(<SuggestionsCallout />);

    expect(pill()).toHaveTextContent('2 rule suggestions');
    expect(pill()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('uses the singular for one suggestion', async () => {
    await seedStore([HEADER, ...merchantRows('ZORBAMART', ['0101', '0102', '0103'])].join('\n'));
    render(<SuggestionsCallout />);
    expect(pill()).toHaveTextContent('1 rule suggestion');
    expect(pill()).not.toHaveTextContent('suggestions');
  });

  it('opens a dialog of cards that say what they cover, largest first', async () => {
    const user = userEvent.setup();
    await seedStore(SUGGESTIBLE_CSV);
    render(<SuggestionsCallout />);
    await user.click(pill());

    expect(dialog()).toHaveAccessibleDescription(/Rows left in Other that share a pattern/);
    const cards = within(dialog())
      .getAllByRole('listitem')
      .filter((li) => li.querySelector('button'));
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('contains “ZORBAMART”');
    expect(cards[0]).toHaveTextContent('Covers 4 rows in Other');
    expect(within(cards[0]).getAllByText(/^ZORBAMART #/)).toHaveLength(3);
    expect(cards[1]).toHaveTextContent('Covers 3 rows in Other');
  });

  it('closes from the footer button', async () => {
    const user = userEvent.setup();
    await seedStore(SUGGESTIBLE_CSV);
    render(<SuggestionsCallout />);
    await user.click(pill());
    await user.click(within(dialog()).getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(pill()).toHaveFocus();
  });

  it('seeds the rule editor with every covered row and navigates there', async () => {
    const user = userEvent.setup();
    await seedStore(SUGGESTIBLE_CSV);
    render(<SuggestionsCallout />);
    await user.click(pill());
    await user.click(screen.getByRole('button', { name: 'Create rule for contains “ZORBAMART”' }));

    const zorba = selectTransactions(state())
      .filter((t) => t.description.startsWith('ZORBAMART'))
      .map((t) => t.id);
    expect([...state().ruleSources].sort()).toEqual([...zorba].sort());
    expect(routerMock.push).toHaveBeenCalledWith('/settings/rules/new');
  });

  it('dismisses a suggestion for good, keeping the dialog open and focused', async () => {
    const user = userEvent.setup();
    await seedStore(SUGGESTIBLE_CSV);
    render(<SuggestionsCallout />);
    await user.click(pill());
    await user.click(screen.getByRole('button', { name: 'Dismiss contains “ZORBAMART”' }));

    expect(state().dismissedSuggestions).toHaveLength(1);
    expect(dialog()).toHaveFocus();
    expect(screen.queryByText(/ZORBAMART #/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Create rule for/ })).toHaveLength(1);
  });

  it('closes and hands focus on once the last suggestion is dismissed', async () => {
    const user = userEvent.setup();
    const onEmpty = vi.fn();
    await seedStore(SUGGESTIBLE_CSV);
    const { container } = render(<SuggestionsCallout onEmpty={onEmpty} />);
    await user.click(pill());
    await user.click(screen.getByRole('button', { name: /^Dismiss contains “ZORBAMART”/ }));
    await user.click(
      screen.getByRole('button', { name: /^Dismiss contains “QUILLFEATHER SUPPLY”/ }),
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(onEmpty).toHaveBeenCalledOnce());
  });

  it('stays closed when new suggestions appear after the last one was dismissed', async () => {
    const user = userEvent.setup();
    await seedStore(SUGGESTIBLE_CSV);
    render(<SuggestionsCallout />);
    await user.click(pill());
    await user.click(screen.getByRole('button', { name: /^Dismiss contains “ZORBAMART”/ }));
    await user.click(
      screen.getByRole('button', { name: /^Dismiss contains “QUILLFEATHER SUPPLY”/ }),
    );

    const more = [HEADER, ...merchantRows('BLUEHERON CAFE', ['0301', '0302', '0303'])].join('\n');
    await act(() => state().uploadFiles([csvFile(more, 'more.csv')]));

    await waitFor(() => expect(pill()).toHaveTextContent('1 rule suggestion'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps a dismissal after an upload that adds more of the same merchant', async () => {
    const user = userEvent.setup();
    await seedStore(SUGGESTIBLE_CSV);
    render(<SuggestionsCallout />);
    await user.click(pill());
    await user.click(screen.getByRole('button', { name: /^Dismiss contains “ZORBAMART”/ }));

    const more = [HEADER, ...merchantRows('ZORBAMART', ['0201', '0202'])].join('\n');
    await act(() => state().uploadFiles([csvFile(more, 'more.csv')]));

    await waitFor(() => expect(pill()).toHaveTextContent('1 rule suggestion'));
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
    render(<SuggestionsCallout />);
    await user.click(pill());

    expect(screen.getAllByRole('button', { name: /^Create rule for/ })).toHaveLength(5);
    expect(screen.getByText('Showing the 5 largest of 7.')).toBeInTheDocument();
  });
});
