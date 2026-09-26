import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultRules } from '@/lib/defaultRules';
import { toStoredRows } from '@/lib/sync';
import { parseStatementCsv } from '@/lib/csv';
import { csvFile, resetStore, SAMPLE_CSV, SECOND_CSV } from '@/test/fixtures';
import { startAccountSync, type AccountApi } from './sync';
import { selectTransactions } from './selectors';
import { useAppStore } from './useAppStore';

const state = () => useAppStore.getState();
const accountRows = parseStatementCsv(SAMPLE_CSV);

function fakeApi(snapshot?: Partial<Awaited<ReturnType<AccountApi['loadSnapshot']>>>) {
  return {
    appendRows: vi.fn(async () => {}),
    setOverrides: vi.fn(async () => {}),
    replaceRules: vi.fn(async () => {}),
    setPreference: vi.fn(async () => {}),
    resetAccount: vi.fn(async () => {}),
    loadSnapshot: vi.fn(async () => ({
      rows: [],
      rules: defaultRules,
      preference: null,
      ...snapshot,
    })),
  } satisfies AccountApi;
}

let sync: ReturnType<typeof startAccountSync> | undefined;
const onError = vi.fn();

async function start(api: AccountApi) {
  sync = startAccountSync(api, onError);
  await sync.ready;
  return sync;
}

beforeEach(async () => {
  await resetStore();
  sessionStorage.clear();
  onError.mockClear();
});

afterEach(() => sync?.stop());

describe('startAccountSync', () => {
  it('replaces local state with the account snapshot', async () => {
    await state().uploadFiles([csvFile(SECOND_CSV)]);
    const [first] = toStoredRows(accountRows, {});
    await start(
      fakeApi({
        rows: [{ ...first, categoryOverride: 'pets' }],
        preference: { chartMode: 'bar', sortKey: 'amount', sortDir: 1 },
      }),
    );

    expect(state().mode).toBe('account');
    expect(state().rawRows).toEqual([accountRows[0]]);
    expect(selectTransactions(state())[0].categoryId).toBe('pets');
    expect(state().chartMode).toBe('bar');
    expect(state().sort).toEqual({ key: 'amount', dir: 1 });
  });

  it('does not write the snapshot it just loaded back to the server', async () => {
    const api = fakeApi({ rows: toStoredRows(accountRows, {}) });
    await start(api);
    await sync!.settled();
    expect(api.appendRows).not.toHaveBeenCalled();
    expect(api.replaceRules).not.toHaveBeenCalled();
  });

  it('appends only the rows an upload added, with their ordinals', async () => {
    const api = fakeApi({ rows: toStoredRows(accountRows, {}) });
    await start(api);
    await state().uploadFiles([csvFile(SECOND_CSV)]);
    await sync!.settled();

    expect(api.appendRows).toHaveBeenCalledTimes(1);
    expect(api.appendRows).toHaveBeenCalledWith([
      expect.objectContaining({ description: 'HULU 123-456-7890 CA', ordinal: 0 }),
    ]);
  });

  it('mirrors rule, override and preference changes', async () => {
    const api = fakeApi({ rows: toStoredRows(accountRows, {}) });
    await start(api);
    const [txn] = selectTransactions(state());

    state().reorderRules('grocery', -1);
    state().setOverride([txn.id], 'pets');
    state().setChartMode('bar');
    await sync!.settled();

    expect(api.replaceRules).toHaveBeenCalledWith(state().rules);
    expect(api.setOverrides).toHaveBeenCalledWith([
      expect.objectContaining({ description: txn.description, categoryOverride: 'pets' }),
    ]);
    expect(api.setPreference).toHaveBeenCalledWith({
      chartMode: 'bar',
      sortKey: 'date',
      sortDir: -1,
    });
  });

  it('turns Start over into a single account reset', async () => {
    const api = fakeApi({ rows: toStoredRows(accountRows, {}) });
    await start(api);
    state().setChartMode('bar');
    state().resetAll();
    await sync!.settled();

    expect(api.resetAccount).toHaveBeenCalledTimes(1);
    expect(api.replaceRules).not.toHaveBeenCalled();
    expect(state().mode).toBe('account');
  });

  it('reloads the snapshot and drops queued writes when one fails', async () => {
    const api = fakeApi({ rows: toStoredRows(accountRows, {}) });
    api.replaceRules.mockRejectedValueOnce(new Error('boom'));
    await start(api);

    state().reorderRules('grocery', -1);
    state().setChartMode('bar');
    await sync!.settled();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(api.setPreference).not.toHaveBeenCalled();
    expect(api.loadSnapshot).toHaveBeenCalledTimes(2);
    expect(state().rules).toEqual(defaultRules);
    expect(state().chartMode).toBe('donut');
  });

  it('keeps statement data out of sessionStorage', async () => {
    await start(fakeApi({ rows: toStoredRows(accountRows, {}) }));
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
