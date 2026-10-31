import type * as AccountActions from '@/app/actions/account';
import {
  idleStatus,
  nextSaveStatus,
  RETRY_DELAYS_MS,
  type SaveEvent,
  type SaveStatus,
} from '@/lib/saveStatus';
import { fromStoredDatasets, overrideChanges, toStoredDataset } from '@/lib/sync';
import { initialState, useAppStore, type AppState } from './useAppStore';

export type AccountApi = Pick<
  typeof AccountActions,
  | 'createDataset'
  | 'appendDatasetRows'
  | 'removeDataset'
  | 'setOverrides'
  | 'replaceCategories'
  | 'setPreference'
  | 'loadSnapshot'
  | 'claimLocal'
>;

/** Asked when a sign-in lands on a tab holding signed-out statements; resolves true to keep them. */
export type ConfirmClaim = () => Promise<boolean>;

// Server actions cap request bodies at 1 MB; a stored row serializes to roughly 200 bytes.
const APPEND_CHUNK = 2000;

const toViewPreference = ({
  chartMode,
  personChartMode,
  sort,
}: Pick<AppState, 'chartMode' | 'personChartMode' | 'sort'>) => ({
  chartMode,
  personChartMode,
  sortKey: sort.key,
  sortDir: sort.dir,
});

const toPreference = (state: AppState) => ({
  ...toViewPreference(state),
  dismissedSuggestions: state.dismissedSuggestions,
});

async function applySnapshot(api: AccountApi) {
  const { datasets: stored, categories, rules, preference } = await api.loadSnapshot();
  const { datasets, overrides } = fromStoredDatasets(stored);
  return {
    mode: 'account',
    datasets,
    overrides,
    categories,
    rules,
    chartMode: preference?.chartMode ?? initialState.chartMode,
    personChartMode: preference?.personChartMode ?? initialState.personChartMode,
    sort: preference ? { key: preference.sortKey, dir: preference.sortDir } : initialState.sort,
    dismissedSuggestions: preference?.dismissedSuggestions ?? initialState.dismissedSuggestions,
    selectedIds: new Set<string>(),
  } satisfies Partial<AppState>;
}

/**
 * Loads the account into the store, then mirrors every data change to the server. Store actions
 * stay local and synchronous; this subscriber turns their diffs into idempotent server writes, run
 * one at a time in order. A failed write is retried with backoff; once the retries run out it drops
 * whatever was queued behind it and reloads the snapshot, so the store falls back to what the
 * server actually holds. `onStatus` reports the save lifecycle as a `SaveStatus`.
 */
export function startAccountSync(
  api: AccountApi,
  onError: (message: string) => void,
  confirmClaim: ConfirmClaim,
  onStatus: (status: SaveStatus) => void = () => {},
) {
  let stopped = false;
  let applying = false;
  let generation = 0;
  let queue = Promise.resolve();
  let pending = 0;
  let status = idleStatus;
  const dispatch = (event: SaveEvent) => {
    const next = nextSaveStatus(status, event);
    if (next === status) return;
    status = next;
    onStatus(status);
  };
  // Server actions can't outlive the page, so leaving mid-write would silently drop it.
  const warnOnLeave = (event: BeforeUnloadEvent) => event.preventDefault();

  const load = async () => {
    const next = await applySnapshot(api);
    if (stopped) return;
    applying = true;
    useAppStore.setState(next);
    applying = false;
  };

  // Every write is idempotent, so replaying one whose first attempt actually landed is harmless.
  const withRetries = async (write: () => Promise<void>) => {
    for (let retry = 0; ; retry++) {
      try {
        await write();
        if (retry > 0) dispatch({ type: 'recovered' });
        return;
      } catch (error) {
        const delay = RETRY_DELAYS_MS[retry];
        if (delay === undefined || stopped) throw error;
        dispatch({ type: 'retrying', attempt: retry + 1 });
        await new Promise((resolve) => setTimeout(resolve, delay));
        if (stopped) return;
      }
    }
  };

  const enqueue = (write: () => Promise<void>) => {
    const queuedIn = generation;
    if (pending++ === 0) window.addEventListener('beforeunload', warnOnLeave);
    dispatch({ type: 'queued' });
    queue = queue.then(async () => {
      try {
        if (stopped || queuedIn !== generation) return;
        await withRetries(write);
      } catch {
        generation++;
        const reverted = await load().then(
          () => true,
          () => false,
        );
        dispatch({ type: 'gave-up', reverted });
      } finally {
        if (--pending === 0) {
          window.removeEventListener('beforeunload', warnOnLeave);
          dispatch({ type: 'drained' });
        }
      }
    });
  };

  const mirror = (next: AppState, prev: AppState) => {
    if (applying) return;
    if (next.datasets !== prev.datasets) {
      const kept = new Set(next.datasets.map((d) => d.id));
      const known = new Set(prev.datasets.map((d) => d.id));
      for (const { id } of prev.datasets) {
        if (!kept.has(id)) enqueue(() => api.removeDataset(id));
      }
      for (const added of next.datasets.filter((d) => !known.has(d.id))) {
        const { id, name, uploadedAt, rows } = toStoredDataset(added, next.overrides);
        enqueue(() => api.createDataset({ id, name, uploadedAt }));
        for (let i = 0; i < rows.length; i += APPEND_CHUNK) {
          const chunk = rows.slice(i, i + APPEND_CHUNK);
          enqueue(() => api.appendDatasetRows(id, chunk));
        }
      }
    }
    if (next.categories !== prev.categories || next.rules !== prev.rules) {
      const { categories, rules } = next;
      enqueue(() => api.replaceCategories({ categories, rules }));
    }
    if (next.overrides !== prev.overrides) {
      const changes = overrideChanges(next.rawRows, prev.overrides, next.overrides);
      if (changes.length) enqueue(() => api.setOverrides(changes));
    }
    if (
      next.chartMode !== prev.chartMode ||
      next.personChartMode !== prev.personChartMode ||
      next.sort !== prev.sort ||
      next.dismissedSuggestions !== prev.dismissedSuggestions
    ) {
      const preference = toPreference(next);
      enqueue(() => api.setPreference(preference));
    }
  };

  let unsubscribe = () => {};
  // Loading the snapshot switches persistence to account mode, which drops the session's statements
  // from sessionStorage, so any claim has to finish first. A failed claim stops here and leaves
  // them in place for a reload to offer again.
  const claim = async () => {
    const state = useAppStore.getState();
    const { datasets, overrides, categories, rules, dismissedSuggestions } = state;
    if (!datasets.length || !(await confirmClaim()) || stopped) return true;
    // Untouched defaults aren't a choice, so they never overwrite what the account has saved.
    const untouched =
      state.chartMode === initialState.chartMode &&
      state.personChartMode === initialState.personChartMode &&
      state.sort.key === initialState.sort.key &&
      state.sort.dir === initialState.sort.dir;
    try {
      await api.claimLocal(
        datasets.map((d) => toStoredDataset(d, overrides)),
        { categories, rules },
        untouched ? null : toViewPreference(state),
        dismissedSuggestions,
      );
      return true;
    } catch {
      onError('Couldn’t save this session’s statements to your account. Reload to try again.');
      return false;
    }
  };

  const ready = (async () => {
    if (!useAppStore.persist.hasHydrated()) await useAppStore.persist.rehydrate();
    if (!(await claim())) return;
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
