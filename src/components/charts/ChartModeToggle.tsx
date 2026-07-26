'use client';

import type { ChartMode } from '@/lib/types';
import { useAppStore } from '@/store/useAppStore';
import styles from './Chart.module.css';

const MODES: { id: ChartMode; label: string }[] = [
  { id: 'donut', label: 'Donut' },
  { id: 'bar', label: 'Bars' },
];

export function ChartModeToggle() {
  const chartMode = useAppStore((s) => s.chartMode);
  const setChartMode = useAppStore((s) => s.setChartMode);

  return (
    <div className={styles.seg} role="group" aria-label="Chart type">
      {MODES.map((m) => (
        <button
          key={m.id}
          className={`${styles.segBtn} ${chartMode === m.id ? styles.active : ''}`}
          aria-pressed={chartMode === m.id}
          onClick={() => setChartMode(m.id)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
