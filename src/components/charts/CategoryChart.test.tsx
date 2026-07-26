import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChartData, ChartOptions } from 'chart.js';
import { checklistValues } from '@/lib/rules/engine';
import { useAppStore } from '@/store/useAppStore';
import { resetStore, seedStore } from '@/test/fixtures';
import { CategoryChart } from './CategoryChart';
import { PersonChart } from './PersonChart';

type Captured = {
  type: 'doughnut' | 'bar';
  data: ChartData<'doughnut' | 'bar', number[], string>;
  options: ChartOptions<'doughnut' | 'bar'>;
};

const captured: Captured[] = [];

vi.mock('react-chartjs-2', () => {
  const stub = (type: 'doughnut' | 'bar') => {
    const Stub = ({ data, options }: { data: Captured['data']; options: Captured['options'] }) => {
      captured.push({ type, data, options });
      return <div data-testid={`chart-${type}`} />;
    };
    Stub.displayName = `${type}Stub`;
    return Stub;
  };
  return { Doughnut: stub('doughnut'), Bar: stub('bar') };
});

const last = () => captured.at(-1)!;
const personFilter = () => checklistValues(useAppStore.getState().filters.columnFilters, 'person');
const clickSlice = (index: number) => {
  const onClick = last().options.onClick as (e: unknown, els: { index: number }[]) => void;
  act(() => onClick(null, [{ index }]));
};

beforeEach(async () => {
  captured.length = 0;
  await resetStore();
  await seedStore();
});

describe('CategoryChart', () => {
  it('charts spend per category, largest first, excluding payments', () => {
    render(<CategoryChart />);
    expect(last().type).toBe('doughnut');
    expect(last().data.labels).toEqual([
      'Groceries',
      'Home Improvement',
      'Amazon',
      'Dining & Fast Food',
      'Subscriptions & Software',
    ]);
    expect(last().data.datasets[0].data[0]).toBe(118.37);
    expect(last().data.labels).not.toContain('Payments');
  });

  it('dims unselected slices but keeps them in the chart', () => {
    render(<CategoryChart />);
    expect(last().data.datasets[0].backgroundColor).toEqual([
      '#2E7D5B',
      '#E8641B',
      '#D9A036',
      '#C94F3D',
      '#3A7CA5',
    ]);

    clickSlice(0);

    expect(useAppStore.getState().filters.columnFilters.category).toEqual({
      column: 'category',
      values: ['grocery'],
    });
    const colors = last().data.datasets[0].backgroundColor as string[];
    expect(colors[0]).toBe('#2E7D5B');
    expect(colors[1]).toBe('#E8641B40');
    expect(last().data.labels).toHaveLength(5);
  });

  it('toggles a category filter off when the slice is clicked again', () => {
    render(<CategoryChart />);
    clickSlice(2);
    expect(useAppStore.getState().filters.columnFilters.category).toEqual({
      column: 'category',
      values: ['amazon'],
    });
    clickSlice(2);
    expect(useAppStore.getState().filters.columnFilters.category).toBeUndefined();
  });

  it('switches to horizontal bars and persists the choice', async () => {
    const user = userEvent.setup();
    render(<CategoryChart />);

    await user.click(screen.getByRole('button', { name: 'Bars' }));

    expect(useAppStore.getState().chartMode).toBe('bar');
    expect(last().type).toBe('bar');
    expect((last().options as ChartOptions<'bar'>).indexAxis).toBe('y');
    expect(screen.getByText(/Click bars to toggle/)).toBeInTheDocument();
  });
});

describe('PersonChart', () => {
  it('charts each cardholder with a pinned color', () => {
    render(<PersonChart />);
    expect(last().data.labels).toEqual(['Alex', 'Jamie']);
    expect(last().data.datasets[0].backgroundColor).toEqual(['#E8641B', '#1F6F8B']);
  });

  it('filters by person on click and clears on a second click', () => {
    render(<PersonChart />);
    clickSlice(1);
    expect(personFilter()).toEqual(['JAMIE SAMPLE']);

    const colors = last().data.datasets[0].backgroundColor as string[];
    expect(colors).toEqual(['#E8641B40', '#1F6F8B']);

    clickSlice(0);
    expect(personFilter()).toEqual(['JAMIE SAMPLE', 'ALEX SAMPLE']);
    clickSlice(0);
    expect(personFilter()).toEqual(['JAMIE SAMPLE']);
  });
});
