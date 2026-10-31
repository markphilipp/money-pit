import { describe, expect, it } from 'vitest';
import { defaultCategorization } from '@/lib/defaultRules';
import { categorizationInput, dismissedInput, preferenceInput } from './input';

const valid = defaultCategorization;

describe('categorizationInput', () => {
  it('accepts the seeded defaults', () => {
    expect(categorizationInput.safeParse(valid).success).toBe(true);
  });

  it('rejects an empty category list', () => {
    expect(categorizationInput.safeParse({ categories: [], rules: [] }).success).toBe(false);
  });

  it('rejects a color that is not a 6-digit hex value', () => {
    const bad = {
      ...valid,
      categories: valid.categories.map((c, i) => (i === 0 ? { ...c, color: 'orange' } : c)),
    };
    expect(categorizationInput.safeParse(bad).success).toBe(false);
  });

  it('rejects duplicate category ids', () => {
    const bad = { ...valid, categories: [...valid.categories, valid.categories[0]] };
    expect(categorizationInput.safeParse(bad).success).toBe(false);
  });

  it('rejects a categorization missing a builtin category', () => {
    const bad = { ...valid, categories: valid.categories.filter((c) => c.id !== 'other') };
    expect(categorizationInput.safeParse(bad).success).toBe(false);
  });

  it('rejects a rule filed into a category that does not exist', () => {
    const bad = {
      ...valid,
      rules: [
        ...valid.rules,
        { id: 'x', categoryId: 'gone', conditions: { combinator: 'and' as const, rules: [] } },
      ],
    };
    expect(categorizationInput.safeParse(bad).success).toBe(false);
  });
});

describe('preferenceInput', () => {
  const view = { chartMode: 'donut', personChartMode: 'bar', sortKey: 'date', sortDir: -1 };

  it('accepts a preference with dismissed suggestions', () => {
    expect(preferenceInput.safeParse({ ...view, dismissedSuggestions: ['a'] }).success).toBe(true);
  });

  it('requires the dismissed list', () => {
    expect(preferenceInput.safeParse(view).success).toBe(false);
  });
});

describe('dismissedInput', () => {
  it('bounds the list and each key', () => {
    expect(dismissedInput.safeParse(Array(500).fill('k')).success).toBe(true);
    expect(dismissedInput.safeParse(Array(501).fill('k')).success).toBe(false);
    expect(dismissedInput.safeParse(['k'.repeat(500)]).success).toBe(true);
    expect(dismissedInput.safeParse(['k'.repeat(501)]).success).toBe(false);
  });

  it('rejects non-string entries', () => {
    expect(dismissedInput.safeParse([1]).success).toBe(false);
  });
});
