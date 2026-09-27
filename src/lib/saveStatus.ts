/** Waits before each retry of a failed account write; its length is the retry budget. */
export const RETRY_DELAYS_MS = [1000, 2000, 4000] as const;

export type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'retrying'; attempt: number; of: number }
  | { kind: 'failed'; reverted: boolean };

export type SaveEvent =
  | { type: 'queued' }
  | { type: 'retrying'; attempt: number }
  | { type: 'recovered' }
  | { type: 'drained' }
  | { type: 'gave-up'; reverted: boolean };

export const idleStatus: SaveStatus = { kind: 'idle' };

export function nextSaveStatus(status: SaveStatus, event: SaveEvent): SaveStatus {
  switch (event.type) {
    case 'queued':
      return status.kind === 'retrying' || status.kind === 'saving' ? status : { kind: 'saving' };
    case 'retrying':
      return { kind: 'retrying', attempt: event.attempt, of: RETRY_DELAYS_MS.length };
    case 'recovered':
      return status.kind === 'retrying' ? { kind: 'saving' } : status;
    case 'drained':
      return status.kind === 'saving' ? { kind: 'saved' } : status;
    case 'gave-up':
      return { kind: 'failed', reverted: event.reverted };
  }
}
