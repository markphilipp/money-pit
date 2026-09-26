import { describe, expect, it } from 'vitest';
import { toTransactions } from './categorize';
import { claimInto, type Dataset } from './claim';
import { parseStatementCsv } from './csv';
import { defaultRules } from './defaultRules';
import { keywordsToGroup } from './rules/engine';
import type { CategoryRule } from './types';
import { SAMPLE_CSV, SECOND_CSV } from '@/test/fixtures';

const sample = parseStatementCsv(SAMPLE_CSV);
const second = parseStatementCsv(SECOND_CSV);
const coffee: CategoryRule = {
  id: 'coffee',
  name: 'Coffee',
  color: '#6b4f3a',
  conditions: keywordsToGroup(['STARBUCKS']),
};
const dataset = (patch: Partial<Dataset>): Dataset => ({
  rawRows: [],
  rules: defaultRules,
  overrides: {},
  ...patch,
});

describe('claimInto', () => {
  it('dedupes the session against the account like a second upload', () => {
    const merged = claimInto(dataset({ rawRows: sample }), dataset({ rawRows: second }));
    expect(merged.rawRows).toHaveLength(8);
    expect(merged.rawRows.slice(0, 7)).toEqual(sample);
  });

  it('keeps the session’s overrides on the merged rows', () => {
    const [lowes] = toTransactions(second, defaultRules, {});
    const merged = claimInto(
      dataset({ rawRows: sample }),
      dataset({ rawRows: second, overrides: { [lowes.id]: 'pets' } }),
    );
    const txn = toTransactions(merged.rawRows, merged.rules, merged.overrides).find(
      (t) => t.id === lowes.id,
    );
    expect(txn?.categoryId).toBe('pets');
  });

  it('lets the session’s rules replace an account still on the defaults', () => {
    const edited = defaultRules.map((r) => (r.id === 'home' ? { ...r, name: 'Renovations' } : r));
    // jsonb hands conditions back with its own key order
    const fromDb = defaultRules.map((r) => ({
      ...r,
      conditions: { rules: r.conditions.rules, combinator: r.conditions.combinator },
    }));
    expect(claimInto(dataset({ rules: fromDb }), dataset({ rules: edited })).rules).toBe(edited);
  });

  it('adds only new rules to an account that has its own, ahead of the builtins', () => {
    const account = [coffee, ...defaultRules];
    const renamed = defaultRules.map((r) => (r.id === 'home' ? { ...r, name: 'DIY' } : r));
    const tea = { ...coffee, id: 'tea', name: 'Tea' };
    const { rules } = claimInto(dataset({ rules: account }), dataset({ rules: [tea, ...renamed] }));

    expect(rules.map((r) => r.id)).toEqual([
      'coffee',
      ...defaultRules.filter((r) => !r.builtin).map((r) => r.id),
      'tea',
      'payments',
      'other',
    ]);
    expect(rules.find((r) => r.id === 'home')?.name).toBe('Home Improvement');
  });

  it('changes nothing when the same session is claimed twice', () => {
    const [lowes] = toTransactions(second, defaultRules, {});
    const local = dataset({
      rawRows: second,
      rules: [coffee, ...defaultRules],
      overrides: { [lowes.id]: 'pets' },
    });
    const once = claimInto(dataset({ rawRows: sample }), local);
    expect(claimInto(once, local)).toEqual(once);
  });
});
