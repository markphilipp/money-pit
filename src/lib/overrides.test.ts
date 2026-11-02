import { describe, expect, it } from 'vitest';
import { applyOverrideSnapshot, snapshotOverrides } from './overrides';

describe('snapshotOverrides', () => {
  it('records the prior override per id and undefined where there was none', () => {
    const snapshot = snapshotOverrides({ a: 'pets', b: 'dining' }, ['a', 'c']);
    expect(snapshot).toEqual({ a: 'pets', c: undefined });
    expect('c' in snapshot).toBe(true);
  });
});

describe('applyOverrideSnapshot', () => {
  it('restores prior values and deletes overrides that did not exist', () => {
    const before = { a: 'pets', z: 'auto' };
    const snapshot = snapshotOverrides(before, ['a', 'c']);
    const after = { a: 'dining', c: 'travel', z: 'auto' };
    expect(applyOverrideSnapshot(after, snapshot)).toEqual(before);
  });

  it('returns a new object and leaves its input alone', () => {
    const overrides = { a: 'pets' };
    const next = applyOverrideSnapshot(overrides, { a: undefined });
    expect(next).toEqual({});
    expect(next).not.toBe(overrides);
    expect(overrides).toEqual({ a: 'pets' });
  });

  it('leaves ids outside the snapshot untouched', () => {
    expect(applyOverrideSnapshot({ a: 'pets', b: 'auto' }, { a: 'dining' })).toEqual({
      a: 'dining',
      b: 'auto',
    });
  });
});
