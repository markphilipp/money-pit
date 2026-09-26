'use client';

import { useEffect, useState } from 'react';
import * as accountActions from '@/app/actions/account';
import { startAccountSync } from '@/store/sync';
import { SignedInContext } from '@/store/useAppStore';
import styles from './AccountSync.module.css';

export function AccountSync({
  signedIn,
  children,
}: {
  signedIn: boolean;
  children: React.ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    return startAccountSync(accountActions, setError).stop;
  }, [signedIn]);

  return (
    <SignedInContext value={signedIn}>
      {children}
      {error && (
        <div className={styles.alert} role="alert">
          <p>{error}</p>
          <button className={styles.dismiss} onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}
    </SignedInContext>
  );
}
