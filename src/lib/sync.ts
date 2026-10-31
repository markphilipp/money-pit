import { txnId, withOrdinals } from './hash';
import type { Dataset, OrdinalRow, RawStatementRow } from './types';

/** How a signed-in account stores a row: by content + ordinal, never by the derived `txnId`. */
export interface StoredRow extends OrdinalRow {
  categoryOverride: string | null;
}

export function toStoredRows(
  rows: RawStatementRow[],
  overrides: Record<string, string>,
): StoredRow[] {
  return withOrdinals(rows).map((row) => ({
    ...row,
    categoryOverride: overrides[txnId(row, row.ordinal)] ?? null,
  }));
}

/** A dataset as the account stores it: the rows its file held, numbered within that file. */
export interface StoredDataset extends Omit<Dataset, 'rows'> {
  rows: StoredRow[];
}

/**
 * A file's k-th copy of a row has ordinal k-1, the same identity as the merged row, so numbering
 * per file is what ties a dataset's rows to the account's deduped ones.
 */
export const toStoredDataset = (
  { rows, ...dataset }: Dataset,
  overrides: Record<string, string>,
): StoredDataset => ({ ...dataset, rows: toStoredRows(rows, overrides) });

export function fromStoredDatasets(stored: StoredDataset[]) {
  const overrides: Record<string, string> = {};
  const datasets = stored.map(({ rows, ...dataset }): Dataset => {
    const parts = fromStoredRows(rows);
    Object.assign(overrides, parts.overrides);
    return { ...dataset, rows: parts.rawRows };
  });
  return { datasets, overrides };
}

export function fromStoredRows(stored: StoredRow[]) {
  const rawRows: RawStatementRow[] = [];
  const overrides: Record<string, string> = {};
  for (const { ordinal, categoryOverride, ...row } of stored) {
    rawRows.push(row);
    if (categoryOverride) overrides[txnId(row, ordinal)] = categoryOverride;
  }
  return { rawRows, overrides };
}

/** The rows whose override was set, changed or cleared between two override maps. */
export function overrideChanges(
  rows: RawStatementRow[],
  prev: Record<string, string>,
  next: Record<string, string>,
): StoredRow[] {
  const changed = new Set(
    [...Object.keys(prev), ...Object.keys(next)].filter((id) => prev[id] !== next[id]),
  );
  if (!changed.size) return [];
  return withOrdinals(rows).flatMap((row) => {
    const id = txnId(row, row.ordinal);
    return changed.has(id) ? [{ ...row, categoryOverride: next[id] ?? null }] : [];
  });
}
