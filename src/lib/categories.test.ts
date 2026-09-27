import { describe, expect, it } from 'vitest';
import {
  categoryUsage,
  deletionImpact,
  findCategoryByName,
  removeCategory,
  resolveCategoryChoice,
  ruleLabels,
  upgradeLegacyRules,
  type LegacyRule,
} from './categories';
import { keywordsToGroup } from './rules/engine';
import type { Category, Rule, Transaction } from './types';

const empty = { combinator: 'and' as const, rules: [] };

const txn = (id: string, categoryId: string): Transaction => ({
  id,
  status: 'Cleared',
  date: new Date(2026, 0, 1),
  dateStr: '01/01/2026',
  description: 'x',
  amount: 10,
  isCredit: false,
  person: 'ALEX SAMPLE',
  categoryId,
});

describe('upgradeLegacyRules', () => {
  it('splits each rule into a category and a rule sharing its id', () => {
    const legacy: LegacyRule[] = [
      {
        id: 'grocery',
        name: 'Groceries',
        color: '#2E7D5B',
        conditions: keywordsToGroup(['KROGER']),
      },
    ];
    expect(upgradeLegacyRules(legacy)).toEqual({
      categories: [{ id: 'grocery', name: 'Groceries', color: '#2E7D5B' }],
      rules: [{ id: 'grocery', categoryId: 'grocery', conditions: keywordsToGroup(['KROGER']) }],
    });
  });

  it('keeps a builtin flag on both halves', () => {
    const legacy: LegacyRule[] = [
      {
        id: 'payments',
        name: 'Payments',
        color: '#9AA39C',
        conditions: keywordsToGroup(['AUTOPAY']),
        builtin: true,
      },
    ];
    const { categories, rules } = upgradeLegacyRules(legacy);
    expect(categories[0].builtin).toBe(true);
    expect(rules[0].builtin).toBe(true);
  });

  it('turns an empty-condition rule into a category with no rule of its own', () => {
    const legacy: LegacyRule[] = [
      { id: 'other', name: 'Other', color: '#8A8F98', conditions: empty, builtin: true },
    ];
    expect(upgradeLegacyRules(legacy)).toEqual({
      categories: [{ id: 'other', name: 'Other', color: '#8A8F98', builtin: true }],
      rules: [],
    });
  });

  it('falls back to the seeded defaults when there is nothing to upgrade', () => {
    expect(upgradeLegacyRules([]).categories.length).toBeGreaterThan(0);
  });
});

describe('categoryUsage', () => {
  it('counts rules and transactions per category, defaulting the rest to zero', () => {
    const categories: Category[] = [
      { id: 'grocery', name: 'Groceries', color: '#2E7D5B' },
      { id: 'other', name: 'Other', color: '#8A8F98', builtin: true },
    ];
    const rules: Rule[] = [
      { id: 'a', categoryId: 'grocery', conditions: keywordsToGroup(['KROGER']) },
      { id: 'b', categoryId: 'grocery', conditions: keywordsToGroup(['ALDI']) },
    ];
    const transactions = [txn('1', 'grocery'), txn('2', 'grocery'), txn('3', 'other')];

    const usage = categoryUsage({ categories, rules }, transactions);
    expect(usage.get('grocery')).toEqual({ rules: 2, transactions: 2 });
    expect(usage.get('other')).toEqual({ rules: 0, transactions: 1 });
  });
});

describe('deletionImpact', () => {
  const rules: Rule[] = [
    { id: 'a', categoryId: 'travel', conditions: keywordsToGroup(['DELTA']) },
    { id: 'b', categoryId: 'travel', conditions: keywordsToGroup(['UNITED']) },
  ];

  it('separates rows an override placed from rows a rule filed', () => {
    const transactions = [txn('1', 'travel'), txn('2', 'travel'), txn('3', 'travel')];
    const overrides = { '1': 'travel' };

    const impact = deletionImpact('travel', rules, overrides, transactions);
    expect(impact.rules).toHaveLength(2);
    expect(impact.overridden).toBe(1);
    expect(impact.transactions).toBe(3);
  });

  it('is empty when nothing files into the category', () => {
    const impact = deletionImpact('unused', rules, {}, []);
    expect(impact).toEqual({ rules: [], overridden: 0, transactions: 0 });
  });
});

describe('removeCategory', () => {
  const state = {
    categories: [
      { id: 'travel', name: 'Travel', color: '#111' } satisfies Category,
      { id: 'other', name: 'Other', color: '#8A8F98', builtin: true } satisfies Category,
    ],
    rules: [
      { id: 'a', categoryId: 'travel', conditions: keywordsToGroup(['DELTA']) } satisfies Rule,
      { id: 'b', categoryId: 'other', conditions: empty } satisfies Rule,
    ],
    overrides: { '1': 'travel', '2': 'other' },
  };

  it('drops the category, its rules, and overrides pointing at it', () => {
    const next = removeCategory(state, 'travel');
    expect(next.categories.map((c) => c.id)).toEqual(['other']);
    expect(next.rules.map((r) => r.id)).toEqual(['b']);
    expect(next.overrides).toEqual({ '2': 'other' });
  });

  it('refuses to remove a builtin category', () => {
    expect(removeCategory(state, 'other')).toBe(state);
  });

  it('is a no-op for an id that does not exist', () => {
    expect(removeCategory(state, 'nope')).toBe(state);
  });

  it('keeps a builtin rule even if it is filed under the category being deleted', () => {
    const withStrandedBuiltin = {
      ...state,
      rules: [
        ...state.rules,
        { id: 'payments', categoryId: 'travel', builtin: true, conditions: empty },
      ],
    };
    const next = removeCategory(withStrandedBuiltin, 'travel');
    expect(next.rules.map((r) => r.id)).toEqual(['b', 'payments']);
  });
});

describe('findCategoryByName', () => {
  const categories: Category[] = [{ id: 'grocery', name: 'Groceries', color: '#2E7D5B' }];

  it('matches case-insensitively', () => {
    expect(findCategoryByName(categories, '  groceries ')?.id).toBe('grocery');
  });

  it('returns undefined when nothing matches', () => {
    expect(findCategoryByName(categories, 'Travel')).toBeUndefined();
  });
});

describe('resolveCategoryChoice', () => {
  const categories: Category[] = [{ id: 'grocery', name: 'Groceries', color: '#2E7D5B' }];

  it('resolves an existing choice to its category', () => {
    expect(resolveCategoryChoice({ kind: 'existing', id: 'grocery' }, categories)).toEqual({
      category: categories[0],
      isNew: false,
    });
  });

  it('returns null when an existing choice points at a deleted category', () => {
    expect(resolveCategoryChoice({ kind: 'existing', id: 'gone' }, categories)).toBeNull();
  });

  it('reuses a category whose name matches a new choice', () => {
    const resolved = resolveCategoryChoice(
      { kind: 'new', name: 'groceries', color: '#000' },
      categories,
    );
    expect(resolved).toEqual({ category: categories[0], isNew: false });
  });

  it('mints a slug id for a genuinely new name', () => {
    const resolved = resolveCategoryChoice(
      { kind: 'new', name: 'Travel', color: '#123' },
      categories,
    );
    expect(resolved).toEqual({
      category: { id: 'travel', name: 'Travel', color: '#123' },
      isNew: true,
    });
  });

  it('returns null for a new choice with no name yet', () => {
    expect(
      resolveCategoryChoice({ kind: 'new', name: '  ', color: '#123' }, categories),
    ).toBeNull();
  });
});

describe('ruleLabels', () => {
  it('names a single rule after its category', () => {
    const categories: Category[] = [{ id: 'grocery', name: 'Groceries', color: '#2E7D5B' }];
    const rules: Rule[] = [
      { id: 'a', categoryId: 'grocery', conditions: keywordsToGroup(['KROGER']) },
    ];
    expect([...ruleLabels(rules, categories).values()]).toEqual(['Groceries']);
  });

  it('numbers several rules filing into the same category', () => {
    const categories: Category[] = [{ id: 'grocery', name: 'Groceries', color: '#2E7D5B' }];
    const rules: Rule[] = [
      { id: 'a', categoryId: 'grocery', conditions: keywordsToGroup(['KROGER']) },
      { id: 'b', categoryId: 'grocery', conditions: keywordsToGroup(['ALDI']) },
    ];
    expect([...ruleLabels(rules, categories).values()]).toEqual(['Groceries #1', 'Groceries #2']);
  });

  it('falls back to the raw id when the category is gone', () => {
    const rules: Rule[] = [{ id: 'a', categoryId: 'gone', conditions: keywordsToGroup(['X']) }];
    expect([...ruleLabels(rules, []).values()]).toEqual(['gone']);
  });
});
