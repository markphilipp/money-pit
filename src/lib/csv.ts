import Papa from 'papaparse';
import type { RawStatementRow } from './types';
import { rowKey } from './hash';

export const EXPECTED_HEADER = ['Status', 'Date', 'Description', 'Debit', 'Credit', 'Member Name'];

export class CsvFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CsvFormatError';
  }
}

export function parseStatementCsv(text: string): RawStatementRow[] {
  const trimmed = text.replace(/^﻿/, '').trim();
  if (!trimmed) throw new CsvFormatError('The file is empty.');

  const { data } = Papa.parse<string[]>(trimmed, { skipEmptyLines: 'greedy' });
  const rows = data.filter((r) => r.some((f) => f.trim() !== ''));
  if (!rows.length) throw new CsvFormatError('The file is empty.');

  const header = rows[0].map((h) => h.trim());
  const matches =
    header.length >= EXPECTED_HEADER.length &&
    EXPECTED_HEADER.every((h, i) => header[i]?.toLowerCase() === h.toLowerCase());
  if (!matches) {
    throw new CsvFormatError(
      `Unexpected columns. Expected a header row of "${EXPECTED_HEADER.join(',')}" but found "${header.join(',')}".`,
    );
  }

  return rows.slice(1).map((r) => ({
    status: (r[0] ?? '').trim(),
    dateStr: (r[1] ?? '').trim(),
    description: (r[2] ?? '').trim(),
    debit: (r[3] ?? '').trim(),
    credit: (r[4] ?? '').trim(),
    person: (r[5] ?? '').trim(),
  }));
}

/**
 * Statement exports overlap at period boundaries, so an identical row appearing in a
 * *different* file is a duplicate — but two identical rows inside one file are two real
 * charges. Dedupe is therefore per-key multiplicity: keep the highest count seen in any
 * single file rather than the sum across files.
 */
export function mergeRows(existing: RawStatementRow[], incoming: RawStatementRow[]) {
  const counts = new Map<string, number>();
  for (const row of existing) {
    const k = rowKey(row);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const incomingCounts = new Map<string, number>();
  const merged = [...existing];
  for (const row of incoming) {
    const k = rowKey(row);
    const seenInFile = (incomingCounts.get(k) ?? 0) + 1;
    incomingCounts.set(k, seenInFile);
    if (seenInFile > (counts.get(k) ?? 0)) {
      counts.set(k, seenInFile);
      merged.push(row);
    }
  }
  return merged;
}
