import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '@/store/useAppStore';
import { csvFile, resetStore, SECOND_CSV, seedStore } from '@/test/fixtures';
import { Header } from './Header';
import { StatsStrip } from './StatsStrip';

beforeEach(async () => {
  resetStore();
  await seedStore();
});

describe('Header', () => {
  it('adds another statement from the compact affordance', async () => {
    const user = userEvent.setup();
    render(<Header />);

    await user.upload(
      screen.getByLabelText('Add statement CSV files'),
      csvFile(SECOND_CSV, 'july.csv'),
    );

    await waitFor(() => expect(useAppStore.getState().rawRows).toHaveLength(8));
  });

  it('requires two clicks to start over', async () => {
    const user = userEvent.setup();
    render(<Header />);

    await user.click(screen.getByRole('button', { name: 'Start over' }));
    expect(useAppStore.getState().rawRows).toHaveLength(7);

    await user.click(screen.getByRole('button', { name: 'Confirm reset' }));
    expect(useAppStore.getState().rawRows).toHaveLength(0);
  });

  it('can back out of starting over', async () => {
    const user = userEvent.setup();
    render(<Header />);

    await user.click(screen.getByRole('button', { name: 'Start over' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('button', { name: 'Start over' })).toBeInTheDocument();
    expect(useAppStore.getState().rawRows).toHaveLength(7);
  });

  it('surfaces upload errors', async () => {
    const user = userEvent.setup();
    render(<Header />);

    await user.upload(
      screen.getByLabelText('Add statement CSV files'),
      csvFile('nope', 'broken.csv'),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('broken.csv');
  });
});

describe('StatsStrip', () => {
  it('formats the five summary cards', () => {
    render(
      <StatsStrip
        stats={{
          net: 251.47,
          purchases: 253.62,
          refunds: -2.15,
          count: 6,
          topCategory: 'Groceries',
        }}
      />,
    );

    expect(screen.getByText('$251.47')).toBeInTheDocument();
    expect(screen.getByText('$253.62')).toBeInTheDocument();
    expect(screen.getByText('−$2.15')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('Groceries')).toBeInTheDocument();
  });
});
