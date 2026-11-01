import { describe, expect, it } from 'vitest';
import { toTransactions } from './categorize';
import { parseStatementCsv } from './csv';
import {
  addDataset,
  datasetImpact,
  datasetSpan,
  mergeDatasets,
  removeDataset,
  statementTxnIds,
} from './datasets';
import { defaultCategorization } from './defaultRules';
import { rowKey } from './hash';
import type { Dataset, RawStatementRow } from './types';
import { SAMPLE_CSV, SECOND_CSV } from '@/test/fixtures';

const sample = parseStatementCsv(SAMPLE_CSV);
const second = parseStatementCsv(SECOND_CSV);
const file = (id: string, rows: RawStatementRow[]): Dataset => ({
  id,
  name: `${id}.csv`,
  uploadedAt: '2026-07-04T00:00:00.000Z',
  rows,
});
const ids = (rows: RawStatementRow[]) =>
  toTransactions(rows, defaultCategorization, {}).map((t) => t.id);

// mulberry32: a seeded generator keeps the property test reproducible.
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pool: RawStatementRow[] = Array.from({ length: 6 }, (_, i) => ({
  status: 'Cleared',
  dateStr: `07/0${i + 1}/2026`,
  description: `MERCHANT ${i}`,
  debit: `${10 + i}.00`,
  credit: '',
  person: 'ALEX SAMPLE',
}));

/** What the merged rows must be, stated without `mergeRows`: each key at its highest per-file count. */
function expectedMultiset(files: Dataset[]) {
  const max = new Map<string, number>();
  for (const f of files) {
    const counts = new Map<string, number>();
    for (const row of f.rows) counts.set(rowKey(row), (counts.get(rowKey(row)) ?? 0) + 1);
    for (const [k, n] of counts) max.set(k, Math.max(max.get(k) ?? 0, n));
  }
  return max;
}

function multiset(rows: RawStatementRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(rowKey(row), (counts.get(rowKey(row)) ?? 0) + 1);
  return counts;
}

describe('mergeDatasets', () => {
  it('is empty with no datasets', () => {
    expect(mergeDatasets([])).toEqual([]);
  });

  it('dedupes overlap like successive uploads', () => {
    const merged = mergeDatasets([file('a', sample), file('b', second)]);
    expect(merged).toHaveLength(8);
    expect(merged.slice(0, 7)).toEqual(sample);
  });
});

describe('addDataset', () => {
  it('ignores a file whose rows an existing dataset already holds, in any order', () => {
    const datasets = [file('a', sample)];
    expect(addDataset(datasets, file('b', [...sample].reverse()))).toBe(datasets);
  });

  it('keeps an overlapping file as its own dataset', () => {
    const datasets = addDataset([file('a', sample)], file('b', second));
    expect(datasets.map((d) => d.id)).toEqual(['a', 'b']);
  });

  it('treats a file with fewer copies of a repeated row as different', () => {
    const [one] = sample;
    const datasets = [file('a', [one, one])];
    expect(addDataset(datasets, file('b', [one]))).toHaveLength(2);
  });
});

describe('removeDataset', () => {
  it('leaves rows another file also holds and drops the rest', () => {
    const state = { datasets: [file('a', sample), file('b', second)], overrides: {} };
    const lowes = sample[5];
    const { datasets } = removeDataset(state, 'a');
    const rows = mergeDatasets(datasets);
    expect(rows).toEqual(second);
    expect(rows).toContainEqual(lowes);
  });

  it('prunes overrides of vanished rows and keeps the rest', () => {
    const merged = mergeDatasets([file('a', sample), file('b', second)]);
    const all = ids(merged);
    const [apple] = all;
    const lowes = all[5];
    const { overrides } = removeDataset(
      {
        datasets: [file('a', sample), file('b', second)],
        overrides: { [apple]: 'x', [lowes]: 'y' },
      },
      'a',
    );
    expect(overrides).toEqual({ [lowes]: 'y' });
  });

  it('returns the same state for an unknown id', () => {
    const state = { datasets: [file('a', sample)], overrides: {} };
    expect(removeDataset(state, 'nope')).toBe(state);
  });

  it('empties everything when the last dataset goes', () => {
    const [apple] = ids(sample);
    const next = removeDataset({ datasets: [file('a', sample)], overrides: { [apple]: 'x' } }, 'a');
    expect(next).toEqual({ datasets: [], overrides: {} });
  });

  it('equals never having uploaded the file, for random overlapping files', () => {
    const rand = random(7);
    for (let trial = 0; trial < 200; trial++) {
      const files = Array.from({ length: 1 + Math.floor(rand() * 4) }, (_, i) =>
        file(
          `f${i}`,
          Array.from(
            { length: 1 + Math.floor(rand() * 8) },
            () => pool[Math.floor(rand() * pool.length)],
          ),
        ),
      );
      const removed = files[Math.floor(rand() * files.length)];
      const rest = files.filter((f) => f !== removed);
      const { datasets } = removeDataset({ datasets: files, overrides: {} }, removed.id);
      const rows = mergeDatasets(datasets);

      expect(datasets).toEqual(rest);
      expect(multiset(rows)).toEqual(expectedMultiset(rest));
      // every surviving row is still reachable through some remaining file
      const survivors = new Set(rest.flatMap((f) => f.rows.map(rowKey)));
      expect(rows.every((r) => survivors.has(rowKey(r)))).toBe(true);
    }
  });
});

describe('datasetImpact', () => {
  const datasets = [file('a', sample), file('b', second)];
  const all = ids(mergeDatasets(datasets));

  it('counts vanishing rows, rows kept by another file, and lost overrides', () => {
    expect(datasetImpact(datasets, {}, 'a')).toEqual({
      transactions: 6,
      shared: 1,
      lostOverrides: 0,
    });
    const overrides = { [all[0]]: 'x', [all[1]]: 'x', [all[5]]: 'x' };
    expect(datasetImpact(datasets, overrides, 'a').lostOverrides).toBe(2);
  });

  it('is only the unique rows when the other file is the one removed', () => {
    expect(datasetImpact(datasets, {}, 'b')).toEqual({
      transactions: 1,
      shared: 1,
      lostOverrides: 0,
    });
  });

  it('counts a repeated row only for its extra copies', () => {
    const [one] = sample;
    const two = [file('a', [one, one]), file('b', [one])];
    expect(datasetImpact(two, {}, 'a')).toEqual({ transactions: 1, shared: 1, lostOverrides: 0 });
    expect(datasetImpact(two, {}, 'b')).toEqual({ transactions: 0, shared: 1, lostOverrides: 0 });
  });

  it('is zero for an unknown id', () => {
    expect(datasetImpact(datasets, {}, 'nope')).toEqual({
      transactions: 0,
      shared: 0,
      lostOverrides: 0,
    });
  });
});

describe('datasetSpan', () => {
  it('returns the earliest and latest dates', () => {
    const span = datasetSpan(sample);
    expect(span?.from).toEqual(new Date(2026, 5, 16));
    expect(span?.to).toEqual(new Date(2026, 6, 3));
  });

  it('is null without rows', () => {
    expect(datasetSpan([])).toBeNull();
  });
});

describe('statementTxnIds', () => {
  const [one, two, three] = sample;
  const merged = (ds: Dataset[]) => ids(mergeDatasets(ds));

  it('is empty for no ids or unknown ids', () => {
    const ds = [file('a', sample)];
    expect(statementTxnIds(ds, [])).toEqual(new Set());
    expect(statementTxnIds(ds, ['nope'])).toEqual(new Set());
  });

  it('holds exactly one file’s transactions, shared rows included', () => {
    const ds = [file('a', sample), file('b', second)];
    const all = merged(ds);
    const a = statementTxnIds(ds, ['a']);
    const b = statementTxnIds(ds, ['b']);
    expect(a.size).toBe(sample.length);
    expect(b.size).toBe(second.length);
    expect([...a, ...b].every((id) => all.includes(id))).toBe(true);
    const lowes = ids(sample).find((id, i) => sample[i].description.startsWith('LOWES'))!;
    expect(a.has(lowes) && b.has(lowes)).toBe(true);
  });

  it('unions several files', () => {
    const ds = [file('a', [one]), file('b', [two]), file('c', [three])];
    expect(statementTxnIds(ds, ['a', 'c'])).toEqual(new Set(merged([ds[0], ds[2]])));
  });

  it('gives a repeated same-day row only to the file that holds each copy', () => {
    const ds = [file('a', [one, one]), file('b', [one])];
    const [first, second] = merged(ds);
    expect(statementTxnIds(ds, ['a'])).toEqual(new Set([first, second]));
    expect(statementTxnIds(ds, ['b'])).toEqual(new Set([first]));
  });
});
