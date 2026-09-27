import { describe, expect, it } from 'vitest';
import { idleStatus, nextSaveStatus, type SaveEvent, type SaveStatus } from './saveStatus';

const run = (events: SaveEvent[], from: SaveStatus = idleStatus) =>
  events.reduce(nextSaveStatus, from);

describe('nextSaveStatus', () => {
  it('saves then settles', () => {
    expect(run([{ type: 'queued' }, { type: 'drained' }])).toEqual({ kind: 'saved' });
  });

  it('keeps retrying visible while more writes queue behind it', () => {
    expect(run([{ type: 'queued' }, { type: 'retrying', attempt: 1 }, { type: 'queued' }])).toEqual(
      { kind: 'retrying', attempt: 1, of: 3 },
    );
  });

  it('returns to saving when a retry lands', () => {
    const retrying = run([{ type: 'queued' }, { type: 'retrying', attempt: 2 }]);
    expect(run([{ type: 'recovered' }], retrying)).toEqual({ kind: 'saving' });
  });

  it('stays failed when the dropped queue drains', () => {
    expect(
      run([{ type: 'queued' }, { type: 'gave-up', reverted: true }, { type: 'drained' }]),
    ).toEqual({ kind: 'failed', reverted: true });
  });

  it('leaves failed on the next write', () => {
    expect(run([{ type: 'queued' }], { kind: 'failed', reverted: false })).toEqual({
      kind: 'saving',
    });
  });
});
