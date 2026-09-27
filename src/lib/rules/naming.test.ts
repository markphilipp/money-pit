import { describe, expect, it } from 'vitest';
import { slugify, uniqueId } from './naming';

describe('slugify', () => {
  it('lowercases and hyphenates, trimming the edges', () => {
    expect(slugify('  Blue Ridge Bakery! ')).toBe('blue-ridge-bakery');
  });

  it('falls back when a name has nothing sluggable in it', () => {
    expect(slugify('!!!')).toBe('category');
  });
});

describe('uniqueId', () => {
  it('keeps the plain slug when it is free', () => {
    expect(uniqueId('Travel', ['grocery'])).toBe('travel');
  });

  it('counts up past every id already taken', () => {
    expect(uniqueId('Travel', ['travel', 'travel-2'])).toBe('travel-3');
  });
});
