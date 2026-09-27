'use client';

import { useState } from 'react';
import type { SaveStatus } from '@/lib/saveStatus';
import styles from './SaveStatusToast.module.css';

function message(status: SaveStatus) {
  switch (status.kind) {
    case 'idle':
      return null;
    case 'saving':
      return 'Saving…';
    case 'saved':
      return 'Saved';
    case 'retrying':
      return `Couldn’t save. Retrying (${status.attempt} of ${status.of})…`;
    case 'failed':
      return status.reverted
        ? 'Couldn’t save. Your last change was undone.'
        : 'Couldn’t save, and your account is unreachable.';
  }
}

export function SaveStatusToast({ status }: { status: SaveStatus }) {
  const [dismissed, setDismissed] = useState<SaveStatus | null>(null);
  const text = message(status);
  const shown = text !== null && dismissed !== status;
  const key = status.kind === 'retrying' ? `retrying-${status.attempt}` : status.kind;

  return (
    <div className={styles.region} role="status" aria-live="polite">
      {shown && (
        <div key={key} className={`${styles.toast} ${styles[status.kind]}`}>
          <span>{text}</span>
          {status.kind === 'failed' &&
            (status.reverted ? (
              <button className={styles.action} onClick={() => setDismissed(status)}>
                Dismiss
              </button>
            ) : (
              <button className={styles.action} onClick={() => window.location.reload()}>
                Reload
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
