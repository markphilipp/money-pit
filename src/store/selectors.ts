import type { Category, Dataset, Transaction } from '@/lib/types';
import { PAYMENTS_ID } from '@/lib/types';
import { toTransactions } from '@/lib/categorize';
import { statementTxnIds } from '@/lib/datasets';
import { matchesColumnFilter } from '@/lib/rules/engine';
import { personShort } from '@/lib/format';
import type { AppState } from './useAppStore';

export const PERSON_COLORS = ['#E8641B', '#1F6F8B', '#7B5CB8', '#5F9E62'];
export const DIM_SUFFIX = '40';

type Inputs = Pick<AppState, 'rawRows' | 'categories' | 'rules' | 'overrides'>;

/** Deriving transactions walks every row, so cache on the identity of every input. */
let cache: { inputs: Inputs; result: Transaction[] } | null = null;

export function selectTransactions(state: AppState): Transaction[] {
  const { rawRows, categories, rules, overrides } = state;
  if (
    cache &&
    cache.inputs.rawRows === rawRows &&
    cache.inputs.categories === categories &&
    cache.inputs.rules === rules &&
    cache.inputs.overrides === overrides
  ) {
    return cache.result;
  }
  const result = toTransactions(rawRows, { categories, rules }, overrides);
  cache = { inputs: { rawRows, categories, rules, overrides }, result };
  return result;
}

let membershipCache: { datasets: Dataset[]; key: string; ids: Set<string> } | null = null;

/**
 * Transaction ids inside the selected statements, or null when no statement filter applies.
 * Selected ids that no longer match a dataset are dropped first, so a stale id can't blank the table.
 */
function statementMembership(state: AppState): Set<string> | null {
  const live = new Set(state.datasets.map((d) => d.id));
  const active = state.filters.statementIds.filter((id) => live.has(id));
  if (!active.length) return null;
  const key = active.join('|');
  if (membershipCache?.datasets === state.datasets && membershipCache.key === key) {
    return membershipCache.ids;
  }
  const ids = statementTxnIds(state.datasets, active);
  membershipCache = { datasets: state.datasets, key, ids };
  return ids;
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
  const inStatements = statementMembership(state);
  return selectTransactions(state).filter((t) => {
    if (inStatements && !inStatements.has(t.id)) return false;
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

export function selectCategoryTotals(txns: Transaction[], categories: Category[]): CategoryTotal[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const totals = sumBy(
    txns.filter((t) => t.categoryId !== PAYMENTS_ID),
    (t) => t.categoryId,
  );
  return [...totals.entries()]
    .filter(([id, total]) => total > 0 && byId.has(id))
    .map(([id, total]) => {
      const category = byId.get(id)!;
      return { id, name: category.name, color: category.color, total: +total.toFixed(2) };
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

export function selectStats(txns: Transaction[], categories: Category[]): Stats {
  const spendable = txns.filter((t) => t.categoryId !== PAYMENTS_ID);
  const purchases = spendable.filter((t) => !t.isCredit).reduce((a, t) => a + t.amount, 0);
  const refunds = spendable.filter((t) => t.isCredit).reduce((a, t) => a + t.amount, 0);
  const top = selectCategoryTotals(spendable, categories)[0];
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
  categories: Category[],
): Transaction[] {
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
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
