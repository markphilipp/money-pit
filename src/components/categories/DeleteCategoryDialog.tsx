'use client';

import { useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { Category } from '@/lib/types';
import { deletionImpact } from '@/lib/categories';
import { describeGroup } from '@/lib/rules/engine';
import { useTransactions } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import styles from './CategoriesScreen.module.css';

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function DeleteCategoryDialog({
  category,
  onClose,
}: {
  category: Category;
  onClose: () => void;
}) {
  const rules = useAppStore((s) => s.rules);
  const overrides = useAppStore((s) => s.overrides);
  const deleteCategory = useAppStore((s) => s.deleteCategory);
  const transactions = useTransactions();

  const impact = useMemo(
    () => deletionImpact(category.id, rules, overrides, transactions),
    [category.id, rules, overrides, transactions],
  );
  const byRules = impact.transactions - impact.overridden;

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.dialog}>
          <Dialog.Title className={styles.dialogTitle}>Delete “{category.name}”?</Dialog.Title>
          <Dialog.Description asChild>
            <div className={styles.dialogBody}>
              {impact.rules.length > 0 ? (
                <>
                  <p>
                    {count(impact.rules.length, 'rule files', 'rules file')} transactions into this
                    category. {impact.rules.length === 1 ? 'It' : 'They'} will be deleted too:
                  </p>
                  <ul className={styles.impactRules}>
                    {impact.rules.map((rule) => (
                      <li key={rule.id}>{describeGroup(rule.conditions)}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>No rules file transactions into this category.</p>
              )}
              {impact.overridden > 0 && (
                <p>
                  {count(impact.overridden, 'transaction', 'transactions')} you moved here by hand
                  will lose that choice and go back to your rules.
                </p>
              )}
              {byRules > 0 && (
                <p>
                  {count(byRules, 'transaction', 'transactions')} filed here by{' '}
                  {impact.rules.length === 1 ? 'that rule' : 'those rules'} will be picked up by
                  your other rules, or land in Other.
                </p>
              )}
            </div>
          </Dialog.Description>
          <div className={styles.dialogActions}>
            <Dialog.Close className={styles.secondary}>Cancel</Dialog.Close>
            <button
              type="button"
              className={styles.destructive}
              onClick={() => {
                deleteCategory(category.id);
                onClose();
              }}
            >
              {impact.rules.length
                ? `Delete category and ${count(impact.rules.length, 'rule', 'rules')}`
                : 'Delete category'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
