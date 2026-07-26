import type { RawStatementRow } from './types';

function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(7, '0');
}

export function rowKey(row: RawStatementRow): string {
  return [row.dateStr, row.description, row.debit, row.credit, row.person].join('|');
}

export function txnId(row: RawStatementRow, ordinal: number): string {
  return `${fnv1a(rowKey(row))}-${fnv1a(row.description)}-${ordinal}`;
}
