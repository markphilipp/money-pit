'use client';

import { useMemo } from 'react';
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { checklistIncludes, readChecklist } from '@/lib/checklist';
import { selectCategoryTotals } from '@/store/selectors';
import { useAppState, useFiltered } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { ChartContextMenu } from './ChartContextMenu';
import { ChartModeToggle } from './ChartModeToggle';
import { useChartHitTest } from './useChartHitTest';
import { BAR_LAYOUT, BAR_SCALES, pctLabel, shade } from './chartSetup';
import styles from './Chart.module.css';

export function CategoryChart() {
  const state = useAppState();
  const toggleCategoryFilter = useAppStore((s) => s.toggleCategoryFilter);
  const toggleCategoryExclusion = useAppStore((s) => s.toggleCategoryExclusion);
  const setColumnFilter = useAppStore((s) => s.setColumnFilter);
  const setChartMode = useAppStore((s) => s.setChartMode);
  const source = useFiltered({ ignoreCategory: true });
  const totals = useMemo(
    () => selectCategoryTotals(source, state.categories),
    [source, state.categories],
  );
  const checked = readChecklist(state.filters.columnFilters, 'category');
  const isBar = state.chartMode === 'bar';
  const items = totals.map((c) => ({ id: c.id, name: c.name }));
  const { barRef, donutRef, hitTest } = useChartHitTest(items, checked);

  const colors = totals.map((c) => shade(c.color, checklistIncludes(checked, c.id)));
  const values = totals.map((c) => c.total);

  const labels = totals.map((c) => c.name);

  const donutData: ChartData<'doughnut', number[], string> = {
    labels,
    datasets: [
      {
        label: 'Spend',
        data: values,
        backgroundColor: colors,
        borderColor: '#FFFFFF',
        borderWidth: 2,
      },
    ],
  };

  const barData: ChartData<'bar', number[], string> = {
    labels,
    datasets: [
      {
        label: 'Spend',
        data: values,
        backgroundColor: colors,
        borderRadius: 4,
        borderSkipped: false,
      },
    ],
  };

  const onClick = (_e: unknown, elements: { index: number }[]) => {
    const hit = elements[0];
    const category = hit ? totals[hit.index] : undefined;
    if (category) toggleCategoryFilter(category.id);
  };

  const donutOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    onClick,
    cutout: '55%',
    plugins: {
      legend: {
        position: 'right',
        labels: { boxWidth: 12, boxHeight: 12, padding: 10, font: { size: 12 } },
      },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'doughnut'>) => pctLabel(ctx.parsed, values),
        },
      },
    },
  };

  const barOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    onClick,
    indexAxis: 'y',
    layout: BAR_LAYOUT,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'bar'>) => pctLabel(ctx.parsed.x ?? 0, values),
        },
      },
    },
    scales: BAR_SCALES,
  };

  return (
    <div className={`card ${styles.card}`}>
      <ChartModeToggle mode={state.chartMode} onChange={setChartMode} label="Category chart type" />
      <ChartContextMenu
        hitTest={hitTest}
        checklist={checked}
        onToggleExclusion={toggleCategoryExclusion}
        onShowAll={() => setColumnFilter('category', null)}
        showAllLabel="Show all categories"
      >
        <div className={styles.box}>
          {totals.length === 0 ? (
            <p className={styles.empty}>No spending matches these filters.</p>
          ) : isBar ? (
            <Bar
              ref={barRef}
              data={barData}
              options={barOptions}
              aria-label="Spending by category, bar chart"
            />
          ) : (
            <Doughnut
              ref={donutRef}
              data={donutData}
              options={donutOptions}
              aria-label="Spending by category, donut chart"
            />
          )}
        </div>
      </ChartContextMenu>
    </div>
  );
}
