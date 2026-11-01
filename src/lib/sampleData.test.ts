import { describe, expect, it } from 'vitest';
import { toTransactions } from './categorize';
import { parseStatementCsv } from './csv';
import { defaultCategorization, defaultRules } from './defaultRules';
import { sampleStatements } from './sampleData';

describe('sampleStatements', () => {
  it('is deterministic', () => {
    expect(sampleStatements()).toEqual(sampleStatements());
  });

  it('parses as three statements with two cardholders', () => {
    const files = sampleStatements();
    expect(files).toHaveLength(3);
    const rows = files.flatMap((f) => parseStatementCsv(f.text));
    expect(new Set(rows.map((r) => r.person))).toEqual(new Set(['ALEX SAMPLE', 'JAMIE SAMPLE']));
    expect(rows.length).toBeGreaterThan(100);
  });

  it('exercises every non-builtin default category and leaves some uncategorized', () => {
    const rows = sampleStatements().flatMap((f) => parseStatementCsv(f.text));
    const hit = new Set(toTransactions(rows, defaultCategorization, {}).map((t) => t.categoryId));
    for (const rule of defaultRules) expect(hit).toContain(rule.categoryId);
    expect(hit).toContain('other');
  });
});
