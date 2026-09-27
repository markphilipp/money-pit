'use client';

import type { ChartMode } from '@/lib/types';
import styles from './Chart.module.css';

const MODES: { id: ChartMode; label: string }[] = [
  { id: 'donut', label: 'Donut' },
  { id: 'bar', label: 'Bars' },
];

interface Props {
  mode: ChartMode;
  onChange: (mode: ChartMode) => void;
  label: string;
}

export function ChartModeToggle({ mode, onChange, label }: Props) {
  return (
    <div className={`${styles.seg} ${styles.corner}`} role="group" aria-label={label}>
      {MODES.map((m) => (
        <button
          key={m.id}
          className={`${styles.segBtn} ${mode === m.id ? styles.active : ''}`}
          aria-pressed={mode === m.id}
          onClick={() => onChange(m.id)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
