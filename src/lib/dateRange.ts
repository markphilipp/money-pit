import type { ColumnFilter } from './rules/types';

/** Inclusive `yyyy-mm-dd` bounds; an empty string leaves that side open. */
export interface DateRange {
  from: string;
  to: string;
}

type DateFilter = Extract<ColumnFilter, { column: 'date' }>;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function parts(iso: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? [+m[1], +m[2], +m[3]] : null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as `yyyy-mm-dd`: `toISOString` would shift the day in any zone ahead of UTC. */
export const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function shiftDay(iso: string, days: number): string {
  const p = parts(iso);
  if (!p) return '';
  return toIso(new Date(p[0], p[1] - 1, p[2] + days));
}

/** The whole of one calendar month; `month` is 0-based and may overflow into neighbouring years. */
export function monthRange(year: number, month: number): DateRange {
  return { from: toIso(new Date(year, month, 1)), to: toIso(new Date(year, month + 1, 0)) };
}

export const monthLabel = (year: number, month: number) => `${MONTH_NAMES[month]} ${year}`;

/** The month a range covers exactly (first day to last day), or null for any other range. */
export function wholeMonth(range: DateRange): { year: number; month: number } | null {
  const p = parts(range.from);
  if (!p || !parts(range.to)) return null;
  const month = monthRange(p[0], p[1] - 1);
  return month.from === range.from && month.to === range.to
    ? { year: p[0], month: p[1] - 1 }
    : null;
}

export function rangeToFilter(from: string, to: string): DateFilter | null {
  if (!from && !to) return null;
  return { column: 'date', operator: 'between', value: from, ...(to ? { value2: to } : {}) };
}

/** Reads any date filter back as an inclusive range, so the column menu and this one agree. */
export function filterToRange(filter: ColumnFilter | null | undefined): DateRange {
  if (!filter || filter.column !== 'date') return { from: '', to: '' };
  const { operator, value, value2 } = filter;
  switch (operator) {
    case 'between':
      return { from: value, to: value2 ?? '' };
    case 'on':
      return { from: value, to: value };
    case 'before':
      return { from: '', to: shiftDay(value, -1) };
    case 'after':
      return { from: shiftDay(value, 1), to: '' };
  }
}

export function shortDate(iso: string, withYear: boolean): string {
  const p = parts(iso);
  if (!p) return iso;
  return `${MONTHS[p[1] - 1]} ${p[2]}${withYear ? `, ${p[0]}` : ''}`;
}

export function rangeLabel({ from, to }: DateRange): string {
  if (from && to) {
    if (from === to) return shortDate(from, true);
    const sameYear = from.slice(0, 4) === to.slice(0, 4);
    return `${shortDate(from, !sameYear)} – ${shortDate(to, true)}`;
  }
  if (from) return `From ${shortDate(from, true)}`;
  if (to) return `Until ${shortDate(to, true)}`;
  return '';
}

/** "June 2026" for exactly one calendar month, otherwise the plain range text. */
export function periodLabel(range: DateRange): string {
  const month = wholeMonth(range);
  return month ? monthLabel(month.year, month.month) : rangeLabel(range);
}
