import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { resetStore, seedStore } from '@/test/fixtures';
import { Header } from './Header';
import { StatsStrip } from './StatsStrip';

beforeEach(async () => {
  resetStore();
  await seedStore();
});

describe('Header', () => {
  it('is a wordmark only — the actions live in the account menu', () => {
    render(<Header />);

    expect(screen.getByRole('heading', { name: 'The Money Pit' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('StatsStrip', () => {
  it('formats the three summary cards', () => {
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
    expect(screen.queryByText('$253.62')).not.toBeInTheDocument();
    expect(screen.queryByText('−$2.15')).not.toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('Groceries')).toBeInTheDocument();
  });
});
