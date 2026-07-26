import { describe, expect, it } from 'vitest';
import {
  describeGroup,
  keywordsToGroup,
  matchesColumnFilter,
  matchesGroup,
  transactionsToDraftGroup,
  type MatchTarget,
} from './engine';
import type { Condition, RuleGroup } from './types';

const txn = (patch: Partial<MatchTarget> = {}): MatchTarget => ({
  description: 'COSTCO WHSE #1234 CHARLOTTE NC',
  amount: 82.5,
  person: 'ALEX SAMPLE',
  date: new Date(2026, 6, 3),
  ...patch,
});

const and = (...rules: (Condition | RuleGroup)[]): RuleGroup => ({ combinator: 'and', rules });
const or = (...rules: (Condition | RuleGroup)[]): RuleGroup => ({ combinator: 'or', rules });
const desc = (operator: Condition['operator'], value: string) =>
  ({ field: 'description', operator, value }) as Condition;

describe('matchesGroup — text operators', () => {
  it('matches case-insensitively', () => {
    expect(matchesGroup(txn(), or(desc('contains', 'costco')))).toBe(true);
    expect(matchesGroup(txn(), or(desc('contains', 'TARGET')))).toBe(false);
  });

  it('handles notContains, equals, beginsWith and endsWith', () => {
    expect(matchesGroup(txn(), or(desc('notContains', 'TARGET')))).toBe(true);
    expect(matchesGroup(txn(), or(desc('notContains', 'COSTCO')))).toBe(false);
    expect(matchesGroup(txn({ description: 'DMV' }), or(desc('equals', 'dmv')))).toBe(true);
    expect(matchesGroup(txn(), or(desc('beginsWith', 'costco')))).toBe(true);
    expect(matchesGroup(txn(), or(desc('endsWith', 'nc')))).toBe(true);
    expect(matchesGroup(txn(), or(desc('endsWith', 'costco')))).toBe(false);
  });

  it('matches regex case-insensitively and never throws on a bad pattern', () => {
    expect(matchesGroup(txn(), or(desc('regex', 'whse\\s+#\\d+')))).toBe(true);
    expect(matchesGroup(txn(), or(desc('regex', '[unclosed')))).toBe(false);
  });

  it('anchors globs to the whole description', () => {
    expect(matchesGroup(txn(), or(desc('glob', '*COSTCO*')))).toBe(true);
    expect(matchesGroup(txn(), or(desc('glob', 'COSTCO')))).toBe(false);
    expect(matchesGroup(txn({ description: 'QT 42' }), or(desc('glob', 'QT ??')))).toBe(true);
    expect(matchesGroup(txn({ description: 'QT 421' }), or(desc('glob', 'QT ??')))).toBe(false);
  });

  it('treats glob specials as literals outside * and ?', () => {
    expect(matchesGroup(txn({ description: 'A.B' }), or(desc('glob', 'A.B')))).toBe(true);
    expect(matchesGroup(txn({ description: 'AXB' }), or(desc('glob', 'A.B')))).toBe(false);
  });
});

describe('matchesGroup — amount, person and date', () => {
  it('compares amounts by magnitude', () => {
    const credit = txn({ amount: -120 });
    expect(matchesGroup(credit, or({ field: 'amount', operator: 'gt', value: 100 }))).toBe(true);
    expect(matchesGroup(credit, or({ field: 'amount', operator: 'lt', value: 100 }))).toBe(false);
    expect(matchesGroup(credit, or({ field: 'amount', operator: 'eq', value: 120 }))).toBe(true);
    expect(matchesGroup(credit, or({ field: 'amount', operator: 'neq', value: 120 }))).toBe(false);
    expect(matchesGroup(credit, or({ field: 'amount', operator: 'lte', value: 120 }))).toBe(true);
    expect(matchesGroup(credit, or({ field: 'amount', operator: 'gte', value: 121 }))).toBe(false);
  });

  it('treats between as inclusive with an unbounded upper end', () => {
    const between = (value: number, value2?: number): Condition => ({
      field: 'amount',
      operator: 'between',
      value,
      value2,
    });
    expect(matchesGroup(txn({ amount: 82.5 }), or(between(82.5, 100)))).toBe(true);
    expect(matchesGroup(txn({ amount: 100 }), or(between(82.5, 100)))).toBe(true);
    expect(matchesGroup(txn({ amount: 101 }), or(between(82.5, 100)))).toBe(false);
    expect(matchesGroup(txn({ amount: 5000 }), or(between(82.5)))).toBe(true);
  });

  it('matches person exactly, either way round', () => {
    expect(matchesGroup(txn(), or({ field: 'person', operator: 'is', value: 'alex sample' }))).toBe(
      true,
    );
    expect(
      matchesGroup(txn(), or({ field: 'person', operator: 'isNot', value: 'ALEX SAMPLE' })),
    ).toBe(false);
  });

  it('compares dates at day granularity', () => {
    const on = txn({ date: new Date(2026, 6, 3, 23, 59) });
    expect(matchesGroup(on, or({ field: 'date', operator: 'on', value: '2026-07-03' }))).toBe(true);
    expect(matchesGroup(on, or({ field: 'date', operator: 'before', value: '2026-07-03' }))).toBe(
      false,
    );
    expect(matchesGroup(on, or({ field: 'date', operator: 'after', value: '2026-07-02' }))).toBe(
      true,
    );
    expect(
      matchesGroup(
        on,
        or({ field: 'date', operator: 'between', value: '2026-07-03', value2: '2026-07-03' }),
      ),
    ).toBe(true);
    expect(matchesGroup(on, or({ field: 'date', operator: 'on', value: 'nonsense' }))).toBe(false);
  });
});

describe('matchesGroup — structure', () => {
  it('never matches an empty group', () => {
    expect(matchesGroup(txn(), and())).toBe(false);
    expect(matchesGroup(txn(), or())).toBe(false);
  });

  it('evaluates nested groups', () => {
    const group = and(
      or(desc('contains', 'COSTCO'), desc('contains', 'SAMS')),
      { field: 'amount', operator: 'gt', value: 50 },
      and({ field: 'person', operator: 'is', value: 'ALEX SAMPLE' }),
    );
    expect(matchesGroup(txn(), group)).toBe(true);
    expect(matchesGroup(txn({ amount: 10 }), group)).toBe(false);
    expect(matchesGroup(txn({ person: 'JAMIE SAMPLE' }), group)).toBe(false);
  });
});

describe('matchesColumnFilter', () => {
  it('reuses the condition evaluators for typed columns', () => {
    expect(
      matchesColumnFilter(
        txn(),
        { column: 'description', operator: 'contains', value: 'costco' },
        'x',
      ),
    ).toBe(true);
    expect(matchesColumnFilter(txn(), { column: 'amount', operator: 'lt', value: 10 }, 'x')).toBe(
      false,
    );
    expect(
      matchesColumnFilter(txn(), { column: 'date', operator: 'on', value: '2026-07-03' }, 'x'),
    ).toBe(true);
  });

  it('treats an empty checklist as no filter', () => {
    expect(matchesColumnFilter(txn(), { column: 'person', values: [] }, 'x')).toBe(true);
    expect(matchesColumnFilter(txn(), { column: 'category', values: [] }, 'x')).toBe(true);
  });

  it('checks the checklists against person and the passed category', () => {
    expect(
      matchesColumnFilter(txn(), { column: 'person', values: ['ALEX SAMPLE', 'X'] }, 'grocery'),
    ).toBe(true);
    expect(matchesColumnFilter(txn(), { column: 'person', values: ['JAMIE SAMPLE'] }, 'x')).toBe(
      false,
    );
    expect(matchesColumnFilter(txn(), { column: 'category', values: ['grocery'] }, 'grocery')).toBe(
      true,
    );
    expect(matchesColumnFilter(txn(), { column: 'category', values: ['pets'] }, 'grocery')).toBe(
      false,
    );
  });
});

describe('group builders', () => {
  it('turns keywords into an OR of description-contains, dropping blanks', () => {
    expect(keywordsToGroup(['LOWE', ' ', 'HOME DEPOT'])).toEqual({
      combinator: 'or',
      rules: [
        { field: 'description', operator: 'contains', value: 'LOWE' },
        { field: 'description', operator: 'contains', value: 'HOME DEPOT' },
      ],
    });
  });

  it('drafts one condition per unique transaction description', () => {
    const group = transactionsToDraftGroup([
      txn({ description: ' AMAZON MKTPL ' }),
      txn({ description: 'AMAZON MKTPL' }),
      txn({ description: 'CHEWY' }),
    ]);
    expect(group.rules).toEqual([
      { field: 'description', operator: 'contains', value: 'AMAZON MKTPL' },
      { field: 'description', operator: 'contains', value: 'CHEWY' },
    ]);
  });
});

describe('describeGroup', () => {
  it('summarizes a flat group on one line', () => {
    expect(describeGroup(or(desc('contains', 'LOWE'), desc('contains', 'ACE')))).toBe(
      'description contains LOWE or description contains ACE',
    );
  });

  it('parenthesizes nested groups and labels every field', () => {
    expect(
      describeGroup(
        and(or(desc('contains', 'QT'), desc('glob', '*SHELL*')), {
          field: 'amount',
          operator: 'gte',
          value: 25,
        }),
      ),
    ).toBe('(description contains QT or description matches *SHELL*) and amount ≥ 25');
  });

  it('reports an empty group and truncates long summaries', () => {
    expect(describeGroup(and())).toBe('No conditions');
    const long = describeGroup(
      keywordsToGroup(Array.from({ length: 20 }, (_, i) => `MERCHANT${i}`)),
    );
    expect(long).toHaveLength(80);
    expect(long.endsWith('…')).toBe(true);
  });
});
