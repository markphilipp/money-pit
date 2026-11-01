import { describe, expect, it } from 'vitest';
import {
  filterToRange,
  monthRange,
  periodLabel,
  rangeLabel,
  rangeToFilter,
  wholeMonth,
} from './dateRange';
import type { ColumnFilter } from './rules/types';

const date = (operator: 'on' | 'before' | 'after' | 'between', value: string, value2?: string) =>
  ({ column: 'date', operator, value, ...(value2 ? { value2 } : {}) }) as ColumnFilter;

describe('rangeToFilter', () => {
  it('is null when both sides are empty', () => {
    expect(rangeToFilter('', '')).toBeNull();
  });

  it('builds an inclusive between', () => {
    expect(rangeToFilter('2026-03-01', '2026-03-31')).toEqual(
      date('between', '2026-03-01', '2026-03-31'),
    );
  });

  it('leaves an empty side open', () => {
    expect(rangeToFilter('2026-03-01', '')).toEqual({
      column: 'date',
      operator: 'between',
      value: '2026-03-01',
    });
    expect(rangeToFilter('', '2026-03-31')).toEqual({
      column: 'date',
      operator: 'between',
      value: '',
      value2: '2026-03-31',
    });
  });
});

describe('filterToRange', () => {
  it('is empty without a date filter', () => {
    expect(filterToRange(null)).toEqual({ from: '', to: '' });
    expect(filterToRange(undefined)).toEqual({ from: '', to: '' });
    expect(filterToRange({ column: 'person', values: ['A'] })).toEqual({ from: '', to: '' });
  });

  it('reads between on both sides, open or not', () => {
    expect(filterToRange(date('between', '2026-03-01', '2026-03-31'))).toEqual({
      from: '2026-03-01',
      to: '2026-03-31',
    });
    expect(filterToRange(date('between', '2026-03-01'))).toEqual({ from: '2026-03-01', to: '' });
  });

  it('reads on as a single day', () => {
    expect(filterToRange(date('on', '2026-03-15'))).toEqual({
      from: '2026-03-15',
      to: '2026-03-15',
    });
  });

  it('turns exclusive before/after into inclusive bounds', () => {
    expect(filterToRange(date('before', '2026-03-15'))).toEqual({ from: '', to: '2026-03-14' });
    expect(filterToRange(date('after', '2026-03-15'))).toEqual({ from: '2026-03-16', to: '' });
  });

  it('crosses month and year boundaries', () => {
    expect(filterToRange(date('before', '2026-03-01')).to).toBe('2026-02-28');
    expect(filterToRange(date('before', '2024-03-01')).to).toBe('2024-02-29');
    expect(filterToRange(date('before', '2026-01-01')).to).toBe('2025-12-31');
    expect(filterToRange(date('after', '2026-01-31')).from).toBe('2026-02-01');
    expect(filterToRange(date('after', '2025-12-31')).from).toBe('2026-01-01');
  });

  it('treats an unparseable before/after value as no bound', () => {
    expect(filterToRange(date('before', 'junk'))).toEqual({ from: '', to: '' });
  });

  it('round-trips through rangeToFilter', () => {
    const range = { from: '2026-03-01', to: '2026-03-31' };
    expect(filterToRange(rangeToFilter(range.from, range.to))).toEqual(range);
  });
});

describe('rangeLabel', () => {
  it('writes the year once when both ends share it', () => {
    expect(rangeLabel({ from: '2026-03-01', to: '2026-03-31' })).toBe('Mar 1 – Mar 31, 2026');
  });

  it('writes both years when they differ', () => {
    expect(rangeLabel({ from: '2025-12-15', to: '2026-01-10' })).toBe(
      'Dec 15, 2025 – Jan 10, 2026',
    );
  });

  it('collapses a single day', () => {
    expect(rangeLabel({ from: '2026-03-15', to: '2026-03-15' })).toBe('Mar 15, 2026');
  });

  it('labels an open side', () => {
    expect(rangeLabel({ from: '2026-03-01', to: '' })).toBe('From Mar 1, 2026');
    expect(rangeLabel({ from: '', to: '2026-03-31' })).toBe('Until Mar 31, 2026');
  });

  it('is empty for no range', () => {
    expect(rangeLabel({ from: '', to: '' })).toBe('');
  });
});

describe('monthRange and wholeMonth', () => {
  it('spans first to last day, including leap February and year ends', () => {
    expect(monthRange(2026, 5)).toEqual({ from: '2026-06-01', to: '2026-06-30' });
    expect(monthRange(2024, 1)).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(monthRange(2026, 1).to).toBe('2026-02-28');
    expect(monthRange(2025, 11).to).toBe('2025-12-31');
  });

  it('rolls an out-of-range month into the neighbouring year', () => {
    expect(monthRange(2026, -1)).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(monthRange(2025, 12)).toEqual({ from: '2026-01-01', to: '2026-01-31' });
  });

  it('recognizes exactly one whole month and nothing else', () => {
    expect(wholeMonth({ from: '2024-02-01', to: '2024-02-29' })).toEqual({ year: 2024, month: 1 });
    expect(wholeMonth({ from: '2026-06-01', to: '2026-06-29' })).toBeNull();
    expect(wholeMonth({ from: '2026-06-02', to: '2026-06-30' })).toBeNull();
    expect(wholeMonth({ from: '2026-06-01', to: '2026-07-31' })).toBeNull();
    expect(wholeMonth({ from: '', to: '2026-06-30' })).toBeNull();
  });
});

describe('periodLabel', () => {
  it('names a whole calendar month', () => {
    expect(periodLabel({ from: '2026-06-01', to: '2026-06-30' })).toBe('June 2026');
  });

  it('falls back to the range text', () => {
    expect(periodLabel({ from: '2026-06-02', to: '2026-06-30' })).toBe('Jun 2 – Jun 30, 2026');
    expect(periodLabel({ from: '2026-01-01', to: '2026-12-31' })).toBe('Jan 1 – Dec 31, 2026');
  });
});
