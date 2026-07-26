'use client';

import { useRef, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import styles from './Header.module.css';

export function Header() {
  const uploadFiles = useAppStore((s) => s.uploadFiles);
  const resetAll = useAppStore((s) => s.resetAll);
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [errors, setErrors] = useState<{ file: string; message: string }[]>([]);

  return (
    <header className={styles.header}>
      <div>
        <div className={styles.eyebrow}>Money Pit</div>
        <h1 className={styles.title}>
          Spending <span className={styles.thin}>Breakdown</span>
        </h1>
        <div className={styles.rule} />
      </div>

      <div className={styles.actions}>
        <button className={styles.add} onClick={() => inputRef.current?.click()}>
          ＋ Add statement
        </button>
        <input
          ref={inputRef}
          className={styles.input}
          type="file"
          accept=".csv,text/csv"
          multiple
          aria-label="Add statement CSV files"
          onChange={async (e) => {
            const files = e.target.files ? Array.from(e.target.files) : [];
            e.target.value = '';
            if (!files.length) return;
            const result = await uploadFiles(files);
            setErrors(result.errors);
          }}
        />
        {confirming ? (
          <>
            <button
              className={`${styles.add} ${styles.danger}`}
              style={{ background: 'none' }}
              onClick={() => {
                resetAll();
                setConfirming(false);
              }}
            >
              Confirm reset
            </button>
            <button className="btn-clear" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button className="btn-clear" onClick={() => setConfirming(true)}>
            Start over
          </button>
        )}
      </div>

      {errors.length > 0 && (
        <ul className={styles.errors} role="alert">
          {errors.map((e) => (
            <li key={e.file}>
              <strong>{e.file}</strong> — {e.message}
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
