import { describe, expect, it } from 'vitest';
import { parseStatementCsv } from './csv';
import {
  describePeriod,
  MAX_MONTHS,
  optionToPeriod,
  parseShorthand,
  periodOptions,
  searchPeriods,
  type PeriodGroup,
} from './periods';
import type { Dataset, RawStatementRow } from './types';
import { SAMPLE_CSV, SECOND_CSV } from '@/test/fixtures';

const row = (dateStr: string, n = 1): RawStatementRow => ({
  status: 'Cleared',
  dateStr,
  description: `MERCHANT ${n}`,
  debit: '10.00',
  credit: '',
  person: 'ALEX SAMPLE',
});
const file = (id: string, rows: RawStatementRow[]): Dataset => ({
  id,
  name: `${id}.csv`,
  uploadedAt: '2026-07-04T00:00:00.000Z',
  rows,
});
const july = new Date(2026, 6, 15);

const group = (groups: PeriodGroup[], id: PeriodGroup['id']) => groups.find((g) => g.id === id);
const labels = (g?: PeriodGroup) => g?.options.map((o) => o.label);
const range = (text: string, now = july) => {
  const option = parseShorthand(text, now);
  return option?.kind === 'range' ? option.range : null;
};

describe('periodOptions', () => {
  const overlapping = [
    file('june', parseStatementCsv(SAMPLE_CSV)),
    file('second', parseStatementCsv(SECOND_CSV)),
  ];

  it('lists each statement with its date span, overlapping files included', () => {
    const statements = group(periodOptions({ datasets: overlapping, now: july }), 'statements');
    expect(statements?.options.map((o) => [o.label, o.hint])).toEqual([
      ['june.csv', 'Jun 16 – Jul 3'],
      ['second.csv', 'Jun 15 – Jun 29'],
    ]);
    expect(optionToPeriod(statements!.options[1])).toEqual({ statementId: 'second' });
  });

  it('adds the year to a span that crosses years', () => {
    const datasets = [
      file('a', [row('12/20/2025'), row('01/05/2026')]),
      file('b', [row('02/01/2026')]),
    ];
    const statements = group(periodOptions({ datasets, now: july }), 'statements');
    expect(statements?.options[0].hint).toBe('Dec 20, 2025 – Jan 5, 2026');
  });

  it('hides the statements group for a single dataset', () => {
    const groups = periodOptions({ datasets: [overlapping[0]], now: july });
    expect(group(groups, 'statements')).toBeUndefined();
    expect(group(groups, 'months')).toBeDefined();
  });

  it('lists months with data newest first, and not for single-month data', () => {
    const groups = periodOptions({ datasets: overlapping, now: july });
    expect(labels(group(groups, 'months'))).toEqual(['July 2026', 'June 2026']);
    expect(optionToPeriod(group(groups, 'months')!.options[1])).toEqual({
      from: '2026-06-01',
      to: '2026-06-30',
    });

    const oneMonth = periodOptions({
      datasets: [file('a', [row('07/01/2026', 1), row('07/20/2026', 2)])],
      now: july,
    });
    expect(group(oneMonth, 'months')).toBeUndefined();
  });

  it('crosses the year boundary', () => {
    const datasets = [file('a', [row('12/31/2025', 1), row('01/01/2026', 2)])];
    const months = group(periodOptions({ datasets, now: july }), 'months');
    expect(labels(months)).toEqual(['January 2026', 'December 2025']);
    expect(optionToPeriod(months!.options[1])).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  });

  it('gives February in a leap year 29 days', () => {
    const datasets = [file('a', [row('02/10/2024', 1), row('03/10/2024', 2)])];
    const feb = group(periodOptions({ datasets, now: july }), 'months')!.options[1];
    expect(feb.label).toBe('February 2024');
    expect(optionToPeriod(feb)).toEqual({ from: '2024-02-01', to: '2024-02-29' });
  });

  it('caps months at twelve', () => {
    const rows = Array.from({ length: 14 }, (_, i) =>
      row(`${String((i % 12) + 1).padStart(2, '0')}/05/${2024 + Math.floor(i / 12)}`, i),
    );
    const months = group(periodOptions({ datasets: [file('a', rows)], now: july }), 'months');
    expect(months?.options).toHaveLength(MAX_MONTHS);
    expect(months?.options[0].label).toBe('February 2025');
  });

  it('offers only months with a shown transaction, not ones holding hidden rows', () => {
    const datasets = [file('a', [row('09/20/2026'), row('10/03/2026')])];
    const shown = [new Date(2026, 8, 20), new Date(2026, 7, 2)];
    const months = group(periodOptions({ datasets, now: july, dates: shown }), 'months');
    expect(labels(months)).toEqual(['September 2026', 'August 2026']);
  });

  it('resolves recent presets to inclusive absolute dates', () => {
    const recent = group(periodOptions({ datasets: [], now: july }), 'recent')!;
    const byLabel = Object.fromEntries(recent.options.map((o) => [o.label, optionToPeriod(o)]));
    expect(byLabel['Last 7 days']).toEqual({ from: '2026-07-09', to: '2026-07-15' });
    expect(byLabel['Last 30 days']).toEqual({ from: '2026-06-16', to: '2026-07-15' });
    expect(byLabel['Last 90 days']).toEqual({ from: '2026-04-17', to: '2026-07-15' });
    expect(byLabel['This month']).toEqual({ from: '2026-07-01', to: '2026-07-31' });
    expect(byLabel['Last month']).toEqual({ from: '2026-06-01', to: '2026-06-30' });
    expect(byLabel['This year']).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });

  it('puts last month in the previous year in January, and across a leap day', () => {
    const january = group(periodOptions({ datasets: [], now: new Date(2026, 0, 10) }), 'recent')!;
    expect(optionToPeriod(january.options.find((o) => o.label === 'Last month')!)).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
    expect(optionToPeriod(january.options[0])).toEqual({ from: '2026-01-04', to: '2026-01-10' });

    const march = group(periodOptions({ datasets: [], now: new Date(2024, 2, 3) }), 'recent')!;
    expect(optionToPeriod(march.options[0])).toEqual({ from: '2024-02-26', to: '2024-03-03' });
    expect(optionToPeriod(march.options.find((o) => o.label === 'Last month')!)).toEqual({
      from: '2024-02-01',
      to: '2024-02-29',
    });
  });

  it('always ends with the custom range option', () => {
    const groups = periodOptions({ datasets: [], now: july });
    expect(groups.at(-1)?.options.map((o) => o.kind)).toEqual(['custom']);
    expect(optionToPeriod(groups.at(-1)!.options[0])).toBeNull();
  });
});

describe('parseShorthand', () => {
  it('counts days back inclusive of today', () => {
    expect(range('3d')).toEqual({ from: '2026-07-13', to: '2026-07-15' });
    expect(range('1d')).toEqual({ from: '2026-07-15', to: '2026-07-15' });
  });

  it('accepts spelled-out units, spaces and any case', () => {
    expect(range('30 days')).toEqual(range('30d'));
    expect(range('2 Weeks')).toEqual({ from: '2026-07-02', to: '2026-07-15' });
    expect(range(' 2W ')).toEqual(range('2 weeks'));
    expect(range('1 month')).toEqual(range('1m'));
    expect(range('1 year')).toEqual(range('1Y'));
  });

  it('counts months and years by the calendar', () => {
    expect(range('3m')).toEqual({ from: '2026-04-16', to: '2026-07-15' });
    expect(range('1y')).toEqual({ from: '2025-07-16', to: '2026-07-15' });
  });

  it('clamps a month step to the last day of a shorter month', () => {
    expect(range('1m', new Date(2026, 2, 31))).toEqual({ from: '2026-03-01', to: '2026-03-31' });
    expect(range('1y', new Date(2024, 1, 29))).toEqual({ from: '2023-03-01', to: '2024-02-29' });
  });

  it('crosses a year boundary and a leap day', () => {
    expect(range('3d', new Date(2026, 0, 2))).toEqual({ from: '2025-12-31', to: '2026-01-02' });
    expect(range('2d', new Date(2024, 2, 1))).toEqual({ from: '2024-02-29', to: '2024-03-01' });
  });

  it('labels the result and hints the resolved dates', () => {
    const option = parseShorthand('3d', july);
    expect(option?.label).toBe('Last 3 days');
    expect(option?.hint).toBe('Jul 13 – Jul 15, 2026');
    expect(parseShorthand('1d', july)?.label).toBe('Last 1 day');
  });

  it('rejects zero, out-of-bounds and non-shorthand text', () => {
    for (const text of [
      '0d',
      '3651d',
      '522w',
      '122m',
      '11y',
      '99999999999d',
      '',
      'd',
      '3x',
      'june',
      '-3d',
      '1.5d',
    ]) {
      expect(parseShorthand(text, july), text).toBeNull();
    }
    expect(parseShorthand('3650d', july)).not.toBeNull();
    expect(parseShorthand('10y', july)).not.toBeNull();
  });
});

describe('searchPeriods', () => {
  const groups = periodOptions({
    datasets: [
      file('june', [row('06/16/2026', 1), row('06/29/2026', 2)]),
      file('second', [row('07/02/2026', 3)]),
    ],
    now: july,
  });

  it('returns everything for an empty query', () => {
    expect(searchPeriods(groups, '  ', july)).toBe(groups);
  });

  it('matches labels by case-insensitive substring across groups', () => {
    const found = searchPeriods(groups, 'JUN', july);
    expect(labels(group(found, 'statements'))).toEqual(['june.csv']);
    expect(labels(group(found, 'months'))).toEqual(['June 2026']);
    expect(group(found, 'recent')).toBeUndefined();
  });

  it('puts a recognized shorthand on top', () => {
    const found = searchPeriods(groups, '30d', july);
    expect(found[0].id).toBe('typed');
    expect(found[0].options[0].label).toBe('Last 30 days');
  });

  it('still offers a custom range when nothing matches', () => {
    const found = searchPeriods(groups, 'zzz', july);
    expect(found.map((g) => g.id)).toEqual(['custom']);
  });

  it('does not offer a quick range for an out-of-bounds number', () => {
    expect(group(searchPeriods(groups, '0d', july), 'typed')).toBeUndefined();
    expect(group(searchPeriods(groups, '5000d', july), 'typed')).toBeUndefined();
  });
});

describe('describePeriod', () => {
  const datasets = [file('a', [row('07/01/2026')]), file('b', [row('07/02/2026', 2)])];
  const between = (value: string, value2?: string) =>
    ({ column: 'date', operator: 'between', value, value2 }) as const;

  it('is empty without a period', () => {
    expect(describePeriod(datasets, [], undefined)).toBe('');
    expect(describePeriod(datasets, ['gone'], undefined)).toBe('');
  });

  it('names the statement, or counts several', () => {
    expect(describePeriod(datasets, ['b'], undefined)).toBe('b.csv');
    expect(describePeriod(datasets, ['a', 'b'], undefined)).toBe('2 statements');
  });

  it('names a whole month, else the range', () => {
    expect(describePeriod(datasets, [], between('2026-06-01', '2026-06-30'))).toBe('June 2026');
    expect(describePeriod(datasets, [], between('2026-06-01', '2026-06-15'))).toBe(
      'Jun 1 – Jun 15, 2026',
    );
  });

  it('shows both when a statement and a date filter coexist', () => {
    expect(describePeriod(datasets, ['a'], between('2026-06-01', '2026-06-30'))).toBe(
      'a.csv · June 2026',
    );
  });
});
