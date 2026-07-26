'use client';

import styles from './BulkBar.module.css';

interface BulkBarProps {
  count: number;
  onChangeCategory: (anchor: HTMLElement) => void;
  onCreateRule: () => void;
}

/** Overlays the table card header (which must be `position: relative`) so nothing shifts. */
export function BulkBar({ count, onChangeCategory, onCreateRule }: BulkBarProps) {
  if (count === 0) return null;
  return (
    <div className={styles.bar}>
      <span className={styles.count}>{count} selected</span>
      <button className={styles.btn} onClick={(e) => onChangeCategory(e.currentTarget)}>
        Change category
      </button>
      <button className={styles.btn} onClick={onCreateRule}>
        Create rule
      </button>
    </div>
  );
}
