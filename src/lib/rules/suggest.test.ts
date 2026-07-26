import { describe, expect, it } from 'vitest';
import type { MatchTarget } from './engine';
import { matchesGroup } from './engine';
import { suggestRuleGroups, type Suggestion } from './suggest';

const txn = (description: string): MatchTarget => ({
  description,
  amount: 12.34,
  person: 'ALEX SAMPLE',
  date: new Date(2026, 6, 1),
});

const CORPUS = [
  'HARRIS TEETER #0042 CHARLOTTE NC',
  'HARRIS TEETER #0117 RALEIGH NC',
  'HARRIS TEETER #0042 CHARLOTTE NC',
  'McDonalds 00001 CHARLOTTE NC',
  'LOWES #01111 BELMONT NC',
  'SQ *COFFEE 123 SEATTLE WA',
  'TST* COFFEE PORTLAND OR',
  'AMAZON MKTPL*DEMO1234 SEATTLE WA',
  'AMZN Mktp US*2A3BC',
  'ONLINE PAYMENT, THANK YOU',
  'APPLE.COM/BILL CUPERTINO CA',
].map(txn);

/** Suggestions are always ranked against a corpus the selection belongs to. */
function suggest(descriptions: string[]): Suggestion[] {
  const selected = descriptions.map((d) => CORPUS.find((t) => t.description === d) ?? txn(d));
  return suggestRuleGroups(selected, CORPUS);
}

const values = (s: Suggestion) =>
  s.group.rules.map((node) => ('combinator' in node ? '' : String(node.value)));

describe('suggestRuleGroups', () => {
  it('induces the merchant core from store numbers and cities', () => {
    const [best] = suggest(['HARRIS TEETER #0042 CHARLOTTE NC', 'HARRIS TEETER #0117 RALEIGH NC']);
    expect(best.kind).toBe('token-core');
    expect(values(best)).toEqual(['HARRIS TEETER']);
    expect(best.name).toBe('Harris Teeter');
    expect(best.selectedMatched).toBe(2);
    // the third Harris Teeter row in the corpus
    expect(best.othersMatched).toBe(1);
  });

  it('strips processor prefixes at the head of the descriptor', () => {
    const [best] = suggest(['SQ *COFFEE 123 SEATTLE WA', 'TST* COFFEE PORTLAND OR']);
    expect(best.kind).toBe('token-core');
    expect(values(best)).toEqual(['COFFEE']);
    expect(best.othersMatched).toBe(0);
  });

  it('generalizes a single selected transaction', () => {
    const [best] = suggest(['LOWES #01111 BELMONT NC']);
    expect(best.kind).toBe('token-core');
    expect(values(best)).toEqual(['LOWES']);
    expect(best.name).toBe('Lowes');
  });

  it('keeps the phone number and state out of a subscription descriptor', () => {
    const [best] = suggest(['APPLE.COM/BILL CUPERTINO CA']);
    expect(values(best)).toEqual(['APPLE.COM/BILL']);
  });

  it('ORs one condition per cluster when the descriptors do not share a core', () => {
    const [best] = suggest(['AMAZON MKTPL*DEMO1234 SEATTLE WA', 'AMZN Mktp US*2A3BC']);
    expect(best.kind).toBe('or-of-clusters');
    expect(values(best)).toEqual(['AMAZON MKTPL', 'AMZN Mktp']);
    expect(best.selectedMatched).toBe(2);
  });

  it('never induces a rule from a shared city and state', () => {
    const suggestions = suggest([
      'HARRIS TEETER #0042 CHARLOTTE NC',
      'McDonalds 00001 CHARLOTTE NC',
    ]);
    for (const suggestion of suggestions) {
      for (const value of values(suggestion)) {
        expect(value.toUpperCase()).not.toBe('CHARLOTTE NC');
        expect(value.toUpperCase()).not.toBe('CHARLOTTE');
      }
    }
    expect(values(suggestions[0])).toEqual(['HARRIS TEETER', 'McDonalds']);
  });

  it('falls back to exact descriptions when there is no signal to generalize', () => {
    const suggestions = suggest(['ONLINE PAYMENT, THANK YOU']);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].kind).toBe('exact-or');
    expect(values(suggestions[0])).toEqual(['ONLINE PAYMENT, THANK YOU']);
  });

  it('always offers the exact-description fallback last', () => {
    const suggestions = suggest([
      'HARRIS TEETER #0042 CHARLOTTE NC',
      'HARRIS TEETER #0117 RALEIGH NC',
    ]);
    expect(suggestions.at(-1)!.kind).toBe('exact-or');
    expect(values(suggestions.at(-1)!)).toEqual([
      'HARRIS TEETER #0042 CHARLOTTE NC',
      'HARRIS TEETER #0117 RALEIGH NC',
    ]);
  });

  it('every suggestion matches all of the selected transactions', () => {
    const selected = [
      'HARRIS TEETER #0042 CHARLOTTE NC',
      'SQ *COFFEE 123 SEATTLE WA',
      'LOWES #01111 BELMONT NC',
    ];
    for (const suggestion of suggest(selected)) {
      for (const description of selected) {
        expect(matchesGroup(txn(description), suggestion.group)).toBe(true);
      }
      expect(suggestion.selectedMatched).toBe(selected.length);
    }
  });

  it('returns nothing for an empty selection', () => {
    expect(suggestRuleGroups([], CORPUS)).toEqual([]);
  });

  it('ignores blank descriptions rather than suggesting an empty condition', () => {
    const suggestions = suggestRuleGroups([txn('   ')], [txn('   ')]);
    expect(suggestions).toEqual([]);
  });

  it('caps the induced suggestions at three plus the fallback', () => {
    const suggestions = suggest([
      'HARRIS TEETER #0042 CHARLOTTE NC',
      'McDonalds 00001 CHARLOTTE NC',
      'LOWES #01111 BELMONT NC',
      'SQ *COFFEE 123 SEATTLE WA',
    ]);
    expect(suggestions.length).toBeLessThanOrEqual(4);
    expect(suggestions.at(-1)!.kind).toBe('exact-or');
  });
});
