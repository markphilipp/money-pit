import { parseDate } from './categorize';
import { datasetSpan, mergeDatasets } from './datasets';
import type { ColumnFilter } from './rules/types';
import {
  filterToRange,
  monthLabel,
  monthRange,
  periodLabel,
  rangeLabel,
  shortDate,
  toIso,
  type DateRange,
} from './dateRange';
import type { Dataset } from './types';

/** What the period filter holds: one statement, one inclusive date range, or nothing. */
export type Period = { statementId: string } | DateRange | null;

interface OptionBase {
  key: string;
  label: string;
  /** Muted text right-aligned in the row. */
  hint: string;
}

export type PeriodOption =
  | (OptionBase & { kind: 'statement'; datasetId: string })
  | (OptionBase & { kind: 'range'; range: DateRange })
  | (OptionBase & { kind: 'custom' });

export interface PeriodGroup {
  id: 'typed' | 'statements' | 'months' | 'recent' | 'custom';
  /** Absent for groups that read fine without one. */
  heading?: string;
  options: PeriodOption[];
}

export const MAX_MONTHS = 12;
export const MAX_SHORTHAND_DAYS = 3650;

const CUSTOM: PeriodOption = { kind: 'custom', key: 'custom', label: 'Custom range…', hint: '' };

export function optionToPeriod(option: PeriodOption): Period {
  if (option.kind === 'statement') return { statementId: option.datasetId };
  if (option.kind === 'range') return option.range;
  return null;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Moves by calendar months, clamping to the last day (Mar 31 minus one month is Feb 28/29). */
function addMonths(d: Date, n: number): Date {
  const first = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(d.getDate(), last));
}

function range(from: Date, to: Date): DateRange {
  return { from: toIso(from), to: toIso(to) };
}

const rangeOption = (key: string, label: string, r: DateRange): PeriodOption => ({
  kind: 'range',
  key,
  label,
  hint: rangeLabel(r),
  range: r,
});

function recent(now: Date): PeriodOption[] {
  const today = startOfDay(now);
  const lastDays = (n: number) =>
    rangeOption(`recent:${n}d`, `Last ${n} days`, range(addDays(today, -(n - 1)), today));
  const year = today.getFullYear();
  const month = today.getMonth();
  const previous = monthRange(year, month - 1);
  return [
    lastDays(7),
    lastDays(30),
    lastDays(90),
    rangeOption('recent:this-month', 'This month', monthRange(year, month)),
    rangeOption('recent:last-month', 'Last month', previous),
    rangeOption('recent:this-year', 'This year', {
      from: toIso(new Date(year, 0, 1)),
      to: toIso(new Date(year, 11, 31)),
    }),
  ];
}

function spanHint(rows: Dataset['rows']): string {
  const span = datasetSpan(rows);
  if (!span) return '';
  const from = toIso(span.from);
  const to = toIso(span.to);
  if (from === to) return shortDate(from, true);
  return from.slice(0, 4) === to.slice(0, 4)
    ? `${shortDate(from, false)} – ${shortDate(to, false)}`
    : rangeLabel({ from, to });
}

/** Every calendar month holding a transaction date, newest first. */
function monthsWithData(dates: Date[]): { year: number; month: number }[] {
  const seen = new Map<number, { year: number; month: number }>();
  for (const d of dates) {
    if (Number.isNaN(d.getTime())) continue;
    seen.set(d.getFullYear() * 12 + d.getMonth(), { year: d.getFullYear(), month: d.getMonth() });
  }
  return [...seen.entries()].sort((a, b) => b[0] - a[0]).map(([, month]) => month);
}

/** The options offered for an empty query. Groups with nothing to offer are left out. */
export function periodOptions({
  datasets,
  now,
  dates = mergeDatasets(datasets).map((row) => parseDate(row.dateStr)),
}: {
  datasets: Dataset[];
  now: Date;
  /** Dates of the transactions the table can show; a month only offers itself if one lands in it. */
  dates?: Date[];
}): PeriodGroup[] {
  const groups: PeriodGroup[] = [];

  if (datasets.length >= 2) {
    groups.push({
      id: 'statements',
      heading: 'Statements',
      options: datasets.map((d) => ({
        kind: 'statement',
        key: `statement:${d.id}`,
        label: d.name,
        hint: spanHint(d.rows),
        datasetId: d.id,
      })),
    });
  }

  const months = monthsWithData(dates);
  if (months.length >= 2) {
    groups.push({
      id: 'months',
      heading: 'Months in your data',
      options: months.slice(0, MAX_MONTHS).map(({ year, month }) => {
        const r = monthRange(year, month);
        return {
          kind: 'range',
          key: `month:${r.from.slice(0, 7)}`,
          label: monthLabel(year, month),
          hint: '',
          range: r,
        };
      }),
    });
  }

  groups.push({ id: 'recent', heading: 'Recent', options: recent(now) });
  groups.push({ id: 'custom', options: [CUSTOM] });
  return groups;
}

const UNIT_DAYS = { d: 1, w: 7, m: 30, y: 365 } as const;
const UNIT_NAMES = { d: 'day', w: 'week', m: 'month', y: 'year' } as const;
const SHORTHAND = /^(\d+)\s*(d|w|m|y|days?|weeks?|months?|years?)$/i;

/** "3d", "2 weeks", "6m" as "the last N units up to today"; null for anything else or out of bounds. */
export function parseShorthand(text: string, now: Date): PeriodOption | null {
  const match = SHORTHAND.exec(text.trim());
  if (!match) return null;
  const n = Number(match[1]);
  const unit = match[2][0].toLowerCase() as keyof typeof UNIT_DAYS;
  if (n < 1 || n * UNIT_DAYS[unit] > MAX_SHORTHAND_DAYS) return null;

  const today = startOfDay(now);
  const start =
    unit === 'd'
      ? addDays(today, -(n - 1))
      : unit === 'w'
        ? addDays(today, -(7 * n - 1))
        : addDays(addMonths(today, unit === 'm' ? -n : -12 * n), 1);
  const name = UNIT_NAMES[unit] + (n === 1 ? '' : 's');
  return rangeOption('typed', `Last ${n} ${name}`, range(start, today));
}

/**
 * The options matching what was typed: a recognized shorthand first, then every option whose label
 * contains the text. "Custom range…" is always last, so a miss still has somewhere to go.
 */
export function searchPeriods(groups: PeriodGroup[], query: string, now: Date): PeriodGroup[] {
  const text = query.trim().toLowerCase();
  if (!text) return groups;
  const typed = parseShorthand(text, now);
  const matched = groups
    .filter((g) => g.id !== 'custom')
    .map((g) => ({ ...g, options: g.options.filter((o) => o.label.toLowerCase().includes(text)) }))
    .filter((g) => g.options.length > 0);
  const custom = groups.filter((g) => g.id === 'custom');
  return [
    ...(typed ? [{ id: 'typed' as const, heading: 'Quick range', options: [typed] }] : []),
    ...matched,
    ...custom,
  ];
}

/**
 * Text for the active period, or '' for none. A statement and a date filter can coexist (the Date
 * column menu sets the latter without clearing the former), so both are named rather than hiding one.
 */
export function describePeriod(
  datasets: Dataset[],
  statementIds: string[],
  dateFilter: ColumnFilter | undefined,
): string {
  const named = datasets.filter((d) => statementIds.includes(d.id));
  const statement =
    named.length === 0 ? '' : named.length === 1 ? named[0].name : `${named.length} statements`;
  const dates = dateFilter ? periodLabel(filterToRange(dateFilter)) : '';
  return [statement, dates].filter(Boolean).join(' · ');
}
