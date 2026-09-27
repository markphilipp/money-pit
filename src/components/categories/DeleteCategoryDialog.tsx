'use client';

import { useMemo } from 'react';
import type { Category } from '@/lib/types';
import { deletionImpact } from '@/lib/categories';
import { describeGroup } from '@/lib/rules/engine';
import { useTransactions } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import styles from './CategoriesScreen.module.css';

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function DeleteCategoryDialog({
  category,
  returnFocusTo,
  onClose,
}: {
  category: Category;
  returnFocusTo: React.RefObject<HTMLElement | null>;
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
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Delete “${category.name}”?`}
      confirmLabel={
        impact.rules.length
          ? `Delete category and ${count(impact.rules.length, 'rule', 'rules')}`
          : 'Delete category'
      }
      onConfirm={() => deleteCategory(category.id)}
      returnFocusTo={returnFocusTo}
      description={
        <>
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
              {count(impact.overridden, 'transaction', 'transactions')} you moved here by hand will
              lose that choice and go back to your rules.
            </p>
          )}
          {byRules > 0 && (
            <p>
              {count(byRules, 'transaction', 'transactions')} filed here by{' '}
              {impact.rules.length === 1 ? 'that rule' : 'those rules'} will be picked up by your
              other rules, or land in Other.
            </p>
          )}
        </>
      }
    />
  );
}
