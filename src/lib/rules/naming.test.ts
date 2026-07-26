import { describe, expect, it } from 'vitest';
import { slugify, uniqueRuleId } from './naming';

describe('slugify', () => {
  it('lowercases and hyphenates, trimming the edges', () => {
    expect(slugify('  Blue Ridge Bakery! ')).toBe('blue-ridge-bakery');
  });

  it('falls back when a name has nothing sluggable in it', () => {
    expect(slugify('!!!')).toBe('category');
  });
});

describe('uniqueRuleId', () => {
  it('keeps the plain slug when it is free', () => {
    expect(uniqueRuleId('Travel', ['grocery'])).toBe('travel');
  });

  it('counts up past every id already taken', () => {
    expect(uniqueRuleId('Travel', ['travel', 'travel-2'])).toBe('travel-3');
  });
});
