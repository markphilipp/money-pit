'use client';

import { fmtMoney } from '@/lib/format';
import type { Stats } from '@/store/selectors';
import styles from './StatsStrip.module.css';

export function StatsStrip({ stats }: { stats: Stats }) {
  return (
    <div className={styles.stats}>
      <div className={styles.stat}>
        <div className={styles.label}>Net spend</div>
        <div className={styles.value}>{fmtMoney(stats.net)}</div>
      </div>
      <div className={styles.stat}>
        <div className={styles.label}>Transactions</div>
        <div className={styles.value}>{stats.count}</div>
      </div>
      <div className={styles.stat}>
        <div className={styles.label}>Top category</div>
        <div className={`${styles.value} ${styles.small}`}>{stats.topCategory}</div>
      </div>
    </div>
  );
}
