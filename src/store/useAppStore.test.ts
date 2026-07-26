import { beforeEach, describe, expect, it } from 'vitest';
import { keywordsToGroup } from '@/lib/rules/engine';
import { emptyFilters, useAppStore } from './useAppStore';
import {
  selectCategoryTotals,
  selectFiltered,
  selectPersons,
  selectStats,
  selectTransactions,
  selectVisibleTotal,
  sortTransactions,
} from './selectors';
import { csvFile, resetStore, SAMPLE_CSV, SECOND_CSV, seedStore } from '@/test/fixtures';

const state = () => useAppStore.getState();

beforeEach(() => {
  resetStore();
  sessionStorage.clear();
});

describe('uploadFiles', () => {
  it('parses a file and derives transactions', async () => {
    const result = await state().uploadFiles([csvFile(SAMPLE_CSV)]);
    expect(result).toEqual({ ok: ['statement.csv'], errors: [] });
    expect(selectTransactions(state())).toHaveLength(7);
  });

  it('dedupes overlapping rows across files', async () => {
    await state().uploadFiles([csvFile(SAMPLE_CSV, 'a.csv')]);
    await state().uploadFiles([csvFile(SECOND_CSV, 'b.csv')]);
    expect(state().rawRows).toHaveLength(8);
  });

  it('reports per-file errors without discarding the good files', async () => {
    const result = await state().uploadFiles([
      csvFile('Date,Amount\n07/03/2026,4.99', 'bad.csv'),
      csvFile(SAMPLE_CSV, 'good.csv'),
    ]);
    expect(result.ok).toEqual(['good.csv']);
    expect(result.errors[0].file).toBe('bad.csv');
    expect(result.errors[0].message).toMatch(/Unexpected columns/);
    expect(state().rawRows).toHaveLength(7);
  });
});

describe('filters', () => {
  beforeEach(async () => {
    await seedStore();
  });

  it('hides payments unless showCredits is on', () => {
    expect(selectFiltered(state()).some((t) => t.categoryId === 'payments')).toBe(false);
    state().setFilter({ showCredits: true });
    expect(selectFiltered(state()).some((t) => t.categoryId === 'payments')).toBe(true);
  });

  it('searches descriptions case-insensitively', () => {
    state().setFilter({ search: 'amazon' });
    expect(selectFiltered(state())).toHaveLength(1);
  });

  it('filters by a person checklist', () => {
    state().setColumnFilter('person', { column: 'person', values: ['JAMIE SAMPLE'] });
    expect(selectFiltered(state()).every((t) => t.person === 'JAMIE SAMPLE')).toBe(true);
  });

  it('filters on absolute amount through a column filter', () => {
    state().setFilter({ showCredits: true });
    state().setColumnFilter('amount', { column: 'amount', operator: 'gte', value: 100 });
    const amounts = selectFiltered(state()).map((t) => Math.abs(t.amount));
    expect(amounts.every((a) => a >= 100)).toBe(true);
    expect(amounts).toContain(1500);
  });

  it('filters by description operator and by date', () => {
    state().setColumnFilter('description', {
      column: 'description',
      operator: 'endsWith',
      value: 'NC',
    });
    expect(selectFiltered(state()).length).toBe(3);

    state().setColumnFilter('description', null);
    state().setColumnFilter('date', { column: 'date', operator: 'on', value: '2026-07-01' });
    expect(selectFiltered(state())).toHaveLength(2);
  });

  it('replaces a filter on the same column and clears it with null', () => {
    state().setColumnFilter('amount', { column: 'amount', operator: 'gte', value: 100 });
    state().setColumnFilter('amount', { column: 'amount', operator: 'lt', value: 10 });
    expect(state().filters.columnFilters.amount).toEqual({
      column: 'amount',
      operator: 'lt',
      value: 10,
    });

    state().setColumnFilter('amount', null);
    expect(state().filters.columnFilters).toEqual({});
  });

  it('skips its own dimension when a chart asks it to', () => {
    state().toggleCategoryFilter('amazon');
    expect(selectFiltered(state())).toHaveLength(1);
    expect(selectFiltered(state(), { ignoreCategory: true }).length).toBeGreaterThan(1);

    state().togglePersonFilter('ALEX SAMPLE');
    const ignoringPerson = selectFiltered(state(), { ignorePerson: true, ignoreCategory: true });
    expect(ignoringPerson.some((t) => t.person === 'JAMIE SAMPLE')).toBe(true);
  });

  it('accumulates then drops the category checklist as it is toggled', () => {
    state().toggleCategoryFilter('amazon');
    state().toggleCategoryFilter('pets');
    expect(state().filters.columnFilters.category).toEqual({
      column: 'category',
      values: ['amazon', 'pets'],
    });

    state().toggleCategoryFilter('amazon');
    state().toggleCategoryFilter('pets');
    expect(state().filters.columnFilters.category).toBeUndefined();
  });

  it('totals only the visible rows', () => {
    expect(selectVisibleTotal(selectFiltered(state()))).toBeCloseTo(251.47, 2);
    state().setColumnFilter('category', { column: 'category', values: ['grocery'] });
    expect(selectVisibleTotal(selectFiltered(state()))).toBe(118.37);
  });
});

describe('overrides and rules', () => {
  beforeEach(async () => {
    await seedStore();
  });

  it('applies a bulk override to every selected id', () => {
    const ids = selectTransactions(state())
      .slice(0, 2)
      .map((t) => t.id);
    state().setOverride(ids, 'pets');
    const byId = new Map(selectTransactions(state()).map((t) => [t.id, t]));
    expect(ids.every((id) => byId.get(id)?.categoryId === 'pets')).toBe(true);
  });

  it('hands rows back to the rules when their overrides are cleared', () => {
    const ids = selectTransactions(state())
      .slice(0, 2)
      .map((t) => t.id);
    state().setOverride(ids, 'pets');
    state().clearOverrides(ids);

    expect(state().overrides).toEqual({});
    const byId = new Map(selectTransactions(state()).map((t) => [t.id, t]));
    expect(ids.some((id) => byId.get(id)?.categoryId === 'pets')).toBe(false);
  });

  it('re-categorizes when a rule gains a condition, leaving overrides alone', () => {
    const amazonTxn = selectTransactions(state()).find((t) => t.categoryId === 'amazon')!;
    state().setOverride([amazonTxn.id], 'pets');
    state().setRule('grocery', { conditions: keywordsToGroup(['HARRIS TEETER', 'AMAZON']) });

    const after = selectTransactions(state()).find((t) => t.id === amazonTxn.id)!;
    expect(after.categoryId).toBe('pets');
    expect(state().overrides[amazonTxn.id]).toBe('pets');
  });

  it('drops rows to other when their overridden rule is deleted', () => {
    const txn = selectTransactions(state())[0];
    state().addRule({
      id: 'travel',
      name: 'Travel',
      color: '#111',
      conditions: keywordsToGroup([]),
    });
    state().setOverride([txn.id], 'travel');
    expect(selectTransactions(state())[0].categoryId).toBe('travel');

    state().deleteRule('travel');
    expect(selectTransactions(state())[0].categoryId).toBe('other');
  });

  it('strips a deleted rule from the category checklist', () => {
    state().addRule({
      id: 'travel',
      name: 'Travel',
      color: '#111',
      conditions: keywordsToGroup(['DELTA']),
    });
    state().toggleCategoryFilter('travel');
    state().toggleCategoryFilter('pets');

    state().deleteRule('travel');
    expect(state().filters.columnFilters.category).toEqual({
      column: 'category',
      values: ['pets'],
    });
  });

  it('refuses to delete builtin rules', () => {
    state().deleteRule('payments');
    state().deleteRule('other');
    expect(state().rules.filter((r) => r.builtin)).toHaveLength(2);
  });

  it('reorders rules so an earlier rule wins, keeping builtins last', () => {
    state().addRule({
      id: 'megastore',
      name: 'Megastore',
      color: '#111',
      conditions: keywordsToGroup(['MKTPL']),
    });
    expect(
      selectTransactions(state()).find((t) => t.description.includes('AMAZON'))?.categoryId,
    ).toBe('amazon');

    for (let i = 0; i < 12; i++) state().reorderRules('megastore', -1);
    expect(state().rules[0].id).toBe('megastore');
    expect(state().rules.at(-1)?.id).toBe('other');
    expect(
      selectTransactions(state()).find((t) => t.description.includes('AMAZON'))?.categoryId,
    ).toBe('megastore');
  });
});

describe('selection and sorting', () => {
  beforeEach(async () => {
    await seedStore();
  });

  it('toggles, bulk-selects and clears', () => {
    const ids = selectFiltered(state()).map((t) => t.id);
    state().toggleSelected(ids[0]);
    expect(state().selectedIds.has(ids[0])).toBe(true);
    state().selectAll(ids, true);
    expect(state().selectedIds.size).toBe(ids.length);
    state().selectAll(ids, false);
    expect(state().selectedIds.size).toBe(0);

    state().toggleSelected(ids[0]);
    state().clearSelection();
    expect(state().selectedIds.size).toBe(0);
  });

  it('opens and closes the rule editor without persisting it', () => {
    const ids = selectFiltered(state())
      .slice(0, 2)
      .map((t) => t.id);
    state().openRuleEditor(ids);
    expect(state().ruleEditor).toEqual({ sourceIds: ids });
    expect(sessionStorage.getItem('money-pit')).not.toContain('ruleEditor');

    state().closeRuleEditor();
    expect(state().ruleEditor).toBeNull();
  });

  it('flips direction when the same column is clicked twice', () => {
    expect(state().sort).toEqual({ key: 'date', dir: -1 });
    state().setSort('date');
    expect(state().sort).toEqual({ key: 'date', dir: 1 });
    state().setSort('description');
    expect(state().sort).toEqual({ key: 'description', dir: 1 });
    state().setSort('amount');
    expect(state().sort).toEqual({ key: 'amount', dir: -1 });
  });

  it('honours an explicit direction without toggling', () => {
    state().setSort('amount', 1);
    expect(state().sort).toEqual({ key: 'amount', dir: 1 });
    state().setSort('amount', 1);
    expect(state().sort).toEqual({ key: 'amount', dir: 1 });
    state().setSort('amount', -1);
    expect(state().sort).toEqual({ key: 'amount', dir: -1 });
  });

  it('sorts by the requested key', () => {
    const rows = selectFiltered(state());
    const byAmount = sortTransactions(rows, { key: 'amount', dir: -1 }, state().rules);
    expect(byAmount[0].amount).toBe(118.37);
    const byDesc = sortTransactions(rows, { key: 'description', dir: 1 }, state().rules);
    expect(byDesc[0].description).toContain('AMAZON');
  });
});

describe('aggregates', () => {
  beforeEach(async () => {
    await seedStore();
  });

  it('excludes payments from totals and stats', () => {
    const filtered = selectFiltered(state());
    const totals = selectCategoryTotals(filtered, state().rules);
    expect(totals.map((t) => t.id)).not.toContain('payments');
    expect(totals[0]).toMatchObject({ id: 'grocery', total: 118.37 });

    const stats = selectStats(filtered, state().rules);
    expect(stats.count).toBe(6);
    expect(stats.purchases).toBeCloseTo(253.62, 2);
    expect(stats.refunds).toBeCloseTo(-2.15, 2);
    expect(stats.net).toBeCloseTo(251.47, 2);
    expect(stats.topCategory).toBe('Groceries');
  });

  it('pins a color per cardholder in insertion order', () => {
    expect(selectPersons(state())).toEqual([
      { name: 'ALEX SAMPLE', color: '#E8641B' },
      { name: 'JAMIE SAMPLE', color: '#1F6F8B' },
    ]);
  });
});

describe('session persistence', () => {
  it('round-trips rows, overrides, chart mode and column filters', async () => {
    await seedStore();
    const txn = selectTransactions(state())[0];
    state().setOverride([txn.id], 'pets');
    state().setChartMode('bar');
    state().toggleCategoryFilter('amazon');

    const stored = sessionStorage.getItem('money-pit');
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!).state.filters.columnFilters.category).toEqual({
      column: 'category',
      values: ['amazon'],
    });

    useAppStore.setState({ rawRows: [], overrides: {}, chartMode: 'donut', filters: emptyFilters });
    sessionStorage.setItem('money-pit', stored!); // the setState above re-persisted the blank state
    await useAppStore.persist.rehydrate();

    expect(state().chartMode).toBe('bar');
    expect(state().filters.columnFilters.category).toEqual({
      column: 'category',
      values: ['amazon'],
    });
    expect(selectTransactions(state())[0].categoryId).toBe('pets');
  });

  it('resetAll clears data back to the empty state', async () => {
    await seedStore();
    state().resetAll();
    expect(state().rawRows).toHaveLength(0);
    expect(state().overrides).toEqual({});
    expect(state().filters.columnFilters).toEqual({});
    expect(state().rules).toHaveLength(12);
  });
});
