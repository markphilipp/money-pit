import type { Transaction } from '@/lib/types';
import type {
  ColumnFilter,
  ColumnId,
  Condition,
  DateOperator,
  NumberOperator,
  RuleGroup,
  TextOperator,
} from './types';

/** Conditions only read these fields, so a row can be matched before its category is resolved. */
export type MatchTarget = Pick<Transaction, 'description' | 'amount' | 'person' | 'date'>;

const globSource = (glob: string) =>
  `^${glob.replace(/[.*+?^${}()|[\]\\]/g, (c) => (c === '*' ? '.*' : c === '?' ? '.' : `\\${c}`))}$`;

/** Patterns repeat across every row of an evaluation pass, and invalid ones must never throw. */
const patternCache = new Map<string, RegExp | null>();

function compile(kind: 'regex' | 'glob', pattern: string): RegExp | null {
  const key = `${kind}:${pattern}`;
  if (!patternCache.has(key)) {
    try {
      patternCache.set(key, new RegExp(kind === 'glob' ? globSource(pattern) : pattern, 'i'));
    } catch {
      patternCache.set(key, null);
    }
  }
  return patternCache.get(key)!;
}

function matchesText(subject: string, operator: TextOperator, value: string): boolean {
  if (operator === 'regex' || operator === 'glob') {
    return compile(operator, value)?.test(subject) ?? false;
  }

  const a = subject.toUpperCase();
  const b = value.toUpperCase();
  switch (operator) {
    case 'contains':
      return a.includes(b);
    case 'notContains':
      return !a.includes(b);
    case 'equals':
      return a === b;
    case 'beginsWith':
      return a.startsWith(b);
    case 'endsWith':
      return a.endsWith(b);
  }
}

function matchesNumber(
  subject: number,
  operator: NumberOperator,
  value: number,
  value2?: number,
): boolean {
  switch (operator) {
    case 'eq':
      return subject === value;
    case 'neq':
      return subject !== value;
    case 'lt':
      return subject < value;
    case 'lte':
      return subject <= value;
    case 'gt':
      return subject > value;
    case 'gte':
      return subject >= value;
    case 'between':
      return (
        (!Number.isFinite(value) || subject >= value) &&
        (value2 == null || !Number.isFinite(value2) || subject <= value2)
      );
  }
}

/** Filter and condition dates are ISO `yyyy-mm-dd`; compare as local midnights. */
function isoDay(value: string): number | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!parts) return null;
  return new Date(+parts[1], +parts[2] - 1, +parts[3]).getTime();
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

function matchesDate(
  subject: Date,
  operator: DateOperator,
  value: string,
  value2?: string,
): boolean {
  const day = startOfDay(subject);
  const target = isoDay(value);
  if (operator === 'between') {
    const hi = value2 ? isoDay(value2) : null;
    return (target == null || day >= target) && (hi == null || day <= hi);
  }
  if (target == null) return false;
  switch (operator) {
    case 'on':
      return day === target;
    case 'before':
      return day < target;
    case 'after':
      return day > target;
  }
}

function matchesCondition(txn: MatchTarget, condition: Condition): boolean {
  switch (condition.field) {
    case 'description':
      return matchesText(txn.description, condition.operator, condition.value);
    case 'amount':
      return matchesNumber(
        Math.abs(txn.amount),
        condition.operator,
        condition.value,
        condition.value2,
      );
    case 'person': {
      const same = txn.person.toUpperCase() === condition.value.toUpperCase();
      return condition.operator === 'is' ? same : !same;
    }
    case 'date':
      return matchesDate(txn.date, condition.operator, condition.value, condition.value2);
  }
}

const isGroup = (node: Condition | RuleGroup): node is RuleGroup => 'combinator' in node;

export function matchesGroup(txn: MatchTarget, group: RuleGroup): boolean {
  if (!group?.rules?.length) return false;
  const test = (node: Condition | RuleGroup) =>
    isGroup(node) ? matchesGroup(txn, node) : matchesCondition(txn, node);
  return group.combinator === 'or' ? group.rules.some(test) : group.rules.every(test);
}

export function matchesColumnFilter(
  txn: MatchTarget,
  filter: ColumnFilter,
  categoryId: string,
): boolean {
  switch (filter.column) {
    case 'description':
      return matchesText(txn.description, filter.operator, filter.value);
    case 'amount':
      return matchesNumber(Math.abs(txn.amount), filter.operator, filter.value, filter.value2);
    case 'date':
      return matchesDate(txn.date, filter.operator, filter.value, filter.value2);
    case 'person':
      return filter.values.length === 0 || filter.values.includes(txn.person);
    case 'category':
      return filter.values.length === 0 || filter.values.includes(categoryId);
  }
}

/** `columnFilters` is keyed by column but typed as the whole union, so narrow checklists here. */
export function checklistValues(
  columnFilters: Partial<Record<ColumnId, ColumnFilter>>,
  column: 'person' | 'category',
): string[] {
  const filter = columnFilters[column];
  return filter && 'values' in filter ? filter.values : [];
}

export function keywordsToGroup(keywords: string[]): RuleGroup {
  return {
    combinator: 'or',
    rules: keywords
      .map((k) => k.trim())
      .filter(Boolean)
      .map((value) => ({ field: 'description', operator: 'contains', value }) as Condition),
  };
}

export function transactionsToDraftGroup(txns: MatchTarget[]): RuleGroup {
  const seen: string[] = [];
  for (const t of txns) {
    const description = t.description.trim();
    if (description && !seen.includes(description)) seen.push(description);
  }
  return keywordsToGroup(seen);
}

const TEXT_LABELS: Record<TextOperator, string> = {
  contains: 'contains',
  notContains: 'does not contain',
  equals: 'is',
  beginsWith: 'starts with',
  endsWith: 'ends with',
  regex: 'matches regex',
  glob: 'matches',
};

const NUMBER_LABELS: Record<NumberOperator, string> = {
  eq: '=',
  neq: '≠',
  lt: '<',
  lte: '≤',
  gt: '>',
  gte: '≥',
  between: 'between',
};

const DATE_LABELS: Record<DateOperator, string> = {
  on: 'on',
  before: 'before',
  after: 'after',
  between: 'between',
};

function describeCondition(condition: Condition): string {
  switch (condition.field) {
    case 'description':
      return `description ${TEXT_LABELS[condition.operator]} ${condition.value}`;
    case 'amount':
      return condition.operator === 'between'
        ? `amount between ${condition.value} and ${condition.value2 ?? '∞'}`
        : `amount ${NUMBER_LABELS[condition.operator]} ${condition.value}`;
    case 'person':
      return `person ${condition.operator === 'is' ? 'is' : 'is not'} ${condition.value}`;
    case 'date':
      return condition.operator === 'between'
        ? `date between ${condition.value} and ${condition.value2 ?? '∞'}`
        : `date ${DATE_LABELS[condition.operator]} ${condition.value}`;
  }
}

const MAX_SUMMARY = 80;

export function describeGroup(group: RuleGroup, depth = 0): string {
  if (!group?.rules?.length) return 'No conditions';
  const parts = group.rules.map((node) =>
    'combinator' in node ? describeGroup(node, depth + 1) : describeCondition(node),
  );
  const joined = parts.join(` ${group.combinator} `);
  const wrapped = depth > 0 && parts.length > 1 ? `(${joined})` : joined;
  if (depth > 0) return wrapped;
  return wrapped.length > MAX_SUMMARY ? `${wrapped.slice(0, MAX_SUMMARY - 1)}…` : wrapped;
}
