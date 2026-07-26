'use client';

import { useMemo } from 'react';
import '@/components/charts/chartSetup';
import { CategoryChart } from '@/components/charts/CategoryChart';
import { PersonChart } from '@/components/charts/PersonChart';
import chartStyles from '@/components/charts/Chart.module.css';
import { Header } from '@/components/layout/Header';
import { StatsStrip } from '@/components/layout/StatsStrip';
import { RulesPanel } from '@/components/rules/RulesPanel';
import { TransactionTable } from '@/components/table/TransactionTable';
import { EmptyState } from '@/components/upload/EmptyState';
import { emptyFilters, useAppStore, useHydrated } from '@/store/useAppStore';
import { useAppState, useFiltered } from '@/store/hooks';
import { selectStats } from '@/store/selectors';
import styles from './page.module.css';

export default function Home() {
  const hydrated = useHydrated();
  const state = useAppState();
  const setFilter = useAppStore((s) => s.setFilter);
  const clearSelection = useAppStore((s) => s.clearSelection);
  const filtered = useFiltered();
  const stats = useMemo(() => selectStats(filtered, state.rules), [filtered, state.rules]);

  if (!hydrated) return <main className={`wrap ${styles.loading}`} aria-busy="true" />;
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

      <div className={styles.topBar}>
        <div className="field search">
          <label htmlFor="f-search">Search description</label>
          <input
            id="f-search"
            type="text"
            placeholder="e.g. amazon, mcdonalds…"
            value={state.filters.search}
            onChange={(e) => setFilter({ search: e.target.value })}
          />
        </div>
        <label className="toggle" style={{ paddingBottom: 8 }}>
          <input
            type="checkbox"
            checked={state.filters.showCredits}
            onChange={(e) => setFilter({ showCredits: e.target.checked })}
          />
          Show payments &amp; credits
        </label>
        <div className={styles.spacer} />
        <button
          className="btn-clear"
          onClick={() => {
            setFilter({ ...emptyFilters, categoryIds: new Set<string>() });
            clearSelection();
          }}
        >
          Reset
        </button>
      </div>

      <RulesPanel />

      <div className={chartStyles.charts}>
        <CategoryChart />
        <PersonChart />
      </div>

      <TransactionTable />
    </main>
  );
}
