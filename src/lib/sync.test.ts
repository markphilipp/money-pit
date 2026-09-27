import { describe, expect, it } from 'vitest';
import { toTransactions } from './categorize';
import { parseStatementCsv } from './csv';
import { defaultCategories, defaultRules } from './defaultRules';
import { fromStoredRows, overrideChanges, toStoredRows } from './sync';
import { HEADER } from '@/test/fixtures';

const rows = parseStatementCsv(
  [
    HEADER,
    'Cleared,07/03/2026,"APPLE.COM/BILL CUPERTINO CA",4.99,,ALEX SAMPLE',
    'Cleared,07/02/2026,"CANTEEN VENDING CHARLOTTE NC",1.50,,JAMIE SAMPLE',
    'Cleared,07/02/2026,"CANTEEN VENDING CHARLOTTE NC",1.50,,JAMIE SAMPLE',
  ].join('\n'),
);
const ids = toTransactions(rows, { categories: defaultCategories, rules: defaultRules }, {}).map(
  (t) => t.id,
);

describe('toStoredRows / fromStoredRows', () => {
  it('numbers identical rows so each keeps its own override', () => {
    const stored = toStoredRows(rows, { [ids[2]]: 'grocery' });
    expect(stored.map((r) => [r.ordinal, r.categoryOverride])).toEqual([
      [0, null],
      [0, null],
      [1, 'grocery'],
    ]);
  });

  it('round-trips rows and overrides through storage', () => {
    const overrides = { [ids[0]]: 'dining', [ids[2]]: 'grocery' };
    expect(fromStoredRows(toStoredRows(rows, overrides))).toEqual({ rawRows: rows, overrides });
  });
});

describe('overrideChanges', () => {
  it('reports set, changed and cleared overrides by row identity', () => {
    const prev = { [ids[0]]: 'dining', [ids[1]]: 'pets' };
    const next = { [ids[1]]: 'grocery', [ids[2]]: 'auto' };
    expect(
      overrideChanges(rows, prev, next).map((r) => [r.description, r.ordinal, r.categoryOverride]),
    ).toEqual([
      ['APPLE.COM/BILL CUPERTINO CA', 0, null],
      ['CANTEEN VENDING CHARLOTTE NC', 0, 'grocery'],
      ['CANTEEN VENDING CHARLOTTE NC', 1, 'auto'],
    ]);
  });

  it('is empty when nothing changed', () => {
    const same = { [ids[0]]: 'dining' };
    expect(overrideChanges(rows, same, { ...same })).toEqual([]);
  });

  it('skips overrides whose row is gone', () => {
    expect(overrideChanges(rows, {}, { 'no-such-row': 'dining' })).toEqual([]);
  });
});
