'use client';

import { useMemo } from 'react';
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { checklistValues } from '@/lib/rules/engine';
import { selectPersonTotals } from '@/store/selectors';
import { useAppState, useFiltered, usePersonColors } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { ChartModeToggle } from './ChartModeToggle';
import { BAR_LAYOUT, BAR_SCALES, pctLabel, shade } from './chartSetup';
import styles from './Chart.module.css';

export function PersonChart() {
  const state = useAppState();
  const togglePersonFilter = useAppStore((s) => s.togglePersonFilter);
  const setPersonChartMode = useAppStore((s) => s.setPersonChartMode);
  const personColors = usePersonColors();
  const source = useFiltered({ ignorePerson: true });
  const totals = useMemo(() => selectPersonTotals(source, personColors), [source, personColors]);
  const selected = checklistValues(state.filters.columnFilters, 'person');
  const values = totals.map((p) => p.total);

  const labels = totals.map((p) => p.label);
  const colors = totals.map((p) =>
    shade(p.color, selected.length === 0 || selected.includes(p.person)),
  );

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
    const person = hit ? totals[hit.index] : undefined;
    if (person) togglePersonFilter(person.person);
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
        callbacks: { label: (ctx: TooltipItem<'doughnut'>) => pctLabel(ctx.parsed, values) },
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
        callbacks: { label: (ctx: TooltipItem<'bar'>) => pctLabel(ctx.parsed.x ?? 0, values) },
      },
    },
    scales: BAR_SCALES,
  };

  return (
    <div className={`card ${styles.card}`}>
      <ChartModeToggle
        mode={state.personChartMode}
        onChange={setPersonChartMode}
        label="Person chart type"
      />
      <div className={styles.box}>
        {totals.length === 0 ? (
          <p className={styles.empty}>No spending matches these filters.</p>
        ) : state.personChartMode === 'bar' ? (
          <Bar data={barData} options={barOptions} aria-label="Spending by cardholder, bar chart" />
        ) : (
          <Doughnut
            data={donutData}
            options={donutOptions}
            aria-label="Spending by cardholder, donut chart"
          />
        )}
      </div>
    </div>
  );
}
