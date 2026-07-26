'use client';

import { useRef, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { RulesManagerModal } from '@/components/rules/RulesManagerModal';
import { useAppStore } from '@/store/useAppStore';
import styles from './UserMenu.module.css';

export function UserMenu() {
  const uploadFiles = useAppStore((s) => s.uploadFiles);
  const resetAll = useAppStore((s) => s.resetAll);
  const hasData = useAppStore((s) => s.rawRows.length > 0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [errors, setErrors] = useState<{ file: string; message: string }[]>([]);

  return (
    <>
      <DropdownMenu.Root onOpenChange={(open) => !open && setConfirming(false)}>
        <DropdownMenu.Trigger asChild>
          <button className={styles.avatar} aria-label="Account menu">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <circle cx="12" cy="8.5" r="3.6" />
              <path d="M4.6 20c.9-4 3.8-6 7.4-6s6.5 2 7.4 6" />
            </svg>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className={styles.menu} align="end" sideOffset={8}>
            {hasData && (
              <>
                <DropdownMenu.Item
                  className={styles.item}
                  onSelect={() => {
                    // Radix pulls focus back to the trigger as it closes, which eats a
                    // picker opened in the same tick — hand it the next one instead.
                    setTimeout(() => inputRef.current?.click(), 0);
                  }}
                >
                  Add statement
                </DropdownMenu.Item>
                {confirming ? (
                  <>
                    <DropdownMenu.Item
                      className={`${styles.item} ${styles.danger}`}
                      onSelect={() => resetAll()}
                    >
                      Confirm reset
                    </DropdownMenu.Item>
                    <DropdownMenu.Item className={styles.item}>Cancel</DropdownMenu.Item>
                  </>
                ) : (
                  <DropdownMenu.Item
                    className={styles.item}
                    onSelect={(e) => {
                      e.preventDefault();
                      setConfirming(true);
                    }}
                  >
                    Start over
                  </DropdownMenu.Item>
                )}
                <DropdownMenu.Separator className={styles.separator} />
              </>
            )}
            <DropdownMenu.Item className={styles.item} onSelect={() => setRulesOpen(true)}>
              Category rules…
            </DropdownMenu.Item>
            <DropdownMenu.Separator className={styles.separator} />
            <DropdownMenu.Item className={styles.item} disabled>
              Sign in <span className={styles.soon}>coming soon</span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

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

      {errors.length > 0 && (
        <div className={styles.errors} role="alert">
          <ul>
            {errors.map((e) => (
              <li key={e.file}>
                <strong>{e.file}</strong> — {e.message}
              </li>
            ))}
          </ul>
          <button className={styles.dismiss} onClick={() => setErrors([])}>
            Dismiss
          </button>
        </div>
      )}

      <RulesManagerModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </>
  );
}
