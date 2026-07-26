import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);
ChartJS.defaults.font.family = "var(--font-inter), 'Inter', sans-serif";
ChartJS.defaults.color = '#1E2A26';

export const DIM = '40';

export function shade(color: string, active: boolean): string {
  return active ? color : color + DIM;
}
