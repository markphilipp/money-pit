import { describe, expect, it } from 'vitest';
import { defaultCategorization } from '@/lib/defaultRules';
import { categorizationInput } from './input';

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
