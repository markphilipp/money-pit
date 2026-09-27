'use client';

import { useMemo } from 'react';
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { checklistValues } from '@/lib/rules/engine';
import { selectCategoryTotals } from '@/store/selectors';
import { useAppState, useFiltered } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { ChartModeToggle } from './ChartModeToggle';
import { BAR_LAYOUT, BAR_SCALES, pctLabel, shade } from './chartSetup';
import styles from './Chart.module.css';

export function CategoryChart() {
  const state = useAppState();
  const toggleCategoryFilter = useAppStore((s) => s.toggleCategoryFilter);
  const setChartMode = useAppStore((s) => s.setChartMode);
  const source = useFiltered({ ignoreCategory: true });
  const totals = useMemo(
    () => selectCategoryTotals(source, state.categories),
    [source, state.categories],
  );
  const selected = checklistValues(state.filters.columnFilters, 'category');
  const isBar = state.chartMode === 'bar';

  const colors = totals.map((c) =>
    shade(c.color, selected.length === 0 || selected.includes(c.id)),
  );
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
      <div className={styles.box}>
        {totals.length === 0 ? (
          <p className={styles.empty}>No spending matches these filters.</p>
        ) : isBar ? (
          <Bar data={barData} options={barOptions} aria-label="Spending by category, bar chart" />
        ) : (
          <Doughnut
            data={donutData}
            options={donutOptions}
            aria-label="Spending by category, donut chart"
          />
        )}
      </div>
    </div>
  );
}
