'use client';

import styles from './BulkBar.module.css';

interface Props {
  count: number;
  onChangeCategory: (anchor: HTMLElement) => void;
  onClear: () => void;
}

export function BulkBar({ count, onChangeCategory, onClear }: Props) {
  if (count === 0) return null;
  return (
    <div className={styles.bar}>
      <span className={styles.count}>{count} selected</span>
      <button className={styles.btn} onClick={(e) => onChangeCategory(e.currentTarget)}>
        Change category
      </button>
      <button className={`${styles.btn} ${styles.ghost}`} onClick={onClear}>
        Clear selection
      </button>
    </div>
  );
}
