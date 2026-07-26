'use client';

import { useMemo } from 'react';
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { fmtMoney } from '@/lib/format';
import { checklistValues } from '@/lib/rules/engine';
import { selectCategoryTotals } from '@/store/selectors';
import { useAppState, useFiltered } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { ChartModeToggle } from './ChartModeToggle';
import { shade } from './chartSetup';
import styles from './Chart.module.css';

function pctLabel(value: number, all: number[]): string {
  const total = all.reduce((a, b) => a + b, 0);
  const pct = total ? ((value / total) * 100).toFixed(1) : '0.0';
  return ` ${fmtMoney(value)} (${pct}%)`;
}

export function CategoryChart() {
  const state = useAppState();
  const toggleCategoryFilter = useAppStore((s) => s.toggleCategoryFilter);
  const source = useFiltered({ ignoreCategory: true });
  const totals = useMemo(() => selectCategoryTotals(source, state.rules), [source, state.rules]);
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
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'bar'>) => pctLabel(ctx.parsed.x ?? 0, values),
        },
      },
    },
    scales: {
      x: {
        grid: { color: '#DDE3DC' },
        ticks: {
          font: { family: "var(--font-mono), 'IBM Plex Mono', monospace", size: 11 },
          callback: (v) => '$' + Number(v).toLocaleString(),
        },
      },
      y: { grid: { display: false }, ticks: { font: { size: 12 } } },
    },
  };

  return (
    <div className="card">
      <div className={styles.cardTop}>
        <div>
          <h2>By Category</h2>
          <div className="sub" style={{ marginBottom: 12 }}>
            {isBar
              ? 'Click bars to toggle category filters — everything below updates. Selected bars stay bright.'
              : 'Click slices to toggle category filters — everything below updates. Selected slices stay bright.'}
          </div>
        </div>
        <ChartModeToggle />
      </div>
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
