'use client';

import { useMemo } from 'react';
import '@/components/charts/chartSetup';
import { CategoryChart } from '@/components/charts/CategoryChart';
import { PersonChart } from '@/components/charts/PersonChart';
import chartStyles from '@/components/charts/Chart.module.css';
import { Header } from '@/components/layout/Header';
import { StatsStrip } from '@/components/layout/StatsStrip';
import { RuleEditorScreen } from '@/components/rules/RuleEditorScreen';
import { TransactionTable } from '@/components/table/TransactionTable';
import { EmptyState } from '@/components/upload/EmptyState';
import { useHeightVar } from '@/hooks/useHeightVar';
import { useHydrated } from '@/store/useAppStore';
import { useAppState, useFiltered } from '@/store/hooks';
import { selectStats } from '@/store/selectors';
import styles from './page.module.css';

export default function Home() {
  const hydrated = useHydrated();
  const state = useAppState();
  const filtered = useFiltered();
  const stats = useMemo(() => selectStats(filtered, state.rules), [filtered, state.rules]);
  const chartsRef = useHeightVar('--charts-h');

  if (!hydrated) return <main className={`wrap ${styles.loading}`} aria-busy="true" />;
  // The rule editor is a full takeover rather than a route — the app is a single static page.
  if (state.ruleEditor) return <RuleEditorScreen />;
  if (state.rawRows.length === 0)
    return (
      <main className="wrap">
        <EmptyState />
      </main>
    );

  return (
    <main className="wrap">
      <Header />
      <StatsStrip stats={stats} />

      <div ref={chartsRef} className={styles.stickyCharts}>
        <div className={chartStyles.charts}>
          <CategoryChart />
          <PersonChart />
        </div>
      </div>

      <TransactionTable />
    </main>
  );
}
