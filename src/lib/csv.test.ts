import { describe, expect, it } from 'vitest';
import { CsvFormatError, mergeRows, parseStatementCsv } from './csv';
import { HEADER, SAMPLE_CSV, SECOND_CSV } from '@/test/fixtures';

describe('parseStatementCsv', () => {
  it('parses rows and keeps commas inside quoted fields', () => {
    const rows = parseStatementCsv(SAMPLE_CSV);
    expect(rows).toHaveLength(7);
    expect(rows[4]).toEqual({
      status: 'Cleared',
      dateStr: '06/30/2026',
      description: 'ONLINE PAYMENT, THANK YOU',
      debit: '',
      credit: '-1500.00',
      person: 'ALEX SAMPLE',
    });
  });

  it('handles escaped quotes inside a description', () => {
    const rows = parseStatementCsv(
      `${HEADER}\nCleared,07/03/2026,"PAL""S SUBS CHARLOTTE NC",5.25,,ALEX SAMPLE`,
    );
    expect(rows[0].description).toBe('PAL"S SUBS CHARLOTTE NC');
  });

  it('skips blank lines', () => {
    const rows = parseStatementCsv(
      `${HEADER}\n\nCleared,07/03/2026,"APPLE.COM/BILL",4.99,,ALEX SAMPLE\n\n`,
    );
    expect(rows).toHaveLength(1);
  });

  it('rejects a file with the wrong header', () => {
    expect(() => parseStatementCsv('Date,Description,Amount\n07/03/2026,APPLE,4.99')).toThrow(
      CsvFormatError,
    );
  });

  it('rejects an empty file', () => {
    expect(() => parseStatementCsv('   ')).toThrow(/empty/i);
  });

  it('accepts a header-only file as zero rows', () => {
    expect(parseStatementCsv(HEADER)).toEqual([]);
  });
});

describe('mergeRows', () => {
  it('drops rows that already exist from an overlapping export', () => {
    const first = parseStatementCsv(SAMPLE_CSV);
    const second = parseStatementCsv(SECOND_CSV);
    const merged = mergeRows(first, second);
    expect(merged).toHaveLength(first.length + 1);
    expect(merged.at(-1)?.description).toContain('HULU');
  });

  it('keeps genuine same-day duplicates inside one file', () => {
    const rows = parseStatementCsv(
      [
        HEADER,
        'Cleared,07/01/2026,"McDonalds 00001 CHARLOTTE NC",11.62,,JAMIE SAMPLE',
        'Cleared,07/01/2026,"McDonalds 00001 CHARLOTTE NC",11.62,,JAMIE SAMPLE',
      ].join('\n'),
    );
    expect(mergeRows([], rows)).toHaveLength(2);
  });

  it('does not re-add duplicates when the same file is uploaded twice', () => {
    const rows = parseStatementCsv(SAMPLE_CSV);
    expect(mergeRows(rows, rows)).toHaveLength(rows.length);
  });
});
