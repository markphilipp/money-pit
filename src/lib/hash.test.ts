import { describe, expect, it } from 'vitest';
import { txnId } from './hash';
import type { RawStatementRow } from './types';

const row: RawStatementRow = {
  status: 'Cleared',
  dateStr: '07/03/2026',
  description: 'APPLE.COM/BILL CUPERTINO CA',
  debit: '4.99',
  credit: '',
  person: 'ALEX SAMPLE',
};

describe('txnId', () => {
  it('is stable for identical content', () => {
    expect(txnId(row, 0)).toBe(txnId({ ...row }, 0));
  });

  it('differs per duplicate ordinal', () => {
    expect(txnId(row, 0)).not.toBe(txnId(row, 1));
  });

  it('differs when any field changes', () => {
    expect(txnId(row, 0)).not.toBe(txnId({ ...row, debit: '5.99' }, 0));
    expect(txnId(row, 0)).not.toBe(txnId({ ...row, person: 'JAMIE SAMPLE' }, 0));
  });
});
