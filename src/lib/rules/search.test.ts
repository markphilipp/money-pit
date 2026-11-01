import { describe, expect, it } from 'vitest';
import type { Rule } from '@/lib/types';
import { searchRules } from './search';

const rule = (id: string, categoryId: string, ...values: string[]): Rule => ({
  id,
  categoryId,
  conditions: {
    combinator: 'or',
    rules: values.map((value) => ({ field: 'description', operator: 'contains', value })),
  },
});

const rules = [
  rule('a', 'groceries', 'HARRIS TEETER', 'WALMART'),
  rule('b', 'groceries', 'KROGER'),
  rule('c', 'shopping', 'AMAZON'),
];
const labels = new Map([
  ['a', 'Groceries #1'],
  ['b', 'Groceries #2'],
  ['c', 'Shopping'],
]);
const ids = (query: string) => searchRules(rules, labels, query).map((r) => r.id);

describe('searchRules', () => {
  it('returns every rule, in order, for an empty or blank query', () => {
    expect(ids('')).toEqual(['a', 'b', 'c']);
    expect(ids('   ')).toEqual(['a', 'b', 'c']);
  });

  it('matches the label case-insensitively', () => {
    expect(ids('groceries #2')).toEqual(['b']);
    expect(ids('GROCERIES')).toEqual(['a', 'b']);
  });

  it('matches the conditions text', () => {
    expect(ids('amazon')).toEqual(['c']);
    expect(ids('walmart')).toEqual(['a']);
    expect(ids('contains kroger')).toEqual(['b']);
  });

  it('finds a term beyond the list summary cut-off', () => {
    const long = rule(
      'd',
      'travel',
      ...Array.from({ length: 12 }, (_, i) => `PADDING${i}`),
      'ZEBRA',
    );
    expect(searchRules([long], new Map([['d', 'Travel']]), 'zebra')).toEqual([long]);
  });

  it('returns nothing when nothing matches', () => {
    expect(ids('nope')).toEqual([]);
  });
});
