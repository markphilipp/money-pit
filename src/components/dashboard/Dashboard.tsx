'use client';

import { useMemo } from 'react';
import '@/components/charts/chartSetup';
import { CategoryChart } from '@/components/charts/CategoryChart';
import { PersonChart } from '@/components/charts/PersonChart';
import chartStyles from '@/components/charts/Chart.module.css';
import { Masthead } from '@/components/layout/Masthead';
import { TransactionTable } from '@/components/table/TransactionTable';
import { EmptyState } from '@/components/upload/EmptyState';
import { useHydrated } from '@/store/useAppStore';
import { useAppState, useFiltered } from '@/store/hooks';
import { selectStats } from '@/store/selectors';
import { ChartsPane } from './ChartsPane';
import styles from './Dashboard.module.css';

export function Dashboard() {
  const hydrated = useHydrated();
  const state = useAppState();
  const filtered = useFiltered();
  const stats = useMemo(
    () => selectStats(filtered, state.categories),
    [filtered, state.categories],
  );

  if (!hydrated) return <main className={`wrap ${styles.loading}`} aria-busy="true" />;
  if (state.rawRows.length === 0)
    return (
      <main className="wrap">
        <EmptyState />
      </main>
    );

  return (
    <main className="wrap">
      <Masthead stats={stats} />

      <ChartsPane>
        <div className={chartStyles.charts}>
          <CategoryChart />
          <PersonChart />
        </div>
      </ChartsPane>

      <TransactionTable />
    </main>
  );
}
