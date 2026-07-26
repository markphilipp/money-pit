export interface RawStatementRow {
  status: string;
  dateStr: string;
  description: string;
  debit: string;
  credit: string;
  person: string;
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

export interface CategoryRule {
  id: string;
  name: string;
  color: string;
  keywords: string[];
  builtin?: boolean;
}

export interface FilterState {
  search: string;
  person: string | null;
  amountMin: number | null;
  amountMax: number | null;
  categoryIds: Set<string>;
  showCredits: boolean;
}

export type SortKey = 'date' | 'description' | 'category' | 'person' | 'amount';

export interface SortState {
  key: SortKey;
  dir: 1 | -1;
}

export type ChartMode = 'donut' | 'bar';

export const PAYMENTS_ID = 'payments';
export const OTHER_ID = 'other';
