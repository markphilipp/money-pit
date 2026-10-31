import { describe, expect, it } from 'vitest';
import { OTHER_ID, PAYMENTS_ID, type Transaction } from '../types';
import { discoverProposals, MIN_CLUSTER } from './discover';
import { matchesGroup } from './engine';

let next = 0;
const txn = (description: string, categoryId = OTHER_ID): Transaction => ({
  id: `t${next++}`,
  status: 'Cleared',
  date: new Date(2026, 6, 1),
  dateStr: '07/01/2026',
  description,
  amount: 12.34,
  isCredit: false,
  person: 'ALEX SAMPLE',
  categoryId,
});

const AMAZON = [
  'AMAZON MKTPL*AB1CD2 SEATTLE WA',
  'AMAZON MKTPL*EF3GH4 SEATTLE WA',
  'AMAZON MKTPL*IJ5KL6 SEATTLE WA',
];
const HARRIS = [
  'HARRIS TEETER #0042 CHARLOTTE NC',
  'HARRIS TEETER #0117 RALEIGH NC',
  'HARRIS TEETER #0042 CHARLOTTE NC',
  'HARRIS TEETER #0301 MONROE NC',
];

const run = (txns: Transaction[], overrides = {}, dismissed: string[] = []) =>
  discoverProposals(txns, overrides, new Set(dismissed));

describe('discoverProposals', () => {
  it('groups a recurring merchant whose id and store number vary', () => {
    const txns = [...AMAZON, ...HARRIS].map((d) => txn(d));
    const proposals = run(txns);
    expect(proposals.map((p) => p.label)).toEqual([
      'contains “HARRIS TEETER”',
      'contains “AMAZON MKTPL”',
    ]);
    const [harris] = proposals;
    expect(harris.name).toBe('Harris Teeter');
    expect(harris.txnIds).toHaveLength(4);
    expect(harris.samples).toEqual([
      'HARRIS TEETER #0042 CHARLOTTE NC',
      'HARRIS TEETER #0117 RALEIGH NC',
      'HARRIS TEETER #0301 MONROE NC',
    ]);
    expect(harris.group.combinator).toBe('or');
  });

  it('skips clusters smaller than MIN_CLUSTER', () => {
    expect(MIN_CLUSTER).toBe(3);
    const txns = HARRIS.slice(0, MIN_CLUSTER - 1).map((d) => txn(d));
    expect(run(txns)).toEqual([]);
  });

  it('ignores rows that are already categorized', () => {
    const txns = [...HARRIS.slice(0, 2).map((d) => txn(d)), txn(HARRIS[2], 'groceries')];
    expect(run(txns)).toEqual([]);
  });

  it('ignores rows with a manual override, even one that points at Other', () => {
    const txns = HARRIS.map((d) => txn(d));
    const overrides = { [txns[0].id]: 'groceries', [txns[1].id]: OTHER_ID };
    expect(run(txns, overrides)).toEqual([]);
  });

  it('rejects a pattern that would steal categorized rows', () => {
    const txns = [...AMAZON.map((d) => txn(d)), txn('AMAZON MKTPL*ZZ9ZZ9 SEATTLE WA', 'shopping')];
    expect(run(txns)).toEqual([]);
  });

  it('rejects a pattern that would claim an overridden row', () => {
    const txns = AMAZON.map((d) => txn(d));
    const overridden = txn('AMAZON MKTPL*ZZ9ZZ9 SEATTLE WA');
    expect(run([...txns, overridden], { [overridden.id]: 'shopping' })).toEqual([]);
  });

  it('rejects a pattern that would claim a payment', () => {
    const txns = [...AMAZON.map((d) => txn(d)), txn('AMAZON MKTPL*REFUND SEATTLE WA', PAYMENTS_ID)];
    expect(run(txns)).toEqual([]);
  });

  it('never proposes a literal-description rule', () => {
    const txns = Array.from({ length: 4 }, () => txn('ONLINE PAYMENT, THANK YOU'));
    expect(run(txns)).toEqual([]);
  });

  it('covers every pool row the pattern matches, not only the cluster', () => {
    const txns = [...HARRIS.map((d) => txn(d)), txn('THE HARRIS TEETER PHARMACY ONLINE ORDER')];
    const [proposal] = run(txns);
    expect(proposal.txnIds).toHaveLength(5);
    const matched = txns.filter((t) => matchesGroup(t, proposal.group)).map((t) => t.id);
    expect(proposal.txnIds.sort()).toEqual(matched.sort());
  });

  it('drops dismissed keys', () => {
    const txns = [...AMAZON, ...HARRIS].map((d) => txn(d));
    const [harris, amazon] = run(txns);
    const afterDismiss = run(txns, {}, [harris.key]);
    expect(afterDismiss.map((p) => p.key)).toEqual([amazon.key]);
    expect(run(txns, {}, [harris.key, amazon.key])).toEqual([]);
  });

  it('keeps a key stable when more rows arrive', () => {
    const txns = AMAZON.map((d) => txn(d));
    const [before] = run(txns);
    const grown = [...txns, txn('AMAZON MKTPL*MN7OP8 SEATTLE WA'), ...HARRIS.map((d) => txn(d))];
    const after = run(grown).find((p) => p.label === before.label)!;
    expect(after.key).toBe(before.key);
    expect(after.txnIds).toHaveLength(4);
  });

  it('keeps a dismissal across an upload that adds overlapping rows', () => {
    const txns = HARRIS.map((d) => txn(d));
    const [proposal] = run(txns);
    const grown = [...txns, txn('HARRIS TEETER #0999 CONCORD NC')];
    expect(run(grown, {}, [proposal.key])).toEqual([]);
  });

  it('matches keys case-insensitively', () => {
    const upper = run(AMAZON.map((d) => txn(d)))[0];
    const lower = run(AMAZON.map((d) => txn(d.toLowerCase())))[0];
    expect(lower.key).toBe(upper.key);
  });

  it('sorts by coverage, then label', () => {
    const txns = [
      ...AMAZON.map((d) => txn(d)),
      ...HARRIS.map((d) => txn(d)),
      ...['LOWES #01111 BELMONT NC', 'LOWES #02222 GASTONIA NC', 'LOWES #03333 CHARLOTTE NC'].map(
        (d) => txn(d),
      ),
    ];
    const proposals = run(txns);
    expect(proposals.map((p) => p.txnIds.length)).toEqual([4, 3, 3]);
    expect(proposals.map((p) => p.label)).toEqual([
      'contains “HARRIS TEETER”',
      'contains “AMAZON MKTPL”',
      'contains “LOWES”',
    ]);
  });

  it('returns nothing for an empty pool', () => {
    expect(run([])).toEqual([]);
  });
});
