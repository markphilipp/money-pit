'use client';

import { useMemo } from 'react';
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { checklistIncludes, readChecklist } from '@/lib/checklist';
import { selectPersonTotals } from '@/store/selectors';
import { useAppState, useFiltered, usePersonColors } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { ChartContextMenu } from './ChartContextMenu';
import { ChartModeToggle } from './ChartModeToggle';
import { useChartHitTest } from './useChartHitTest';
import { BAR_LAYOUT, BAR_SCALES, pctLabel, shade } from './chartSetup';
import styles from './Chart.module.css';

export function PersonChart() {
  const state = useAppState();
  const togglePersonFilter = useAppStore((s) => s.togglePersonFilter);
  const togglePersonExclusion = useAppStore((s) => s.togglePersonExclusion);
  const setColumnFilter = useAppStore((s) => s.setColumnFilter);
  const setPersonChartMode = useAppStore((s) => s.setPersonChartMode);
  const personColors = usePersonColors();
  const source = useFiltered({ ignorePerson: true });
  const totals = useMemo(() => selectPersonTotals(source, personColors), [source, personColors]);
  const checked = readChecklist(state.filters.columnFilters, 'person');
  const values = totals.map((p) => p.total);
  const items = totals.map((p) => ({ id: p.person, name: p.label }));
  const { barRef, donutRef, hitTest } = useChartHitTest(items, checked);

  const labels = totals.map((p) => p.label);
  const colors = totals.map((p) => shade(p.color, checklistIncludes(checked, p.person)));

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
      <ChartContextMenu
        hitTest={hitTest}
        checklist={checked}
        onToggleExclusion={togglePersonExclusion}
        onShowAll={() => setColumnFilter('person', null)}
        showAllLabel="Show all cardholders"
      >
        <div className={styles.box}>
          {totals.length === 0 ? (
            <p className={styles.empty}>No spending matches these filters.</p>
          ) : state.personChartMode === 'bar' ? (
            <Bar
              ref={barRef}
              data={barData}
              options={barOptions}
              aria-label="Spending by cardholder, bar chart"
            />
          ) : (
            <Doughnut
              ref={donutRef}
              data={donutData}
              options={donutOptions}
              aria-label="Spending by cardholder, donut chart"
            />
          )}
        </div>
      </ChartContextMenu>
    </div>
  );
}
