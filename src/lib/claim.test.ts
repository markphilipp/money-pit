import { describe, expect, it } from 'vitest';
import { toTransactions } from './categorize';
import { claimInto, type Dataset } from './claim';
import { parseStatementCsv } from './csv';
import { defaultCategories, defaultCategorization, defaultRules } from './defaultRules';
import { keywordsToGroup } from './rules/engine';
import type { Category, Rule } from './types';
import { SAMPLE_CSV, SECOND_CSV } from '@/test/fixtures';

const sample = parseStatementCsv(SAMPLE_CSV);
const second = parseStatementCsv(SECOND_CSV);
const coffeeCategory: Category = { id: 'coffee', name: 'Coffee', color: '#6b4f3a' };
const coffeeRule: Rule = {
  id: 'coffee-rule',
  categoryId: 'coffee',
  conditions: keywordsToGroup(['STARBUCKS']),
};
const dataset = (patch: Partial<Dataset>): Dataset => ({
  rawRows: [],
  categories: defaultCategories,
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
    const categorization = { categories: defaultCategories, rules: defaultRules };
    const [lowes] = toTransactions(second, categorization, {});
    const merged = claimInto(
      dataset({ rawRows: sample }),
      dataset({ rawRows: second, overrides: { [lowes.id]: 'pets' } }),
    );
    const txn = toTransactions(
      merged.rawRows,
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
      rawRows: second,
      categories: [coffeeCategory, ...defaultCategories],
      rules: [coffeeRule, ...defaultRules],
      overrides: { [lowes.id]: 'pets' },
    });
    const once = claimInto(dataset({ rawRows: sample }), local);
    expect(claimInto(once, local)).toEqual(once);
  });
});
