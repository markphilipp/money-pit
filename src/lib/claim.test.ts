import { describe, expect, it } from 'vitest';
import { toTransactions } from './categorize';
import { claimInto, type Holdings } from './claim';
import { parseStatementCsv } from './csv';
import { mergeDatasets } from './datasets';
import { defaultCategories, defaultCategorization, defaultRules } from './defaultRules';
import { keywordsToGroup } from './rules/engine';
import type { Category, Dataset, Rule } from './types';
import { SAMPLE_CSV, SECOND_CSV } from '@/test/fixtures';

const sample = parseStatementCsv(SAMPLE_CSV);
const second = parseStatementCsv(SECOND_CSV);
const coffeeCategory: Category = { id: 'coffee', name: 'Coffee', color: '#6b4f3a' };
const coffeeRule: Rule = {
  id: 'coffee-rule',
  categoryId: 'coffee',
  conditions: keywordsToGroup(['STARBUCKS']),
};
const file = (id: string, rows: Dataset['rows']): Dataset => ({
  id,
  name: `${id}.csv`,
  uploadedAt: '2026-07-04T00:00:00.000Z',
  rows,
});
const dataset = (patch: Partial<Holdings>): Holdings => ({
  datasets: [],
  categories: defaultCategories,
  rules: defaultRules,
  overrides: {},
  ...patch,
});

describe('claimInto', () => {
  it('dedupes the session against the account like a second upload', () => {
    const merged = claimInto(
      dataset({ datasets: [file('a', sample)] }),
      dataset({ datasets: [file('b', second)] }),
    );
    const rows = mergeDatasets(merged.datasets);
    expect(merged.datasets.map((d) => d.id)).toEqual(['a', 'b']);
    expect(rows).toHaveLength(8);
    expect(rows.slice(0, 7)).toEqual(sample);
  });

  it('keeps the account’s copy of a dataset both sides hold', () => {
    const account = file('a', sample);
    const merged = claimInto(
      dataset({ datasets: [account] }),
      dataset({ datasets: [{ ...file('a', second), name: 'local.csv' }] }),
    );
    expect(merged.datasets).toEqual([account]);
  });

  it('keeps the session’s overrides on the merged rows', () => {
    const categorization = { categories: defaultCategories, rules: defaultRules };
    const [lowes] = toTransactions(second, categorization, {});
    const merged = claimInto(
      dataset({ datasets: [file('a', sample)] }),
      dataset({ datasets: [file('b', second)], overrides: { [lowes.id]: 'pets' } }),
    );
    const txn = toTransactions(
      mergeDatasets(merged.datasets),
      { categories: merged.categories, rules: merged.rules },
      merged.overrides,
    ).find((t) => t.id === lowes.id);
    expect(txn?.categoryId).toBe('pets');
  });

  it('lets the session’s categories and rules replace an account still on the defaults', () => {
    const editedCategories = defaultCategories.map((c) =>
      c.id === 'home' ? { ...c, name: 'Renovations' } : c,
    );
    // jsonb hands conditions back with its own key order
    const fromDb = defaultRules.map((r) => ({
      ...r,
      conditions: { rules: r.conditions.rules, combinator: r.conditions.combinator },
    }));
    const account = dataset({ categories: defaultCategorization.categories, rules: fromDb });
    const session = dataset({ categories: editedCategories, rules: defaultRules });
    const merged = claimInto(account, session);
    expect(merged.categories).toBe(editedCategories);
    expect(merged.rules).toBe(defaultRules);
  });

  it('adds only new categories and rules to an account that has its own, ahead of the builtins', () => {
    const account = dataset({
      categories: [coffeeCategory, ...defaultCategories],
      rules: [coffeeRule, ...defaultRules],
    });
    const renamedCategories = defaultCategories.map((c) =>
      c.id === 'home' ? { ...c, name: 'DIY' } : c,
    );
    const tea: Rule = { ...coffeeRule, id: 'tea-rule', categoryId: 'tea' };
    const teaCategory: Category = { ...coffeeCategory, id: 'tea', name: 'Tea' };
    const session = dataset({
      categories: [teaCategory, ...renamedCategories],
      rules: [tea, ...defaultRules],
    });
    const { categories, rules } = claimInto(account, session);

    expect(categories.map((c) => c.id)).toEqual([
      'coffee',
      ...defaultCategories.filter((c) => !c.builtin).map((c) => c.id),
      'tea',
      'payments',
      'other',
    ]);
    expect(categories.find((c) => c.id === 'home')?.name).toBe('Home Improvement');
    expect(rules.map((r) => r.id)).toEqual([
      'coffee-rule',
      ...defaultRules.filter((r) => !r.builtin).map((r) => r.id),
      'tea-rule',
      'payments',
    ]);
  });

  it('changes nothing when the same session is claimed twice', () => {
    const categorization = { categories: defaultCategories, rules: defaultRules };
    const [lowes] = toTransactions(second, categorization, {});
    const local = dataset({
      datasets: [file('b', second)],
      categories: [coffeeCategory, ...defaultCategories],
      rules: [coffeeRule, ...defaultRules],
      overrides: { [lowes.id]: 'pets' },
    });
    const once = claimInto(dataset({ datasets: [file('a', sample)] }), local);
    expect(claimInto(once, local)).toEqual(once);
  });
});
