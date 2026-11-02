import { useImperativeHandle, type Ref } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChartData, ChartOptions } from 'chart.js';
import { readChecklist } from '@/lib/checklist';
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
let hitIndex: number | null = null;

vi.mock('react-chartjs-2', () => {
  const stub = (type: 'doughnut' | 'bar') => {
    const Stub = ({
      data,
      options,
      ref,
    }: {
      data: Captured['data'];
      options: Captured['options'];
      ref?: Ref<unknown>;
    }) => {
      captured.push({ type, data, options });
      useImperativeHandle(ref, () => ({
        getElementsAtEventForMode: () => (hitIndex === null ? [] : [{ index: hitIndex }]),
      }));
      return <div data-testid={`chart-${type}`} />;
    };
    Stub.displayName = `${type}Stub`;
    return Stub;
  };
  return { Doughnut: stub('doughnut'), Bar: stub('bar') };
});

const last = () => captured.at(-1)!;
const personFilter = () =>
  readChecklist(useAppStore.getState().filters.columnFilters, 'person').values;
const categoryFilter = () => useAppStore.getState().filters.columnFilters.category;
const rightClick = (type: 'doughnut' | 'bar', index: number | null) => {
  hitIndex = index;
  fireEvent.contextMenu(screen.getByTestId(`chart-${type}`));
};
const clickSlice = (index: number) => {
  const onClick = last().options.onClick as (e: unknown, els: { index: number }[]) => void;
  act(() => onClick(null, [{ index }]));
};

beforeEach(async () => {
  captured.length = 0;
  hitIndex = null;
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
    expect(useAppStore.getState().personChartMode).toBe('donut');
  });
});

describe('CategoryChart context menu', () => {
  it.each(['doughnut', 'bar'] as const)('excludes the %s slice under the cursor', async (type) => {
    if (type === 'bar') useAppStore.setState({ chartMode: 'bar' });
    const user = userEvent.setup();
    render(<CategoryChart />);

    rightClick(type, 0);
    await user.click(
      await screen.findByRole('menuitem', { name: 'Exclude \u201CGroceries\u201D' }),
    );

    expect(categoryFilter()).toEqual({ column: 'category', values: ['grocery'], exclude: true });
    const colors = last().data.datasets[0].backgroundColor as string[];
    expect(colors[0]).toBe('#2E7D5B40');
    expect(colors[1]).toBe('#E8641B');
  });

  it('offers Include for an excluded category and re-includes it', async () => {
    const user = userEvent.setup();
    render(<CategoryChart />);
    act(() => useAppStore.getState().toggleCategoryExclusion('grocery'));

    rightClick('doughnut', 0);
    await user.click(
      await screen.findByRole('menuitem', { name: 'Include \u201CGroceries\u201D' }),
    );

    expect(categoryFilter()).toBeUndefined();
  });

  it('offers Exclude for another category while one is excluded', async () => {
    const user = userEvent.setup();
    render(<CategoryChart />);
    act(() => useAppStore.getState().toggleCategoryExclusion('grocery'));

    rightClick('doughnut', 2);
    await user.click(await screen.findByRole('menuitem', { name: 'Exclude \u201CAmazon\u201D' }));

    expect(categoryFilter()).toEqual({
      column: 'category',
      values: ['grocery', 'amazon'],
      exclude: true,
    });
  });

  it('shows "Show all categories" only while a category filter is active', async () => {
    const user = userEvent.setup();
    render(<CategoryChart />);

    rightClick('doughnut', 0);
    await screen.findByRole('menuitem', { name: /^Exclude/ });
    expect(screen.queryByRole('menuitem', { name: 'Show all categories' })).toBeNull();
    await user.keyboard('{Escape}');

    act(() => useAppStore.getState().toggleCategoryFilter('amazon'));
    rightClick('doughnut', 0);
    await user.click(await screen.findByRole('menuitem', { name: 'Show all categories' }));

    expect(categoryFilter()).toBeUndefined();
  });

  it('opens no menu when the click misses every slice', () => {
    render(<CategoryChart />);
    rightClick('doughnut', null);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('keeps left-click as an include filter', () => {
    render(<CategoryChart />);
    act(() => useAppStore.getState().toggleCategoryExclusion('grocery'));
    clickSlice(1);
    expect(categoryFilter()).toEqual({ column: 'category', values: ['home'] });
  });
});

describe('PersonChart context menu', () => {
  it.each(['doughnut', 'bar'] as const)('excludes the %s slice under the cursor', async (type) => {
    if (type === 'bar') useAppStore.setState({ personChartMode: 'bar' });
    const user = userEvent.setup();
    render(<PersonChart />);

    rightClick(type, 1);
    await user.click(await screen.findByRole('menuitem', { name: 'Exclude \u201CJamie\u201D' }));

    expect(useAppStore.getState().filters.columnFilters.person).toEqual({
      column: 'person',
      values: ['JAMIE SAMPLE'],
      exclude: true,
    });
    expect(last().data.datasets[0].backgroundColor).toEqual(['#E8641B', '#1F6F8B40']);
  });

  it('offers Include for an excluded cardholder and re-includes them', async () => {
    const user = userEvent.setup();
    render(<PersonChart />);
    act(() => useAppStore.getState().togglePersonExclusion('JAMIE SAMPLE'));

    rightClick('doughnut', 1);
    await user.click(await screen.findByRole('menuitem', { name: 'Include \u201CJamie\u201D' }));

    expect(useAppStore.getState().filters.columnFilters.person).toBeUndefined();
  });

  it('shows "Show all cardholders" only while a person filter is active', async () => {
    const user = userEvent.setup();
    render(<PersonChart />);

    rightClick('doughnut', 0);
    await screen.findByRole('menuitem', { name: /^Exclude/ });
    expect(screen.queryByRole('menuitem', { name: 'Show all cardholders' })).toBeNull();
    await user.keyboard('{Escape}');

    act(() => useAppStore.getState().togglePersonFilter('JAMIE SAMPLE'));
    rightClick('doughnut', 0);
    await user.click(await screen.findByRole('menuitem', { name: 'Show all cardholders' }));

    expect(useAppStore.getState().filters.columnFilters.person).toBeUndefined();
  });

  it('opens no menu when the click misses every slice', () => {
    render(<PersonChart />);
    rightClick('doughnut', null);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('keeps left-click as an include filter', () => {
    render(<PersonChart />);
    act(() => useAppStore.getState().togglePersonExclusion('ALEX SAMPLE'));
    clickSlice(1);
    expect(personFilter()).toEqual(['JAMIE SAMPLE']);
    expect(useAppStore.getState().filters.columnFilters.person).toEqual({
      column: 'person',
      values: ['JAMIE SAMPLE'],
    });
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

  it('switches to bars independently of the category chart', async () => {
    const user = userEvent.setup();
    render(<PersonChart />);

    await user.click(screen.getByRole('button', { name: 'Bars' }));

    expect(useAppStore.getState().personChartMode).toBe('bar');
    expect(useAppStore.getState().chartMode).toBe('donut');
    expect(last().type).toBe('bar');
    expect(last().data.labels).toEqual(['Alex', 'Jamie']);
  });

  it('filters by person when a bar is clicked', () => {
    useAppStore.setState({ personChartMode: 'bar' });
    render(<PersonChart />);
    clickSlice(1);
    expect(personFilter()).toEqual(['JAMIE SAMPLE']);
  });
});
