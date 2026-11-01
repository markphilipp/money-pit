import { describe, expect, it } from 'vitest';
import { mergeConditions } from './merge';
import type { Condition, RuleGroup } from './types';

const contains = (value: string): Condition => ({
  field: 'description',
  operator: 'contains',
  value,
});
const group = (combinator: RuleGroup['combinator'], ...rules: RuleGroup['rules']): RuleGroup => ({
  combinator,
  rules,
});

describe('mergeConditions', () => {
  it('returns the addition when the existing rule has no conditions', () => {
    const addition = group('or', contains('A'));
    expect(mergeConditions(group('and'), addition)).toBe(addition);
  });

  it('returns the existing rule when there is nothing to add', () => {
    const existing = group('or', contains('A'));
    expect(mergeConditions(existing, group('or'))).toBe(existing);
  });

  it('flattens an or addition into an or rule', () => {
    expect(
      mergeConditions(group('or', contains('A')), group('or', contains('B'), contains('C'))),
    ).toEqual(group('or', contains('A'), contains('B'), contains('C')));
  });

  it('appends an and addition to an or rule as one nested group', () => {
    const addition = group('and', contains('B'), contains('C'));
    expect(mergeConditions(group('or', contains('A')), addition)).toEqual(
      group('or', contains('A'), addition),
    );
  });

  it('wraps an and rule in an or alongside the flattened addition', () => {
    const existing = group('and', contains('A'), contains('B'));
    expect(mergeConditions(existing, group('or', contains('C'), contains('D')))).toEqual(
      group('or', existing, contains('C'), contains('D')),
    );
  });

  it('wraps an and rule with an and addition as two branches', () => {
    const existing = group('and', contains('A'), contains('B'));
    const addition = group('and', contains('C'), contains('D'));
    expect(mergeConditions(existing, addition)).toEqual(group('or', existing, addition));
  });

  it('skips nodes already present, so re-adding is idempotent', () => {
    const existing = group('or', contains('A'), group('and', contains('B'), contains('C')));
    const once = mergeConditions(existing, group('or', contains('A'), contains('D')));
    expect(once).toEqual(
      group('or', contains('A'), group('and', contains('B'), contains('C')), contains('D')),
    );
    expect(mergeConditions(once, group('or', contains('A'), contains('D')))).toEqual(once);
    expect(mergeConditions(once, group('and', contains('B'), contains('C')))).toEqual(once);
  });

  it('leaves an and rule alone when its own conditions are added back', () => {
    const existing = group('and', contains('A'), contains('B'));
    expect(mergeConditions(existing, existing)).toBe(existing);
  });

  it('does not mutate its inputs', () => {
    const existing = group('or', contains('A'));
    const snapshot = JSON.stringify(existing);
    mergeConditions(existing, group('or', contains('B')));
    expect(JSON.stringify(existing)).toBe(snapshot);
  });
});
