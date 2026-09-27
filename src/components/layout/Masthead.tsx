'use client';

import type { Stats } from '@/store/selectors';
import { Header } from './Header';
import { StatsStrip } from './StatsStrip';
import styles from './Masthead.module.css';

export function Masthead({ stats }: { stats: Stats }) {
  return (
    <div className={styles.masthead}>
      <Header />
      <StatsStrip stats={stats} />
    </div>
  );
}
