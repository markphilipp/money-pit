'use client';

import { personShort } from '@/lib/format';
import { usePersons } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import styles from './Table.module.css';

/** Header filters live inside a sortable <th>; clicks must not reach the sort button. */
const stop = { onClick: (e: React.MouseEvent) => e.stopPropagation() };

export function PersonFilter() {
  const persons = usePersons();
  const person = useAppStore((s) => s.filters.person);
  const setFilter = useAppStore((s) => s.setFilter);

  return (
    <div className={styles.filterRow} {...stop}>
      <select
        aria-label="Filter by person"
        value={person ?? ''}
        onChange={(e) => setFilter({ person: e.target.value || null })}
      >
        <option value="">All</option>
        {persons.map((p) => (
          <option key={p.name} value={p.name}>
            {personShort(p.name)}
          </option>
        ))}
      </select>
    </div>
  );
}

export function AmountFilter() {
  const amountMin = useAppStore((s) => s.filters.amountMin);
  const amountMax = useAppStore((s) => s.filters.amountMax);
  const setFilter = useAppStore((s) => s.setFilter);

  const parse = (v: string) => (v === '' ? null : Number(v));

  return (
    <div className={styles.filterRow} {...stop}>
      <input
        type="number"
        step="0.01"
        placeholder="min"
        aria-label="Minimum amount"
        value={amountMin ?? ''}
        onChange={(e) => setFilter({ amountMin: parse(e.target.value) })}
      />
      <input
        type="number"
        step="0.01"
        placeholder="max"
        aria-label="Maximum amount"
        value={amountMax ?? ''}
        onChange={(e) => setFilter({ amountMax: parse(e.target.value) })}
      />
    </div>
  );
}
