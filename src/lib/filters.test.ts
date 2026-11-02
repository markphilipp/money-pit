import { describe, expect, it } from 'vitest';
import { isFiltered } from './filters';
import type { FilterState } from './types';

const emptyFilters: FilterState = {
  search: '',
  showCredits: false,
  statementIds: [],
  columnFilters: {},
};

describe('isFiltered', () => {
  it('is false for the empty filters', () => {
    expect(isFiltered(emptyFilters)).toBe(false);
  });

  it.each([
    ['a search', { search: 'lowes' }],
    ['credits shown', { showCredits: true }],
    ['a statement', { statementIds: ['d1'] }],
    ['a column filter', { columnFilters: { person: { column: 'person', values: ['Alex'] } } }],
  ] as [string, Partial<FilterState>][])('is true with %s', (_, patch) => {
    expect(isFiltered({ ...emptyFilters, ...patch })).toBe(true);
  });
});
