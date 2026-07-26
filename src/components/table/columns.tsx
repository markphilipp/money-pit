'use client';

import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import type { CategoryRule, SortKey, Transaction } from '@/lib/types';
import { fmtMoney, personShort } from '@/lib/format';
import styles from './Table.module.css';

export interface ColumnMeta {
  sortKey?: SortKey;
  headerLabel?: string;
  align?: 'right';
  filter?: 'person' | 'amount';
}

interface Options {
  rulesById: Map<string, CategoryRule>;
  isSelected: (id: string) => boolean;
  onToggleRow: (id: string) => void;
  onPillClick: (txn: Transaction, anchor: HTMLElement) => void;
}

const helper = createColumnHelper<Transaction>();

// All columns are display columns: sorting and filtering are driven by the store, so the
// table never needs accessor values of its own.
export function buildColumns({
  rulesById,
  isSelected,
  onToggleRow,
  onPillClick,
}: Options): ColumnDef<Transaction, unknown>[] {
  return [
    helper.display({
      id: 'select',
      cell: ({ row }) => (
        <input
          type="checkbox"
          className={styles.rowCk}
          checked={isSelected(row.original.id)}
          onChange={() => onToggleRow(row.original.id)}
          aria-label={`Select ${row.original.description}`}
        />
      ),
    }),
    helper.display({
      id: 'date',
      meta: { sortKey: 'date', headerLabel: 'Date' } satisfies ColumnMeta,
      cell: ({ row }) => <span className={styles.date}>{row.original.dateStr}</span>,
    }),
    helper.display({
      id: 'description',
      meta: { sortKey: 'description', headerLabel: 'Description' } satisfies ColumnMeta,
      cell: ({ row }) => row.original.description,
    }),
    helper.display({
      id: 'category',
      meta: { sortKey: 'category', headerLabel: 'Category' } satisfies ColumnMeta,
      cell: ({ row }) => {
        const rule = rulesById.get(row.original.categoryId);
        return (
          <button
            type="button"
            className={styles.catTag}
            title="Change category"
            onClick={(e) => onPillClick(row.original, e.currentTarget)}
          >
            <span className={styles.dot} style={{ background: rule?.color ?? '#8A8F98' }} />
            {rule?.name ?? 'Other'}
          </button>
        );
      },
    }),
    helper.display({
      id: 'person',
      meta: { sortKey: 'person', headerLabel: 'Person', filter: 'person' } satisfies ColumnMeta,
      cell: ({ row }) => <span className={styles.person}>{personShort(row.original.person)}</span>,
    }),
    helper.display({
      id: 'amount',
      meta: {
        sortKey: 'amount',
        headerLabel: 'Amount',
        align: 'right',
        filter: 'amount',
      } satisfies ColumnMeta,
      cell: ({ row }) => (
        <span className={`${styles.amt} ${row.original.isCredit ? styles.credit : ''}`}>
          {fmtMoney(row.original.amount)}
        </span>
      ),
    }),
  ];
}
