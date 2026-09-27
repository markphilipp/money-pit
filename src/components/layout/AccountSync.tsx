'use client';

import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as accountActions from '@/app/actions/account';
import { idleStatus, type SaveStatus } from '@/lib/saveStatus';
import { startAccountSync } from '@/store/sync';
import { SignedInContext } from '@/store/useAppStore';
import { SaveStatusToast } from './SaveStatusToast';
import styles from './AccountSync.module.css';

interface PendingClaim {
  answer: (keep: boolean) => void;
}

export function AccountSync({
  signedIn,
  children,
}: {
  signedIn: boolean;
  children: React.ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(idleStatus);
  const [claim, setClaim] = useState<PendingClaim | null>(null);
  const saveRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!signedIn) return;
    const confirmClaim = () =>
      new Promise<boolean>((resolve) =>
        setClaim({
          answer: (keep) => {
            setClaim(null);
            resolve(keep);
          },
        }),
      );
    return startAccountSync(accountActions, setError, confirmClaim, setSaveStatus).stop;
  }, [signedIn]);

  return (
    <SignedInContext value={signedIn}>
      {children}
      <Dialog.Root open={claim !== null}>
        <Dialog.Portal>
          <Dialog.Overlay className={styles.overlay} />
          <Dialog.Content
            className={styles.dialog}
            onOpenAutoFocus={(e) => {
              // Radix focuses the first button, Discard, which would make Enter destructive.
              e.preventDefault();
              saveRef.current?.focus();
            }}
            onEscapeKeyDown={(e) => e.preventDefault()}
            onPointerDownOutside={(e) => e.preventDefault()}
          >
            <Dialog.Title className={styles.title}>
              Save this session’s statements to your account?
            </Dialog.Title>
            <Dialog.Description className={styles.body}>
              Before you signed in, you added statements in this tab. Save them, with your category
              fixes and rules, to your account. Or discard them: they’ll be removed from this tab
              and can’t be recovered.
            </Dialog.Description>
            <div className={styles.actions}>
              <button className={styles.secondary} onClick={() => claim?.answer(false)}>
                Discard
              </button>
              <button ref={saveRef} className={styles.primary} onClick={() => claim?.answer(true)}>
                Save to my account
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {signedIn && <SaveStatusToast status={saveStatus} />}
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
