import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { selectTransactions } from '@/store/selectors';
import { useAppStore } from '@/store/useAppStore';
import { csvFile, resetStore, SAMPLE_CSV, SECOND_CSV } from '@/test/fixtures';
import { DatasetsScreen } from './DatasetsScreen';

const state = () => useAppStore.getState();

async function seedTwo() {
  await state().uploadFiles([csvFile(SAMPLE_CSV, 'june.csv'), csvFile(SECOND_CSV, 'july.csv')]);
}

describe('DatasetsScreen', () => {
  beforeEach(resetStore);

  it('shows an empty state and an upload zone when nothing is uploaded', async () => {
    render(<DatasetsScreen />);
    expect(await screen.findByText('No files uploaded yet.')).toBeInTheDocument();
    expect(screen.getByText('Drop more statement CSVs here')).toBeInTheDocument();
  });

  it('lists each file with its transaction count and date range', async () => {
    await seedTwo();
    render(<DatasetsScreen />);

    const row = (await screen.findByLabelText('Remove june.csv')).closest('li') as HTMLElement;
    expect(within(row).getByText('june.csv')).toBeInTheDocument();
    expect(row).toHaveTextContent('7 transactions');
    expect(row).toHaveTextContent('Jun 16 – Jul 3, 2026');
    expect(screen.getByLabelText('Remove july.csv').closest('li')).toHaveTextContent(
      '2 transactions',
    );
  });

  it('adds files from the page', async () => {
    const user = userEvent.setup();
    render(<DatasetsScreen />);
    await screen.findByText('No files uploaded yet.');

    await user.upload(document.querySelector('input[type="file"]')!, csvFile(SAMPLE_CSV, 'a.csv'));

    expect(await screen.findByLabelText('Remove a.csv')).toBeInTheDocument();
    expect(state().rawRows).toHaveLength(7);
  });

  it('states the impact before removing, then removes the file', async () => {
    await seedTwo();
    const lowes = selectTransactions(state()).find((t) => t.description.startsWith('LOWES'))!;
    const apple = selectTransactions(state()).find((t) => t.description.startsWith('APPLE'))!;
    state().setOverride([lowes.id, apple.id], 'pets');
    const user = userEvent.setup();
    render(<DatasetsScreen />);

    await user.click(await screen.findByLabelText('Remove june.csv'));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent(
      'Removes 6 transactions. 1 more also appears in other files and stays.',
    );
    expect(dialog).toHaveTextContent('1 manual category change will be lost.');
    expect(state().datasets).toHaveLength(2);

    await user.click(within(dialog).getByRole('button', { name: 'Remove file' }));

    expect(state().datasets.map((d) => d.name)).toEqual(['july.csv']);
    expect(state().rawRows).toHaveLength(2);
    expect(state().overrides).toEqual({ [lowes.id]: 'pets' });
    await waitFor(() => expect(screen.queryByLabelText('Remove june.csv')).not.toBeInTheDocument());
  });

  it('cancelling keeps the file', async () => {
    await seedTwo();
    const user = userEvent.setup();
    render(<DatasetsScreen />);

    await user.click(await screen.findByLabelText('Remove july.csv'));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(state().datasets).toHaveLength(2);
  });

  it('puts focus on the cancel button and returns it to the trigger on cancel', async () => {
    await seedTwo();
    const user = userEvent.setup();
    render(<DatasetsScreen />);

    const trigger = await screen.findByLabelText('Remove july.csv');
    await user.click(trigger);
    await screen.findByRole('alertdialog');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('warns that removing the last file empties the dashboard but keeps rules', async () => {
    await state().uploadFiles([csvFile(SAMPLE_CSV, 'only.csv')]);
    const rules = state().rules;
    const user = userEvent.setup();
    render(<DatasetsScreen />);

    await user.click(await screen.findByLabelText('Remove only.csv'));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('only file');
    await user.click(within(dialog).getByRole('button', { name: 'Remove file' }));

    expect(state().rawRows).toEqual([]);
    expect(state().rules).toBe(rules);
    expect(await screen.findByText('No files uploaded yet.')).toBeInTheDocument();
  });

  it('says so when every transaction is also in another file', async () => {
    const [first] = SAMPLE_CSV.split('\n').slice(1);
    await state().uploadFiles([
      csvFile(SAMPLE_CSV, 'full.csv'),
      csvFile(['Status,Date,Description,Debit,Credit,Member Name', first].join('\n'), 'one.csv'),
    ]);
    const user = userEvent.setup();
    render(<DatasetsScreen />);

    await user.click(await screen.findByLabelText('Remove one.csv'));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      'Removes no transactions: every one also appears in another file.',
    );
  });
});
