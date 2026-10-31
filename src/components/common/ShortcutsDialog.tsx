'use client';

import { Fragment } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { SCOPE_TITLES, SHORTCUTS, type ShortcutScope } from '@/lib/shortcuts';
import styles from './ShortcutsDialog.module.css';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SCOPES = Object.keys(SCOPE_TITLES) as ShortcutScope[];

export function ShortcutsDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.dialog}>
          <Dialog.Title className={styles.title}>Keyboard shortcuts</Dialog.Title>
          {SCOPES.map((scope) => (
            <section key={scope} className={styles.section}>
              <h3 className={styles.heading}>{SCOPE_TITLES[scope]}</h3>
              <dl className={styles.list}>
                {SHORTCUTS.filter((s) => s.scope === scope).map((shortcut) => (
                  <div key={shortcut.id} className={styles.row}>
                    <dt>{shortcut.label}</dt>
                    <dd className={styles.keys}>
                      {shortcut.display.map((key, i) => (
                        <Fragment key={key}>
                          {i > 0 && <span aria-hidden="true">/</span>}
                          <kbd className={styles.kbd}>{key}</kbd>
                        </Fragment>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          <div className={styles.footer}>
            <Dialog.Description className={styles.note}>
              Shortcuts are off while you’re typing in a field.
            </Dialog.Description>
            <Dialog.Close className={styles.close}>Close</Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
