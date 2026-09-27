'use client';

import { useContext, useRef, useState } from 'react';
import Link from 'next/link';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { deleteAccount } from '@/app/actions/account';
import { authClient } from '@/auth/client';
import { SignedInContext, useAppStore } from '@/store/useAppStore';
import styles from './UserMenu.module.css';

// A full reload rebuilds the store from scratch, so no account data outlives the session in memory.
function leave() {
  useAppStore.persist.clearStorage();
  window.location.assign('/');
}

async function signOut(): Promise<string | null> {
  const { error } = await authClient.signOut();
  if (error) return 'Couldn’t sign out, so you’re still signed in. Try again.';
  leave();
  return null;
}

async function deleteAndLeave(): Promise<string | null> {
  try {
    await deleteAccount();
  } catch {
    return 'Couldn’t delete your account. Try again.';
  }
  // The session died with the account; this only clears its cookie.
  await authClient.signOut();
  leave();
  return null;
}

export function UserMenu() {
  const signedIn = useContext(SignedInContext);
  const uploadFiles = useAppStore((s) => s.uploadFiles);
  const resetAll = useAppStore((s) => s.resetAll);
  const hasData = useAppStore((s) => s.rawRows.length > 0);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState<'reset' | 'delete' | null>(null);
  const [errors, setErrors] = useState<{ file: string; message: string }[]>([]);
  const [accountError, setAccountError] = useState<string | null>(null);

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button ref={triggerRef} className={styles.avatar} aria-label="Account menu">
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
                <DropdownMenu.Item className={styles.item} onSelect={() => setConfirming('reset')}>
                  Start over
                </DropdownMenu.Item>
                <DropdownMenu.Separator className={styles.separator} />
              </>
            )}
            <DropdownMenu.Item className={styles.item} asChild>
              <Link href="/categories">Categories…</Link>
            </DropdownMenu.Item>
            <DropdownMenu.Item className={styles.item} asChild>
              <Link href="/rules">Category rules…</Link>
            </DropdownMenu.Item>
            <DropdownMenu.Separator className={styles.separator} />
            {signedIn ? (
              <>
                <DropdownMenu.Item
                  className={styles.item}
                  onSelect={async () => setAccountError(await signOut())}
                >
                  Sign out
                </DropdownMenu.Item>
                <DropdownMenu.Item className={styles.item} onSelect={() => setConfirming('delete')}>
                  Delete account…
                </DropdownMenu.Item>
              </>
            ) : (
              <DropdownMenu.Item className={styles.item} asChild>
                <Link href="/sign-in">Sign in…</Link>
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <ConfirmDialog
        open={confirming === 'reset'}
        onOpenChange={(open) => !open && setConfirming(null)}
        title="Start over?"
        description={
          signedIn
            ? 'This permanently deletes every statement you’ve uploaded and your category fixes from your account, and resets your rules, chart type and sort order to the defaults. Your account itself stays. This can’t be undone.'
            : 'This clears every statement you’ve uploaded and your category fixes from this browser, and resets your rules, chart type and sort order to the defaults. This can’t be undone.'
        }
        confirmLabel="Start over"
        onConfirm={() => resetAll()}
        returnFocusTo={triggerRef}
      />

      <ConfirmDialog
        open={confirming === 'delete'}
        onOpenChange={(open) => !open && setConfirming(null)}
        title="Delete your account?"
        description="This permanently deletes your account and everything saved to it: statements, category rules, and category fixes. This can’t be undone."
        confirmLabel="Delete my account"
        onConfirm={async () => setAccountError(await deleteAndLeave())}
        returnFocusTo={triggerRef}
      />

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

      {accountError && (
        <div className={styles.errors} role="alert">
          <p>{accountError}</p>
          <button className={styles.dismiss} onClick={() => setAccountError(null)}>
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}
