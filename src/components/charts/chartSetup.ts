import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { fmtMoney } from '@/lib/format';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);
ChartJS.defaults.font.family = "var(--font-inter), 'Inter', sans-serif";
ChartJS.defaults.color = '#1E2A26';

export const DIM = '40';

export function shade(color: string, active: boolean): string {
  return active ? color : color + DIM;
}

export const BAR_LAYOUT = { padding: { top: 26 } };

export const BAR_SCALES = {
  x: {
    grid: { color: '#DDE3DC' },
    ticks: {
      font: { family: "var(--font-mono), 'IBM Plex Mono', monospace", size: 11 },
      callback: (v: string | number) => '$' + Number(v).toLocaleString(),
    },
  },
  y: { grid: { display: false }, ticks: { font: { size: 12 } } },
} as const;

export function pctLabel(value: number, all: number[]): string {
  const total = all.reduce((a, b) => a + b, 0);
  const pct = total ? ((value / total) * 100).toFixed(1) : '0.0';
  return ` ${fmtMoney(value)} (${pct}%)`;
}
