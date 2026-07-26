import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChartOptions } from 'chart.js';
import { UserMenu } from '@/components/layout/UserMenu';
import { keywordsToGroup } from '@/lib/rules/engine';
import { useAppStore } from '@/store/useAppStore';
import { csvFile, resetStore, SAMPLE_CSV, SECOND_CSV } from '@/test/fixtures';
import Home from './page';

const chartClicks: ChartOptions<'doughnut'>['onClick'][] = [];

vi.mock('react-chartjs-2', () => {
  const stub = ({ options }: { options: ChartOptions<'doughnut'> }) => {
    chartClicks.push(options.onClick);
    return <div data-testid="chart" />;
  };
  return { Doughnut: stub, Bar: stub };
});

const clickCategorySlice = (index: number) => {
  const onClick = chartClicks.at(-2) as unknown as (e: null, els: { index: number }[]) => void;
  act(() => onClick(null, [{ index }]));
};

const tableRows = () => within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');

// Mirrors the real layout: the account menu sits outside the page, alongside it.
const renderApp = () =>
  render(
    <>
      <Home />
      <UserMenu />
    </>,
  );

const dropZone = () => screen.getByLabelText(/Drop statement CSVs here/);

beforeEach(async () => {
  chartClicks.length = 0;
  await resetStore();
  sessionStorage.clear();
});

describe('page', () => {
  it('shows the empty state, then the dashboard after an upload', async () => {
    const user = userEvent.setup();
    renderApp();

    expect(await screen.findByText(/Drop statement CSVs here/)).toBeInTheDocument();

    await user.upload(dropZone(), csvFile(SAMPLE_CSV));

    expect(await screen.findByRole('heading', { name: /Transactions/ })).toBeInTheDocument();
    expect(screen.getAllByText('$251.47')).toHaveLength(2); // net spend tile + table totals row
    expect(screen.getByText('(6)')).toBeInTheDocument();
  });

  it('dedupes a second overlapping statement added from the account menu', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.upload(dropZone(), csvFile(SAMPLE_CSV, 'jun.csv'));

    await screen.findByRole('heading', { name: /Transactions/ });
    await user.upload(
      screen.getByLabelText('Add statement CSV files'),
      csvFile(SECOND_CSV, 'jul.csv'),
    );

    await waitFor(() => expect(screen.getByText('(7)')).toBeInTheDocument());
  });

  it('filters the table when a category slice is clicked', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.upload(dropZone(), csvFile(SAMPLE_CSV));
    await screen.findByRole('heading', { name: /Transactions/ });

    clickCategorySlice(0); // Groceries — the largest slice

    expect(tableRows()).toHaveLength(1);
    expect(tableRows()[0]).toHaveTextContent('HARRIS TEETER');
  });

  it('searches, then resets every filter', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.upload(dropZone(), csvFile(SAMPLE_CSV));
    await screen.findByRole('heading', { name: /Transactions/ });

    await user.type(screen.getByLabelText('Search description'), 'lowes');
    expect(tableRows()).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(tableRows()).toHaveLength(6);
    expect(screen.getByLabelText('Search description')).toHaveValue('');
  });

  it('re-categorizes the table when a rule changes', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.upload(dropZone(), csvFile(SAMPLE_CSV));
    await screen.findByRole('heading', { name: /Transactions/ });

    // Home Improvement sits above Groceries, so claiming the merchant there re-categorizes the row
    act(() =>
      useAppStore.getState().setRule('home', {
        conditions: keywordsToGroup(['HARRIS TEETER']),
      }),
    );

    const groceryRow = tableRows().find((r) => r.textContent?.includes('HARRIS TEETER'))!;
    expect(within(groceryRow).getByTitle('Change category')).toHaveTextContent('Home Improvement');
  });

  it('has no in-page rules panel or filter bar left', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.upload(dropZone(), csvFile(SAMPLE_CSV));
    await screen.findByRole('heading', { name: /Transactions/ });

    expect(screen.queryByRole('button', { name: /Category rules/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Purchases')).not.toBeInTheDocument();
    expect(screen.queryByText('Refunds')).not.toBeInTheDocument();
  });

  it('returns to the empty state after starting over', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.upload(dropZone(), csvFile(SAMPLE_CSV));
    await screen.findByRole('heading', { name: /Transactions/ });

    await user.click(screen.getByLabelText('Account menu'));
    await user.click(screen.getByRole('menuitem', { name: 'Start over' }));
    await user.click(screen.getByRole('menuitem', { name: 'Confirm reset' }));

    expect(await screen.findByText(/Drop statement CSVs here/)).toBeInTheDocument();
    expect(useAppStore.getState().rawRows).toHaveLength(0);
  });
});
