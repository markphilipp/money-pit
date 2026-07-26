import { describe, expect, it } from 'vitest';
import type { RuleGroupType } from 'react-querybuilder';
import type { RuleGroup } from '@/lib/rules/types';
import { fromRqb, toRqb } from './rqbMap';

const group: RuleGroup = {
  combinator: 'and',
  rules: [
    { field: 'description', operator: 'contains', value: 'COSTCO' },
    { field: 'amount', operator: 'between', value: 10, value2: 50 },
    {
      combinator: 'or',
      rules: [
        { field: 'person', operator: 'is', value: 'ALEX SAMPLE' },
        { field: 'date', operator: 'before', value: '2026-07-01' },
      ],
    },
  ],
};

describe('rqbMap', () => {
  it('round-trips a nested group', () => {
    expect(fromRqb(toRqb(group))).toEqual(group);
  });

  it('gives every node a stable id', () => {
    const query = toRqb(group);
    expect(query.rules.map((r) => (r as { id?: string }).id)).toEqual(['g-0', 'g-1', 'g-2']);
    expect(toRqb(group)).toEqual(query);
  });

  it('reads a range from either a comma string or an array', () => {
    const query: RuleGroupType = {
      combinator: 'and',
      rules: [
        { field: 'amount', operator: 'between', value: '5,9' },
        { field: 'date', operator: 'between', value: ['2026-01-01', '2026-02-01'] },
      ],
    };
    expect(fromRqb(query).rules).toEqual([
      { field: 'amount', operator: 'between', value: 5, value2: 9 },
      { field: 'date', operator: 'between', value: '2026-01-01', value2: '2026-02-01' },
    ]);
  });

  it('drops rules with no value and groups left empty by that', () => {
    const query: RuleGroupType = {
      combinator: 'or',
      rules: [
        { field: 'description', operator: 'contains', value: '' },
        { field: 'amount', operator: 'gt', value: '' },
        { field: 'date', operator: 'on', value: '' },
        { combinator: 'and', rules: [{ field: 'description', operator: 'contains', value: ' ' }] },
        { field: 'description', operator: 'endsWith', value: 'NC' },
      ],
    };
    expect(fromRqb(query)).toEqual({
      combinator: 'or',
      rules: [{ field: 'description', operator: 'endsWith', value: 'NC' }],
    });
  });

  it('leaves an open-ended range open', () => {
    const query: RuleGroupType = {
      combinator: 'and',
      rules: [{ field: 'amount', operator: 'between', value: '100,' }],
    };
    expect(fromRqb(query).rules).toEqual([{ field: 'amount', operator: 'between', value: 100 }]);
  });
});
