import type { ColumnFilter, ColumnId, RuleGroup } from './rules/types';

export interface RawStatementRow {
  status: string;
  dateStr: string;
  description: string;
  debit: string;
  credit: string;
  person: string;
}

/** `ordinal` counts earlier identical rows, so `txnId(row, ordinal)` tells real duplicates apart. */
export interface OrdinalRow extends RawStatementRow {
  ordinal: number;
}

export interface Transaction {
  id: string;
  status: string;
  date: Date;
  dateStr: string;
  description: string;
  amount: number;
  isCredit: boolean;
  person: string;
  categoryId: string;
}

/** What a transaction is filed under. `payments` and `other` are builtin: renameable, not deletable. */
export interface Category {
  id: string;
  name: string;
  color: string;
  builtin?: boolean;
}

/** Files the transactions it matches under `categoryId`. The builtin payments rule stays last. */
export interface Rule {
  id: string;
  categoryId: string;
  conditions: RuleGroup;
  builtin?: boolean;
}

/** Categories and the rules that fill them, saved and synced as one unit. */
export interface Categorization {
  categories: Category[];
  rules: Rule[];
}

export interface FilterState {
  search: string;
  showCredits: boolean;
  columnFilters: Partial<Record<ColumnId, ColumnFilter>>;
}

export type SortKey = 'date' | 'description' | 'category' | 'person' | 'amount';

export interface SortState {
  key: SortKey;
  dir: 1 | -1;
}

export type ChartMode = 'donut' | 'bar';

export const PAYMENTS_ID = 'payments';
export const OTHER_ID = 'other';
