import { describe, expect, it } from 'vitest';
import { fmtMoney, personShort } from './format';

describe('fmtMoney', () => {
  it('formats positive amounts with thousands separators', () => {
    expect(fmtMoney(1234.5)).toBe('$1,234.50');
  });

  it('uses a unicode minus for negatives', () => {
    expect(fmtMoney(-1234.56)).toBe('−$1,234.56');
  });

  it('formats zero', () => {
    expect(fmtMoney(0)).toBe('$0.00');
  });
});

describe('personShort', () => {
  it('title-cases the first name', () => {
    expect(personShort('MARK PHILIPP')).toBe('Mark');
  });

  it('handles single-word names', () => {
    expect(personShort('alex')).toBe('Alex');
  });

  it('returns an empty string for blank input', () => {
    expect(personShort('   ')).toBe('');
  });
});
