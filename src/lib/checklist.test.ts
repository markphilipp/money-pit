import { describe, expect, it } from 'vitest';
import type { ColumnFilter } from './rules/types';
import {
  checklistIncludes,
  checklistOf,
  readChecklist,
  toColumnFilter,
  toggleExclude,
  toggleInclude,
} from './checklist';

describe('readChecklist', () => {
  it('reads values and the exclude flag, defaulting to an empty include list', () => {
    expect(readChecklist({}, 'category')).toEqual({ values: [] });
    expect(readChecklist({ category: { column: 'category', values: ['a'] } }, 'category')).toEqual({
      values: ['a'],
    });
    expect(
      readChecklist({ category: { column: 'category', values: ['a'], exclude: true } }, 'category'),
    ).toEqual({ values: ['a'], exclude: true });
  });

  it('ignores non-checklist filters and other columns', () => {
    const date: ColumnFilter = { column: 'date', operator: 'on', value: '2026-07-03' };
    expect(checklistOf(date)).toEqual({ values: [] });
    expect(readChecklist({ person: { column: 'person', values: ['A'] } }, 'category')).toEqual({
      values: [],
    });
  });

  it('never writes exclude: false', () => {
    const filter: ColumnFilter = { column: 'person', values: ['A'], exclude: false };
    expect(checklistOf(filter)).toEqual({ values: ['A'] });
    expect('exclude' in checklistOf(filter)).toBe(false);
  });
});

describe('checklistIncludes', () => {
  it('lets everything through when empty, in either mode', () => {
    expect(checklistIncludes({ values: [] }, 'a')).toBe(true);
    expect(checklistIncludes({ values: [], exclude: true }, 'a')).toBe(true);
  });

  it('keeps listed values when including and drops them when excluding', () => {
    expect(checklistIncludes({ values: ['a'] }, 'a')).toBe(true);
    expect(checklistIncludes({ values: ['a'] }, 'b')).toBe(false);
    expect(checklistIncludes({ values: ['a'], exclude: true }, 'a')).toBe(false);
    expect(checklistIncludes({ values: ['a'], exclude: true }, 'b')).toBe(true);
  });
});

describe('toggleInclude', () => {
  it('toggles a value in include mode and with no filter', () => {
    expect(toggleInclude({ values: [] }, 'a')).toEqual({ values: ['a'] });
    expect(toggleInclude({ values: ['a'] }, 'b')).toEqual({ values: ['a', 'b'] });
    expect(toggleInclude({ values: ['a', 'b'] }, 'a')).toEqual({ values: ['b'] });
  });

  it('removes an excluded value and stays in exclude mode', () => {
    expect(toggleInclude({ values: ['a', 'b'], exclude: true }, 'a')).toEqual({
      values: ['b'],
      exclude: true,
    });
    expect(toggleInclude({ values: ['a'], exclude: true }, 'a')).toEqual({
      values: [],
      exclude: true,
    });
  });

  it('switches to include mode for a value that is not excluded', () => {
    expect(toggleInclude({ values: ['a'], exclude: true }, 'b')).toEqual({ values: ['b'] });
  });
});

describe('toggleExclude', () => {
  it('switches include mode and no filter to exclude mode on that value', () => {
    expect(toggleExclude({ values: [] }, 'a')).toEqual({ values: ['a'], exclude: true });
    expect(toggleExclude({ values: ['a', 'b'] }, 'c')).toEqual({ values: ['c'], exclude: true });
    expect(toggleExclude({ values: ['a'] }, 'a')).toEqual({ values: ['a'], exclude: true });
  });

  it('toggles a value in exclude mode', () => {
    expect(toggleExclude({ values: ['a'], exclude: true }, 'b')).toEqual({
      values: ['a', 'b'],
      exclude: true,
    });
    expect(toggleExclude({ values: ['a', 'b'], exclude: true }, 'a')).toEqual({
      values: ['b'],
      exclude: true,
    });
  });
});

describe('toColumnFilter', () => {
  it('returns null for an empty list in either mode', () => {
    expect(toColumnFilter('category', { values: [] })).toBeNull();
    expect(toColumnFilter('category', { values: [], exclude: true })).toBeNull();
  });

  it('carries exclude only when true', () => {
    expect(toColumnFilter('category', { values: ['a'] })).toEqual({
      column: 'category',
      values: ['a'],
    });
    expect(toColumnFilter('person', { values: ['a'], exclude: false })).toEqual({
      column: 'person',
      values: ['a'],
    });
    expect(toColumnFilter('category', { values: ['a'], exclude: true })).toEqual({
      column: 'category',
      values: ['a'],
      exclude: true,
    });
  });
});
