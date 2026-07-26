import type { CategoryRule, Transaction } from '@/lib/types';
import { PAYMENTS_ID } from '@/lib/types';
import { toTransactions } from '@/lib/categorize';
import { matchesColumnFilter } from '@/lib/rules/engine';
import { personShort } from '@/lib/format';
import type { AppState } from './useAppStore';

export const PERSON_COLORS = ['#E8641B', '#1F6F8B', '#7B5CB8', '#5F9E62'];
export const DIM_SUFFIX = '40';

/** Deriving transactions walks every row, so cache on the (rawRows, rules, overrides) identity triple. */
let cache: {
  rawRows: AppState['rawRows'];
  rules: AppState['rules'];
  overrides: AppState['overrides'];
  result: Transaction[];
} | null = null;

export function selectTransactions(state: AppState): Transaction[] {
  if (
    cache &&
    cache.rawRows === state.rawRows &&
    cache.rules === state.rules &&
    cache.overrides === state.overrides
  ) {
    return cache.result;
  }
  const result = toTransactions(state.rawRows, state.rules, state.overrides);
  cache = { rawRows: state.rawRows, rules: state.rules, overrides: state.overrides, result };
  return result;
}

export interface FilterOpts {
  ignoreCategory?: boolean;
  ignorePerson?: boolean;
}

export function selectFiltered(state: AppState, opts: FilterOpts = {}): Transaction[] {
  const { search, showCredits, columnFilters } = state.filters;
  const needle = search.trim().toUpperCase();
  const active = Object.values(columnFilters).filter((f) => {
    if (!f) return false;
    if (opts.ignoreCategory && f.column === 'category') return false;
    if (opts.ignorePerson && f.column === 'person') return false;
    return true;
  });
  return selectTransactions(state).filter((t) => {
    if (t.categoryId === PAYMENTS_ID && !showCredits) return false;
    if (needle && !t.description.toUpperCase().includes(needle)) return false;
    return active.every((f) => matchesColumnFilter(t, f, t.categoryId));
  });
}

export function selectVisibleTotal(txns: Transaction[]): number {
  return +txns.reduce((sum, t) => sum + t.amount, 0).toFixed(2);
}

function sumBy<K extends string>(txns: Transaction[], key: (t: Transaction) => K) {
  const totals = new Map<K, number>();
  for (const t of txns) totals.set(key(t), (totals.get(key(t)) ?? 0) + t.amount);
  return totals;
}

export interface CategoryTotal {
  id: string;
  name: string;
  color: string;
  total: number;
}

export function selectCategoryTotals(txns: Transaction[], rules: CategoryRule[]): CategoryTotal[] {
  const byId = new Map(rules.map((r) => [r.id, r]));
  const totals = sumBy(
    txns.filter((t) => t.categoryId !== PAYMENTS_ID),
    (t) => t.categoryId,
  );
  return [...totals.entries()]
    .filter(([id, total]) => total > 0 && byId.has(id))
    .map(([id, total]) => {
      const rule = byId.get(id)!;
      return { id, name: rule.name, color: rule.color, total: +total.toFixed(2) };
    })
    .sort((a, b) => b.total - a.total);
}

export interface PersonTotal {
  person: string;
  label: string;
  color: string;
  total: number;
}

export function selectPersonTotals(txns: Transaction[], personColors: Map<string, string>) {
  const totals = sumBy(
    txns.filter((t) => t.categoryId !== PAYMENTS_ID),
    (t) => t.person,
  );
  return [...totals.entries()]
    .filter(([, total]) => total > 0)
    .map(([person, total]) => ({
      person,
      label: personShort(person),
      color: personColors.get(person) ?? PERSON_COLORS[0],
      total: +total.toFixed(2),
    }))
    .sort((a, b) => b.total - a.total);
}

/** Insertion order across all uploaded rows pins a colour per cardholder for the session. */
export function selectPersons(state: AppState): { name: string; color: string }[] {
  const seen: string[] = [];
  for (const t of selectTransactions(state)) {
    if (t.person && !seen.includes(t.person)) seen.push(t.person);
  }
  return seen.map((name, i) => ({ name, color: PERSON_COLORS[i % PERSON_COLORS.length] }));
}

export function selectPersonColors(state: AppState): Map<string, string> {
  return new Map(selectPersons(state).map((p) => [p.name, p.color]));
}

export interface Stats {
  net: number;
  purchases: number;
  refunds: number;
  count: number;
  topCategory: string;
}

export function selectStats(txns: Transaction[], rules: CategoryRule[]): Stats {
  const spendable = txns.filter((t) => t.categoryId !== PAYMENTS_ID);
  const purchases = spendable.filter((t) => !t.isCredit).reduce((a, t) => a + t.amount, 0);
  const refunds = spendable.filter((t) => t.isCredit).reduce((a, t) => a + t.amount, 0);
  const top = selectCategoryTotals(spendable, rules)[0];
  return {
    net: purchases + refunds,
    purchases,
    refunds,
    count: spendable.length,
    topCategory: top ? top.name : '—',
  };
}

export function sortTransactions(
  txns: Transaction[],
  sort: AppState['sort'],
  rules: CategoryRule[],
): Transaction[] {
  const nameById = new Map(rules.map((r) => [r.id, r.name]));
  const value = (t: Transaction): string | number => {
    switch (sort.key) {
      case 'date':
        return t.date.getTime();
      case 'amount':
        return t.amount;
      case 'description':
        return t.description;
      case 'category':
        return nameById.get(t.categoryId) ?? '';
      case 'person':
        return t.person;
    }
  };
  return [...txns].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
  });
}
