'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { CategoryRule } from '@/lib/types';
import { describeGroup } from '@/lib/rules/engine';
import { useAppStore } from '@/store/useAppStore';
import { RuleBuilderModal } from './RuleBuilderModal';
import styles from './RulesManager.module.css';

interface RulesManagerModalProps {
  open: boolean;
  onClose: () => void;
}

type Editing = { rule?: CategoryRule } | null;

export function RulesManagerModal({ open, onClose }: RulesManagerModalProps) {
  const rules = useAppStore((s) => s.rules);
  const reorderRules = useAppStore((s) => s.reorderRules);
  const deleteRule = useAppStore((s) => s.deleteRule);
  const [editing, setEditing] = useState<Editing>(null);

  const movable = rules.filter((r) => !r.builtin);

  return (
    <>
      <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
        <Dialog.Portal>
          <Dialog.Overlay className={styles.overlay} />
          <Dialog.Content className={styles.modal} aria-describedby={undefined}>
            <Dialog.Title className={styles.title}>Category rules</Dialog.Title>
            <p className={styles.hint}>First matching rule wins — order matters.</p>

            <ul className={styles.list}>
              {rules.map((rule, i) => (
                <li key={rule.id} className={styles.row}>
                  <span className={styles.dot} style={{ background: rule.color }} />
                  <span className={styles.name}>{rule.name}</span>
                  <span className={styles.summary}>{describeGroup(rule.conditions)}</span>
                  <span className={styles.actions}>
                    <button
                      className={styles.iconBtn}
                      disabled={rule.builtin || i === 0}
                      aria-label={`Move ${rule.name} up`}
                      onClick={() => reorderRules(rule.id, -1)}
                    >
                      ▲
                    </button>
                    <button
                      className={styles.iconBtn}
                      disabled={rule.builtin || i >= movable.length - 1}
                      aria-label={`Move ${rule.name} down`}
                      onClick={() => reorderRules(rule.id, 1)}
                    >
                      ▼
                    </button>
                    <button
                      className={styles.iconBtn}
                      aria-label={`Edit ${rule.name}`}
                      onClick={() => setEditing({ rule })}
                    >
                      Edit
                    </button>
                    <button
                      className={styles.iconBtn}
                      disabled={rule.builtin}
                      aria-label={`Delete ${rule.name}`}
                      title={rule.builtin ? 'Built-in categories cannot be deleted' : undefined}
                      onClick={() => deleteRule(rule.id)}
                    >
                      ✕
                    </button>
                  </span>
                </li>
              ))}
            </ul>

            <div className={styles.footer}>
              <button className={styles.newBtn} onClick={() => setEditing({})}>
                New rule
              </button>
              <Dialog.Close asChild>
                <button className="btn-clear">Done</button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <RuleBuilderModal
        open={editing !== null}
        rule={editing?.rule}
        onClose={() => setEditing(null)}
      />
    </>
  );
}
