import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '@/store/useAppStore';
import { csvFile, resetStore, SAMPLE_CSV } from '@/test/fixtures';
import { EmptyState } from './EmptyState';

beforeEach(resetStore);

describe('EmptyState + UploadZone', () => {
  it('explains the expected CSV format', () => {
    render(<EmptyState />);
    expect(
      screen.getByText('Status,Date,Description,Debit,Credit,Member Name'),
    ).toBeInTheDocument();
  });

  it('loads a browsed file into the store', async () => {
    const user = userEvent.setup();
    const { container } = render(<EmptyState />);
    const input = container.querySelector('input[type=file]')!;

    await user.upload(input as HTMLInputElement, csvFile(SAMPLE_CSV));

    await waitFor(() => expect(useAppStore.getState().rawRows).toHaveLength(7));
  });

  it('accepts multiple csv files', () => {
    const { container } = render(<EmptyState />);
    const input = container.querySelector('input[type=file]') as HTMLInputElement;
    expect(input.multiple).toBe(true);
    expect(input.accept).toContain('.csv');
  });

  it('renders a per-file error without loading anything', async () => {
    const user = userEvent.setup();
    const { container } = render(<EmptyState />);
    const input = container.querySelector('input[type=file]')!;

    await user.upload(input as HTMLInputElement, csvFile('Date,Amount\n1,2', 'oops.csv'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/oops\.csv/);
    expect(useAppStore.getState().rawRows).toHaveLength(0);
  });

  it('loads files dropped onto the zone', async () => {
    render(<EmptyState />);
    const zone = screen.getByText('Drop statement CSVs here').closest('label')!;
    const file = csvFile(SAMPLE_CSV);

    const event = new Event('drop', { bubbles: true });
    Object.defineProperty(event, 'dataTransfer', { value: { files: [file] } });
    zone.dispatchEvent(event);

    await waitFor(() => expect(useAppStore.getState().rawRows).toHaveLength(7));
  });
});
