'use client';

import type { ReactNode } from 'react';
import styles from './BulkBar.module.css';

interface BulkBarProps {
  count: number;
  onChangeCategory: (anchor: HTMLElement) => void;
  onCreateRule: () => void;
  onClear: () => void;
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Sits inline in the table card header, beside the search box, so the header never changes height. */
export function BulkBar({ count, onChangeCategory, onCreateRule, onClear }: BulkBarProps) {
  if (count === 0) return null;
  return (
    <div className={styles.bar} role="group" aria-label="Selection actions">
      <span className={styles.count}>{count} selected</span>
      <button
        className={styles.btn}
        aria-label="Change category"
        title="Change category"
        onClick={(e) => onChangeCategory(e.currentTarget)}
      >
        <Icon>
          <path d="M2 2h5.5l6.5 6.5-5.5 5.5L2 7.5z" />
          <circle cx="5.2" cy="5.2" r="0.9" />
        </Icon>
      </button>
      <button
        className={styles.btn}
        aria-label="Create rule"
        title="Create rule"
        onClick={onCreateRule}
      >
        <Icon>
          <path d="M2 4h12M4.5 8h7M7 12h2" />
        </Icon>
      </button>
      <button
        className={`${styles.btn} ${styles.ghost}`}
        aria-label="Clear selection"
        title="Clear selection"
        onClick={onClear}
      >
        <Icon>
          <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
        </Icon>
      </button>
    </div>
  );
}
