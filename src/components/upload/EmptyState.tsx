'use client';

import { EXPECTED_HEADER } from '@/lib/csv';
import { UploadZone } from './UploadZone';
import styles from './EmptyState.module.css';

export function EmptyState() {
  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <div className={styles.eyebrow}>Money Pit</div>
        <h1 className={styles.title}>
          Spending <span className={styles.thin}>Breakdown</span>
        </h1>
        <div className={styles.rule} />
        <p className={styles.pitch}>
          Drop in a credit-card statement export and see where the money actually went —
          auto-categorized by merchant, charted by category and cardholder, and correctable row by
          row.
        </p>

        <div className={styles.format}>
          <div className={styles.formatLabel}>Expected CSV format</div>
          <code className={styles.formatRow}>{EXPECTED_HEADER.join(',')}</code>
        </div>

        <UploadZone />

        <p className={styles.privacy}>
          Nothing is uploaded anywhere. Files are parsed in this browser tab and forgotten when you
          close it.
        </p>
      </div>
    </div>
  );
}
