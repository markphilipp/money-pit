import { describe, expect, it } from 'vitest';
import { matchRule, parseAmount, parseDate, toTransactions } from './categorize';
import { parseStatementCsv } from './csv';
import { defaultRules } from './defaultRules';
import type { CategoryRule } from './types';
import { SAMPLE_CSV } from '@/test/fixtures';

const rows = parseStatementCsv(SAMPLE_CSV);

describe('matchRule', () => {
  it('matches case-insensitively on a substring', () => {
    expect(matchRule('McDonalds 00001 CHARLOTTE NC', defaultRules)).toBe('dining');
  });

  it('falls back to other when nothing matches', () => {
    expect(matchRule('SOME UNKNOWN MERCHANT', defaultRules)).toBe('other');
  });

  it('lets the first rule in array order win', () => {
    const rules: CategoryRule[] = [
      { id: 'first', name: 'First', color: '#000', keywords: ['AMAZON'] },
      { id: 'second', name: 'Second', color: '#111', keywords: ['AMAZON'] },
    ];
    expect(matchRule('AMAZON MKTPL', rules)).toBe('first');
    expect(matchRule('AMAZON MKTPL', rules.slice().reverse())).toBe('second');
  });
});

describe('parseAmount', () => {
  it('reads debits as positive and credits as negative', () => {
    expect(parseAmount({ ...rows[0] })).toBe(4.99);
    expect(parseAmount({ ...rows[4] })).toBe(-1500);
  });
});

describe('parseDate', () => {
  it('parses MM/DD/YYYY as a local date', () => {
    const d = parseDate('07/03/2026');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 6, 3]);
  });
});

describe('toTransactions', () => {
  it('derives categories, amounts and credit flags', () => {
    const txns = toTransactions(rows, defaultRules, {});
    expect(txns).toHaveLength(rows.length);
    expect(txns[0].categoryId).toBe('subs');
    expect(txns[1].categoryId).toBe('amazon');
    expect(txns[4]).toMatchObject({ categoryId: 'payments', isCredit: true, amount: -1500 });
    expect(txns[6].categoryId).toBe('other');
  });

  it('lets a manual override win over the rule match', () => {
    const base = toTransactions(rows, defaultRules, {});
    const overridden = toTransactions(rows, defaultRules, { [base[1].id]: 'grocery' });
    expect(overridden[1].categoryId).toBe('grocery');
  });

  it('falls back to other when an override points at a deleted rule', () => {
    const base = toTransactions(rows, defaultRules, {});
    const overridden = toTransactions(rows, defaultRules, { [base[1].id]: 'gone' });
    expect(overridden[1].categoryId).toBe('other');
  });

  it('gives duplicate rows within a file distinct stable ids', () => {
    const dup = [rows[0], { ...rows[0] }];
    const txns = toTransactions(dup, defaultRules, {});
    expect(txns[0].id).not.toBe(txns[1].id);
    expect(toTransactions(dup, defaultRules, {}).map((t) => t.id)).toEqual(txns.map((t) => t.id));
  });

  it('re-categorizes when rules change', () => {
    const custom: CategoryRule[] = [
      { id: 'fruit', name: 'Fruit', color: '#111', keywords: ['APPLE'] },
      ...defaultRules,
    ];
    expect(toTransactions(rows, custom, {})[0].categoryId).toBe('fruit');
  });
});
