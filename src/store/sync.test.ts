import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultCategories, defaultRules } from '@/lib/defaultRules';
import { toStoredDataset, toStoredRows } from '@/lib/sync';
import { parseStatementCsv } from '@/lib/csv';
import { csvFile, resetStore, SAMPLE_CSV, SECOND_CSV } from '@/test/fixtures';
import { RETRY_DELAYS_MS, type SaveStatus } from '@/lib/saveStatus';
import { startAccountSync, type AccountApi } from './sync';
import { selectTransactions } from './selectors';
import { useAppStore } from './useAppStore';

const state = () => useAppStore.getState();
const accountRows = parseStatementCsv(SAMPLE_CSV);
const accountFile = () =>
  toStoredDataset(
    {
      id: 'account-file',
      name: 'statement.csv',
      uploadedAt: '2026-07-04T00:00:00.000Z',
      rows: accountRows,
    },
    {},
  );

function fakeApi(snapshot?: Partial<Awaited<ReturnType<AccountApi['loadSnapshot']>>>) {
  return {
    createDataset: vi.fn(async () => {}),
    appendDatasetRows: vi.fn(async () => {}),
    removeDataset: vi.fn(async () => {}),
    setOverrides: vi.fn(async () => {}),
    replaceCategories: vi.fn(async () => {}),
    setPreference: vi.fn(async () => {}),
    claimLocal: vi.fn(async () => {}),
    loadSnapshot: vi.fn(async () => ({
      datasets: [],
      categories: defaultCategories,
      rules: defaultRules,
      preference: null,
      ...snapshot,
    })),
  } satisfies AccountApi;
}

const claimArgs = (api: ReturnType<typeof fakeApi>) =>
  api.claimLocal.mock.calls[0] as unknown as Parameters<AccountApi['claimLocal']>;

let sync: ReturnType<typeof startAccountSync> | undefined;
const onError = vi.fn();
const confirmClaim = vi.fn(async () => false);

async function start(api: AccountApi) {
  sync = startAccountSync(api, onError, confirmClaim);
  await sync.ready;
  return sync;
}

beforeEach(async () => {
  await resetStore();
  sessionStorage.clear();
  onError.mockClear();
  confirmClaim.mockClear();
});

afterEach(() => sync?.stop());

describe('startAccountSync', () => {
  it('replaces local state with the account snapshot', async () => {
    await state().uploadFiles([csvFile(SECOND_CSV)]);
    const [first] = toStoredRows(accountRows, {});
    await start(
      fakeApi({
        datasets: [{ ...accountFile(), rows: [{ ...first, categoryOverride: 'pets' }] }],
        preference: {
          chartMode: 'bar',
          personChartMode: 'bar',
          sortKey: 'amount',
          sortDir: 1,
          dismissedSuggestions: ['k1'],
        },
      }),
    );

    expect(state().mode).toBe('account');
    expect(state().rawRows).toEqual([accountRows[0]]);
    expect(selectTransactions(state())[0].categoryId).toBe('pets');
    expect(state().chartMode).toBe('bar');
    expect(state().personChartMode).toBe('bar');
    expect(state().sort).toEqual({ key: 'amount', dir: 1 });
    expect(state().dismissedSuggestions).toEqual(['k1']);
  });

  it('falls back to no dismissals when the account has no preference row', async () => {
    state().dismissSuggestion('stale');
    await start(fakeApi());
    expect(state().dismissedSuggestions).toEqual([]);
  });

  it('does not write the snapshot it just loaded back to the server', async () => {
    const api = fakeApi({ datasets: [accountFile()] });
    await start(api);
    await sync!.settled();
    expect(api.createDataset).not.toHaveBeenCalled();
    expect(api.appendDatasetRows).not.toHaveBeenCalled();
    expect(api.replaceCategories).not.toHaveBeenCalled();
  });

  it('creates an upload as a dataset, then appends its rows numbered within the file', async () => {
    const api = fakeApi({ datasets: [accountFile()] });
    await start(api);
    await state().uploadFiles([csvFile(SECOND_CSV, 'july.csv')]);
    await sync!.settled();

    const added = state().datasets[1];
    expect(api.createDataset).toHaveBeenCalledWith({
      id: added.id,
      name: 'july.csv',
      uploadedAt: added.uploadedAt,
    });
    // the whole file goes, including the row the account already holds: membership, not just new rows
    expect(api.appendDatasetRows).toHaveBeenCalledTimes(1);
    expect(api.appendDatasetRows).toHaveBeenCalledWith(added.id, [
      expect.objectContaining({ description: 'LOWES #01111 BELMONT NC', ordinal: 0 }),
      expect.objectContaining({ description: 'HULU 123-456-7890 CA', ordinal: 0 }),
    ]);
    expect(api.createDataset.mock.invocationCallOrder[0]).toBeLessThan(
      api.appendDatasetRows.mock.invocationCallOrder[0],
    );
  });

  it('sends nothing for a re-upload of a file the account already holds', async () => {
    const api = fakeApi({ datasets: [accountFile()] });
    await start(api);
    await state().uploadFiles([csvFile(SAMPLE_CSV, 'again.csv')]);
    await sync!.settled();
    expect(api.createDataset).not.toHaveBeenCalled();
  });

  it('removes a dataset on the account and leaves categories alone', async () => {
    const api = fakeApi({ datasets: [accountFile()] });
    await start(api);
    state().removeDataset('account-file');
    await sync!.settled();

    expect(api.removeDataset).toHaveBeenCalledWith('account-file');
    expect(api.replaceCategories).not.toHaveBeenCalled();
    expect(api.setOverrides).not.toHaveBeenCalled();
    expect(state().rawRows).toEqual([]);
  });

  it('writes no override change for a row that went away with its dataset', async () => {
    const api = fakeApi({ datasets: [accountFile()] });
    await start(api);
    const [txn] = selectTransactions(state());
    state().setOverride([txn.id], 'pets');
    await sync!.settled();
    api.setOverrides.mockClear();

    state().removeDataset('account-file');
    await sync!.settled();
    expect(api.setOverrides).not.toHaveBeenCalled();
  });

  it('mirrors category, rule, override and preference changes', async () => {
    const api = fakeApi({ datasets: [accountFile()] });
    await start(api);
    const [txn] = selectTransactions(state());

    state().reorderRules('grocery', -1);
    state().setOverride([txn.id], 'pets');
    state().setChartMode('bar');
    state().setPersonChartMode('bar');
    await sync!.settled();

    expect(api.replaceCategories).toHaveBeenCalledWith({
      categories: state().categories,
      rules: state().rules,
    });
    expect(api.setOverrides).toHaveBeenCalledWith([
      expect.objectContaining({ description: txn.description, categoryOverride: 'pets' }),
    ]);
    expect(api.setPreference).toHaveBeenCalledWith({
      chartMode: 'bar',
      personChartMode: 'bar',
      sortKey: 'date',
      sortDir: -1,
      dismissedSuggestions: [],
    });
  });

  it('mirrors a dismissal as a preference write, once', async () => {
    const api = fakeApi({ datasets: [accountFile()] });
    await start(api);
    state().dismissSuggestion('k1');
    state().dismissSuggestion('k1');
    await sync!.settled();

    expect(api.setPreference).toHaveBeenCalledTimes(1);
    expect(api.setPreference).toHaveBeenCalledWith(
      expect.objectContaining({ dismissedSuggestions: ['k1'] }),
    );
  });

  it('turns Start over into per-slice writes with no account reset', async () => {
    const api = fakeApi({ datasets: [accountFile()] });
    await start(api);
    state().setChartMode('bar');
    state().setCategory('home', { name: 'Renovations' });
    state().resetAll();
    await sync!.settled();

    expect(api.removeDataset).toHaveBeenCalledWith('account-file');
    expect(api.replaceCategories).toHaveBeenLastCalledWith({
      categories: defaultCategories,
      rules: defaultRules,
    });
    expect(api.setPreference).toHaveBeenLastCalledWith(
      expect.objectContaining({ chartMode: 'donut' }),
    );
    expect(state().mode).toBe('account');
  });

  describe('save status', () => {
    const statuses = vi.fn<(status: SaveStatus) => void>();
    const kinds = () => statuses.mock.calls.map(([status]) => status.kind);

    async function startWithStatus(api: AccountApi) {
      statuses.mockClear();
      sync = startAccountSync(api, onError, confirmClaim, statuses);
      await sync.ready;
    }

    const drain = async () => {
      const settled = sync!.settled();
      await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS.reduce((a, b) => a + b, 0));
      await settled;
    };

    beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout'] }));
    afterEach(() => vi.useRealTimers());

    it('goes saving then saved for a write that lands', async () => {
      await startWithStatus(fakeApi({ datasets: [accountFile()] }));
      state().setChartMode('bar');
      state().setChartMode('donut');
      await drain();
      expect(kinds()).toEqual(['saving', 'saved']);
    });

    it('stays idle until something is written', async () => {
      await startWithStatus(fakeApi({ datasets: [accountFile()] }));
      await drain();
      expect(statuses).not.toHaveBeenCalled();
    });

    it('retries a failed write and recovers without reloading', async () => {
      const api = fakeApi({ datasets: [accountFile()] });
      api.replaceCategories
        .mockRejectedValueOnce(new Error('offline'))
        .mockRejectedValueOnce(new Error('offline'));
      await startWithStatus(api);
      state().reorderRules('grocery', -1);
      await drain();

      expect(statuses.mock.calls.map(([status]) => status)).toEqual([
        { kind: 'saving' },
        { kind: 'retrying', attempt: 1, of: 3 },
        { kind: 'retrying', attempt: 2, of: 3 },
        { kind: 'saving' },
        { kind: 'saved' },
      ]);
      expect(api.replaceCategories).toHaveBeenCalledTimes(3);
      expect(api.loadSnapshot).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();
    });

    it('backs off between attempts', async () => {
      const api = fakeApi({ datasets: [accountFile()] });
      api.setPreference.mockRejectedValue(new Error('offline'));
      await startWithStatus(api);
      state().setChartMode('bar');
      await vi.advanceTimersByTimeAsync(0);
      expect(api.setPreference).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0] - 1);
      expect(api.setPreference).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(api.setPreference).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[1]);
      expect(api.setPreference).toHaveBeenCalledTimes(3);
    });

    it('gives up, reloads the snapshot and drops queued writes', async () => {
      const api = fakeApi({ datasets: [accountFile()] });
      api.replaceCategories.mockRejectedValue(new Error('boom'));
      await startWithStatus(api);
      state().reorderRules('grocery', -1);
      state().setChartMode('bar');
      await drain();

      expect(api.replaceCategories).toHaveBeenCalledTimes(RETRY_DELAYS_MS.length + 1);
      expect(api.setPreference).not.toHaveBeenCalled();
      expect(api.loadSnapshot).toHaveBeenCalledTimes(2);
      expect(state().rules).toEqual(defaultRules);
      expect(state().chartMode).toBe('donut');
      expect(statuses).toHaveBeenLastCalledWith({ kind: 'failed', reverted: true });
    });

    it('reports failure without a revert when the account is unreachable', async () => {
      const api = fakeApi({ datasets: [accountFile()] });
      api.replaceCategories.mockRejectedValue(new Error('offline'));
      await startWithStatus(api);
      api.loadSnapshot.mockRejectedValue(new Error('offline'));
      state().reorderRules('grocery', -1);
      await drain();
      expect(statuses).toHaveBeenLastCalledWith({ kind: 'failed', reverted: false });
    });

    it('saves again after a failure', async () => {
      const api = fakeApi({ datasets: [accountFile()] });
      api.replaceCategories.mockRejectedValue(new Error('boom'));
      await startWithStatus(api);
      state().reorderRules('grocery', -1);
      await drain();
      state().setChartMode('bar');
      await drain();
      expect(statuses).toHaveBeenLastCalledWith({ kind: 'saved' });
      expect(api.setPreference).toHaveBeenCalledTimes(1);
    });

    it('stops retrying once stopped', async () => {
      const api = fakeApi({ datasets: [accountFile()] });
      api.setPreference.mockRejectedValue(new Error('offline'));
      await startWithStatus(api);
      state().setChartMode('bar');
      await vi.advanceTimersByTimeAsync(0);
      sync!.stop();
      await drain();
      expect(api.setPreference).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps statement data out of sessionStorage', async () => {
    await start(fakeApi({ datasets: [accountFile()] }));
    state().setFilter({ search: 'LOWES' });

    const stored = JSON.parse(sessionStorage.getItem('money-pit')!).state;
    expect(Object.keys(stored).sort()).toEqual(['filters', 'ruleSources']);
  });
});

describe('leaving mid-write', () => {
  it('asks before unloading only while a write is in flight', async () => {
    let finish = () => {};
    const api = fakeApi();
    api.setPreference.mockImplementationOnce(() => new Promise<void>((r) => (finish = r)));
    await start(api);
    const leave = () => window.dispatchEvent(new Event('beforeunload', { cancelable: true }));

    state().setChartMode('bar');
    expect(leave()).toBe(false);

    await vi.waitFor(() => expect(api.setPreference).toHaveBeenCalled());
    finish();
    await sync!.settled();
    expect(leave()).toBe(true);
  });
});

describe('claiming a signed-out session', () => {
  it('asks only when the tab holds statements', async () => {
    await start(fakeApi());
    expect(confirmClaim).not.toHaveBeenCalled();
  });

  it('drops the session when declined', async () => {
    await state().uploadFiles([csvFile(SAMPLE_CSV)]);
    const api = fakeApi();
    await start(api);

    expect(confirmClaim).toHaveBeenCalledTimes(1);
    expect(api.claimLocal).not.toHaveBeenCalled();
    expect(state().rawRows).toEqual([]);
  });

  it('saves datasets, overrides, categories and rules to the account before loading it', async () => {
    await state().uploadFiles([csvFile(SAMPLE_CSV)]);
    const [txn] = selectTransactions(state());
    state().setOverride([txn.id], 'pets');
    state().setCategory('home', { name: 'Renovations' });
    confirmClaim.mockResolvedValueOnce(true);
    const api = fakeApi();
    api.loadSnapshot.mockImplementation(async () => {
      expect(api.claimLocal).toHaveBeenCalled();
      return { datasets: [], categories: defaultCategories, rules: defaultRules, preference: null };
    });
    await start(api);

    const [datasets, categorization, preference] = claimArgs(api);
    expect(datasets.map((d) => d.name)).toEqual(['statement.csv']);
    expect(datasets[0].rows).toHaveLength(7);
    expect(datasets[0].rows.find((r) => r.description === txn.description)?.categoryOverride).toBe(
      'pets',
    );
    expect(categorization.categories.find((c) => c.id === 'home')?.name).toBe('Renovations');
    expect(preference).toBeNull();
    expect(claimArgs(api)[3]).toEqual([]);
  });

  it('claims dismissals even while the chart and sort choices are untouched', async () => {
    await state().uploadFiles([csvFile(SAMPLE_CSV)]);
    state().dismissSuggestion('k1');
    confirmClaim.mockResolvedValueOnce(true);
    const api = fakeApi();
    await start(api);

    expect(claimArgs(api)[2]).toBeNull();
    expect(claimArgs(api)[3]).toEqual(['k1']);
  });

  it('carries a changed chart type and sort order into the account', async () => {
    await state().uploadFiles([csvFile(SAMPLE_CSV)]);
    state().setChartMode('bar');
    state().setPersonChartMode('bar');
    state().setSort('amount');
    confirmClaim.mockResolvedValueOnce(true);
    const api = fakeApi();
    await start(api);

    expect(claimArgs(api)[2]).toEqual({
      chartMode: 'bar',
      personChartMode: 'bar',
      sortKey: 'amount',
      sortDir: state().sort.dir,
    });
    expect(claimArgs(api)[2]).not.toHaveProperty('dismissedSuggestions');
  });

  it('keeps the session in sessionStorage when the claim fails', async () => {
    await state().uploadFiles([csvFile(SAMPLE_CSV)]);
    confirmClaim.mockResolvedValueOnce(true);
    const api = fakeApi();
    api.claimLocal.mockRejectedValueOnce(new Error('offline'));
    await start(api);

    expect(onError).toHaveBeenCalledWith(expect.stringMatching(/Reload to try again/));
    expect(api.loadSnapshot).not.toHaveBeenCalled();
    expect(state().mode).toBe('local');
    expect(JSON.parse(sessionStorage.getItem('money-pit')!).state.datasets).toHaveLength(1);
  });
});
