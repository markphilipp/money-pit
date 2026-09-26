'use client';

import { useContext } from 'react';
import Image from 'next/image';
import { EXPECTED_HEADER } from '@/lib/csv';
import { SignedInContext } from '@/store/useAppStore';
import { UploadZone } from './UploadZone';
import styles from './EmptyState.module.css';

export function EmptyState() {
  const signedIn = useContext(SignedInContext);
  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <h1 className={styles.brand}>
          <Image
            className={styles.logo}
            src="/money-pit-logo.png"
            alt="The Money Pit"
            width={640}
            height={576}
            priority
          />
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
          {signedIn
            ? 'Statements you add are saved to your account, so they’re here next time you sign in.'
            : 'Without an account, nothing is uploaded. Files are parsed in this browser tab and forgotten when you close it.'}
        </p>
      </div>
    </div>
  );
}
