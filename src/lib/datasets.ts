import { mergeRows } from './csv';
import { parseDate } from './categorize';
import { rowKey, txnId, withOrdinals } from './hash';
import type { Dataset, RawStatementRow } from './types';

/**
 * The deduped rows of every dataset, folded in upload order. Each dataset keeps its own rows
 * rather than owning a share of the merged ones: overlapping files share rows, so removing the
 * first file must still leave what a later file also contained.
 */
export function mergeDatasets(datasets: Dataset[]): RawStatementRow[] {
  return datasets.reduce<RawStatementRow[]>((rows, d) => mergeRows(rows, d.rows), []);
}

const keyCounts = (rows: RawStatementRow[]) => {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const k = rowKey(row);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
};

function sameRows(a: RawStatementRow[], b: RawStatementRow[]): boolean {
  if (a.length !== b.length) return false;
  const counts = keyCounts(a);
  for (const row of b) {
    const k = rowKey(row);
    const left = counts.get(k);
    if (!left) return false;
    counts.set(k, left - 1);
  }
  return true;
}

/** Re-uploading a file whose rows an existing dataset already holds changes nothing. */
export function hasDataset(datasets: Dataset[], rows: RawStatementRow[]): boolean {
  return datasets.some((d) => sameRows(d.rows, rows));
}

export function addDataset(datasets: Dataset[], dataset: Dataset): Dataset[] {
  return hasDataset(datasets, dataset.rows) ? datasets : [...datasets, dataset];
}

const txnIds = (rows: RawStatementRow[]) =>
  new Set(withOrdinals(rows).map((row) => txnId(row, row.ordinal)));

/**
 * Drops one dataset, and with it the overrides of any row that no other dataset still holds. The
 * account does the same: those rows are deleted along with their `category_override` column.
 */
export function removeDataset(
  state: { datasets: Dataset[]; overrides: Record<string, string> },
  id: string,
): { datasets: Dataset[]; overrides: Record<string, string> } {
  if (!state.datasets.some((d) => d.id === id)) return state;
  const datasets = state.datasets.filter((d) => d.id !== id);
  const alive = txnIds(mergeDatasets(datasets));
  return {
    datasets,
    overrides: Object.fromEntries(
      Object.entries(state.overrides).filter(([key]) => alive.has(key)),
    ),
  };
}

/** What removing a dataset does, for the warning shown before it happens. */
export interface DatasetImpact {
  /** Rows that disappear from the dashboard. */
  transactions: number;
  /** Rows of this file that stay because another file contains them too. */
  shared: number;
  /** Manual category changes on the rows that disappear. */
  lostOverrides: number;
}

export function datasetImpact(
  datasets: Dataset[],
  overrides: Record<string, string>,
  id: string,
): DatasetImpact {
  const target = datasets.find((d) => d.id === id);
  if (!target) return { transactions: 0, shared: 0, lostOverrides: 0 };
  const before = mergeDatasets(datasets);
  const after = txnIds(mergeDatasets(datasets.filter((d) => d.id !== id)));
  const gone = withOrdinals(before)
    .map((row) => txnId(row, row.ordinal))
    .filter((key) => !after.has(key));
  return {
    transactions: gone.length,
    shared: target.rows.length - gone.length,
    lostOverrides: gone.filter((key) => key in overrides).length,
  };
}

/** Earliest and latest transaction date in a file, or null when it has no parseable rows. */
export function datasetSpan(rows: RawStatementRow[]): { from: Date; to: Date } | null {
  let from: Date | null = null;
  let to: Date | null = null;
  for (const row of rows) {
    const date = parseDate(row.dateStr);
    if (Number.isNaN(date.getTime())) continue;
    if (!from || date < from) from = date;
    if (!to || date > to) to = date;
  }
  return from && to ? { from, to } : null;
}
