'use client';

import { useMemo } from 'react';
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { fmtMoney } from '@/lib/format';
import { selectPersonTotals } from '@/store/selectors';
import { useAppState, useFiltered, usePersonColors } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { shade } from './chartSetup';
import styles from './Chart.module.css';

export function PersonChart() {
  const state = useAppState();
  const setFilter = useAppStore((s) => s.setFilter);
  const personColors = usePersonColors();
  const source = useFiltered({ ignorePerson: true });
  const totals = useMemo(() => selectPersonTotals(source, personColors), [source, personColors]);
  const active = state.filters.person;
  const values = totals.map((p) => p.total);

  const data: ChartData<'doughnut', number[], string> = {
    labels: totals.map((p) => p.label),
    datasets: [
      {
        label: 'Spend',
        data: values,
        backgroundColor: totals.map((p) => shade(p.color, !active || active === p.person)),
        borderColor: '#FFFFFF',
        borderWidth: 2,
      },
    ],
  };

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '55%',
    plugins: {
      legend: {
        position: 'right',
        labels: { boxWidth: 12, boxHeight: 12, padding: 10, font: { size: 12 } },
      },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'doughnut'>) => {
            const total = values.reduce((a, b) => a + b, 0);
            const pct = total ? ((ctx.parsed / total) * 100).toFixed(1) : '0.0';
            return ` ${fmtMoney(ctx.parsed)} (${pct}%)`;
          },
        },
      },
    },
    onClick: (_e, elements) => {
      const hit = elements[0] as { index: number } | undefined;
      const person = hit ? totals[hit.index] : undefined;
      if (!person) return;
      setFilter({ person: active === person.person ? null : person.person });
    },
  };

  return (
    <div className="card">
      <h2>By Person</h2>
      <div className="sub" style={{ marginBottom: 12 }}>
        Click a slice to filter by cardholder; click again to clear. Syncs with the Person column
        filter.
      </div>
      <div className={styles.box}>
        {totals.length === 0 ? (
          <p className={styles.empty}>No spending matches these filters.</p>
        ) : (
          <Doughnut
            data={data}
            options={options}
            aria-label="Spending by cardholder, donut chart"
          />
        )}
      </div>
    </div>
  );
}
