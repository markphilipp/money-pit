'use client';

import * as AlertDialog from '@radix-ui/react-alert-dialog';
import styles from './ConfirmDialog.module.css';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  returnFocusTo: React.RefObject<HTMLElement | null>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  returnFocusTo,
}: Props) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={styles.overlay} />
        <AlertDialog.Content
          className={styles.dialog}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            returnFocusTo.current?.focus();
          }}
        >
          <AlertDialog.Title className={styles.title}>{title}</AlertDialog.Title>
          <AlertDialog.Description asChild>
            <div className={styles.body}>{description}</div>
          </AlertDialog.Description>
          <div className={styles.actions}>
            <AlertDialog.Cancel className={styles.cancel}>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action className={styles.confirm} onClick={onConfirm}>
              {confirmLabel}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
