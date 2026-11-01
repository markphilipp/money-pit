'use client';

import { useState } from 'react';
import { useAppStore, useHydrated } from '@/store/useAppStore';
import styles from './PreviewBanner.module.css';

export function PreviewBanner({ branch }: { branch?: string }) {
  const hydrated = useHydrated();
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { sampleStatements } = await import('@/lib/sampleData');
      const files = sampleStatements().map(
        ({ name, text }) => new File([text], name, { type: 'text/csv' }),
      );
      await useAppStore.getState().uploadFiles(files);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.banner} role="status">
      <span className={styles.label}>Preview</span>
      <span className={styles.text}>
        Not production
        {branch ? (
          <>
            {' '}
            · <code>{branch}</code>
          </>
        ) : null}
      </span>
      <button className={styles.button} onClick={() => void load()} disabled={!hydrated || loading}>
        {loading ? 'Loading…' : 'Load sample data'}
      </button>
    </div>
  );
}
