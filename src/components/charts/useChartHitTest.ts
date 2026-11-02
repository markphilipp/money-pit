import { useRef } from 'react';
import type { Chart } from 'chart.js';
import type { Checklist } from '@/lib/checklist';
import type { ChartMenuTarget } from './ChartContextMenu';

interface ChartItem {
  id: string;
  name: string;
}

/** Only one of the two charts is mounted, so the hit test reads whichever ref is live. */
export function useChartHitTest(items: ChartItem[], checklist: Checklist) {
  const barRef = useRef<Chart<'bar', number[], string>>(null);
  const donutRef = useRef<Chart<'doughnut', number[], string>>(null);

  const hitTest = (e: MouseEvent): ChartMenuTarget | null => {
    const chart = barRef.current ?? donutRef.current;
    const hit = chart?.getElementsAtEventForMode(e, 'nearest', { intersect: true }, true)[0];
    const item = hit ? items[hit.index] : undefined;
    if (!item) return null;
    return { ...item, excluded: !!checklist.exclude && checklist.values.includes(item.id) };
  };

  return { barRef, donutRef, hitTest };
}
