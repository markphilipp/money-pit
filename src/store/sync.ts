import type * as AccountActions from '@/app/actions/account';
import { fromStoredRows, overrideChanges, toStoredRows } from '@/lib/sync';
import { initialState, useAppStore, type AppState } from './useAppStore';

export type AccountApi = Pick<
  typeof AccountActions,
  'appendRows' | 'setOverrides' | 'replaceRules' | 'setPreference' | 'resetAccount' | 'loadSnapshot'
>;

// Server actions cap request bodies at 1 MB; a stored row serializes to roughly 200 bytes.
const APPEND_CHUNK = 2000;

async function applySnapshot(api: AccountApi) {
  const { rows, rules, preference } = await api.loadSnapshot();
  const { rawRows, overrides } = fromStoredRows(rows);
  return {
    mode: 'account',
    rawRows,
    overrides,
    rules,
    chartMode: preference?.chartMode ?? initialState.chartMode,
    sort: preference ? { key: preference.sortKey, dir: preference.sortDir } : initialState.sort,
    selectedIds: new Set<string>(),
  } satisfies Partial<AppState>;
}

/**
 * Loads the account into the store, then mirrors every data change to the server. Store actions
 * stay local and synchronous; this subscriber turns their diffs into idempotent server writes, run
 * one at a time in order. A failed write drops whatever was queued behind it and reloads the
 * snapshot, so the store falls back to what the server actually holds.
 */
export function startAccountSync(api: AccountApi, onError: (message: string) => void) {
  let stopped = false;
  let applying = false;
  let generation = 0;
  let queue = Promise.resolve();
  let pending = 0;
  // Server actions can't outlive the page, so leaving mid-write would silently drop it.
  const warnOnLeave = (event: BeforeUnloadEvent) => event.preventDefault();

  const load = async () => {
    const next = await applySnapshot(api);
    if (stopped) return;
    applying = true;
    useAppStore.setState(next);
    applying = false;
  };

  const enqueue = (write: () => Promise<void>) => {
    const queuedIn = generation;
    if (pending++ === 0) window.addEventListener('beforeunload', warnOnLeave);
    queue = queue.then(async () => {
      try {
        if (stopped || queuedIn !== generation) return;
        await write();
      } catch {
        generation++;
        onError('A change didn’t save to your account, so the dashboard was reloaded from it.');
        await load().catch(() => onError('Couldn’t reach your account. Changes aren’t saving.'));
      } finally {
        if (--pending === 0) window.removeEventListener('beforeunload', warnOnLeave);
      }
    });
  };

  const mirror = (next: AppState, prev: AppState) => {
    if (applying) return;
    if (next.rawRows !== prev.rawRows) {
      // resetAll is the only way rows empty, and it resets every other slice to defaults too.
      if (!next.rawRows.length) return enqueue(() => api.resetAccount());
      const added = toStoredRows(next.rawRows, next.overrides).slice(prev.rawRows.length);
      for (let i = 0; i < added.length; i += APPEND_CHUNK) {
        const chunk = added.slice(i, i + APPEND_CHUNK);
        enqueue(() => api.appendRows(chunk));
      }
    }
    if (next.rules !== prev.rules) enqueue(() => api.replaceRules(next.rules));
    if (next.overrides !== prev.overrides) {
      const changes = overrideChanges(next.rawRows, prev.overrides, next.overrides);
      if (changes.length) enqueue(() => api.setOverrides(changes));
    }
    if (next.chartMode !== prev.chartMode || next.sort !== prev.sort) {
      const { chartMode, sort } = next;
      enqueue(() => api.setPreference({ chartMode, sortKey: sort.key, sortDir: sort.dir }));
    }
  };

  let unsubscribe = () => {};
  const ready = (async () => {
    if (!useAppStore.persist.hasHydrated()) await useAppStore.persist.rehydrate();
    await load();
    if (!stopped) unsubscribe = useAppStore.subscribe(mirror);
  })().catch(() => onError('Couldn’t load your account.'));

  return {
    ready,
    /** Resolves once every write queued so far has settled. */
    settled: () => queue,
    stop: () => {
      stopped = true;
      unsubscribe();
      window.removeEventListener('beforeunload', warnOnLeave);
    },
  };
}
