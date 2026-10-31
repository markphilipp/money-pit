import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import { create, type StateCreator, type StoreMutatorIdentifier } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  Categorization,
  Category,
  ChartMode,
  Dataset,
  FilterState,
  RawStatementRow,
  Rule,
  SortKey,
  SortState,
} from '@/lib/types';
import { OTHER_ID } from '@/lib/types';
import type { ColumnFilter, ColumnId } from '@/lib/rules/types';
import { CsvFormatError, parseStatementCsv } from '@/lib/csv';
import { addDataset, mergeDatasets, removeDataset as dropDataset } from '@/lib/datasets';
import { defaultCategories, defaultRules } from '@/lib/defaultRules';
import { removeCategory, upgradeLegacyRules, type LegacyRule } from '@/lib/categories';
import { checklistValues } from '@/lib/rules/engine';
import { MAX_DISMISSED } from '@/lib/rules/discover';

export interface UploadResult {
  ok: string[];
  errors: { file: string; message: string }[];
}

export const emptyFilters: FilterState = {
  search: '',
  showCredits: false,
  columnFilters: {},
};

/** `account` once a signed-in snapshot has replaced local state; the server then owns the data. */
export type StoreMode = 'local' | 'account';

export interface AppState {
  mode: StoreMode;
  /** What was uploaded, one entry per file. The persisted source of truth for statement rows. */
  datasets: Dataset[];
  /** Derived from `datasets` on every change to them, never set directly; see `deriveRawRows`. */
  rawRows: RawStatementRow[];
  categories: Category[];
  rules: Rule[];
  overrides: Record<string, string>;
  filters: FilterState;
  chartMode: ChartMode;
  personChartMode: ChartMode;
  sort: SortState;
  selectedIds: Set<string>;
  /** Seeds `/rules/new`; persisted so the route survives a reload rather than losing its subject. */
  ruleSources: string[];
  /** Keys of rule proposals the user turned down (see `discoverProposals`); the proposals themselves are derived. */
  dismissedSuggestions: string[];

  uploadFiles: (files: File[]) => Promise<UploadResult>;
  removeDataset: (id: string) => void;
  addCategory: (category: Category) => void;
  setCategory: (id: string, patch: Partial<Pick<Category, 'name' | 'color'>>) => void;
  deleteCategory: (id: string) => void;
  addRule: (rule: Rule) => void;
  setRule: (id: string, patch: Partial<Pick<Rule, 'categoryId' | 'conditions'>>) => void;
  deleteRule: (id: string) => void;
  reorderRules: (id: string, direction: -1 | 1) => void;
  setOverride: (ids: string[], categoryId: string) => void;
  clearOverrides: (ids: string[]) => void;
  setRuleSources: (ids: string[]) => void;
  dismissSuggestion: (key: string) => void;
  setFilter: (patch: Partial<FilterState>) => void;
  setColumnFilter: (column: ColumnId, filter: ColumnFilter | null) => void;
  toggleCategoryFilter: (id: string) => void;
  togglePersonFilter: (person: string) => void;
  setChartMode: (mode: ChartMode) => void;
  setPersonChartMode: (mode: ChartMode) => void;
  setSort: (key: SortKey, dir?: 1 | -1) => void;
  toggleSelected: (id: string) => void;
  selectAll: (ids: string[], selected: boolean) => void;
  clearSelection: () => void;
  resetAll: () => void;
}

export const initialState = {
  mode: 'local' as StoreMode,
  datasets: [] as Dataset[],
  rawRows: [] as RawStatementRow[],
  categories: defaultCategories,
  rules: defaultRules,
  overrides: {} as Record<string, string>,
  filters: emptyFilters,
  chartMode: 'donut' as ChartMode,
  personChartMode: 'donut' as ChartMode,
  sort: { key: 'date', dir: -1 } as SortState,
  selectedIds: new Set<string>(),
  ruleSources: [] as string[],
  dismissedSuggestions: [] as string[],
};

/**
 * Categories and rules persist under `categorization`, not `rules`: a tab saved before the split
 * holds its rules under `rules`, and code from before the split would misread the new shape there.
 */
interface PersistedState extends Pick<
  AppState,
  | 'datasets'
  | 'overrides'
  | 'filters'
  | 'chartMode'
  | 'personChartMode'
  | 'sort'
  | 'ruleSources'
  | 'dismissedSuggestions'
> {
  categorization: Categorization;
  /** A tab saved before datasets held its statements as one flat list. */
  rawRows?: RawStatementRow[];
  rules?: LegacyRule[];
}

/** Statements saved before datasets existed have no file boundaries left to recover. */
const legacyDataset = (rows: RawStatementRow[]): Dataset => ({
  id: crypto.randomUUID(),
  name: 'Earlier uploads',
  uploadedAt: new Date().toISOString(),
  rows,
});

const noopStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const storage = createJSONStorage<Partial<PersistedState>>(() =>
  typeof window === 'undefined' ? noopStorage : window.sessionStorage,
);

/** Checklist filters drop out entirely once empty so `columnFilters` stays a set of live filters. */
function withChecklist(
  filters: FilterState,
  column: 'category' | 'person',
  values: string[],
): FilterState {
  const columnFilters = { ...filters.columnFilters };
  if (values.length) columnFilters[column] = { column, values };
  else delete columnFilters[column];
  return { ...filters, columnFilters };
}

const currentChecklist = (filters: FilterState, column: 'category' | 'person') =>
  checklistValues(filters.columnFilters, column);

/**
 * Keeps `rawRows` equal to `mergeDatasets(datasets)` however `datasets` changes: an action, a
 * hydration, or a `setState` from the sync layer. Wrapping `set` (and `api.setState`, which
 * `persist` and external callers use) means no writer can leave the two out of step. `rawRows`
 * keeps its identity while `datasets` does, which the transaction selector's cache relies on.
 */
function deriveRawRows<
  S extends Pick<AppState, 'datasets' | 'rawRows'>,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(init: StateCreator<S, Mps, Mcs>): StateCreator<S, Mps, Mcs> {
  return (set, get, api) => {
    const derived = ((partial: unknown, replace?: boolean) =>
      set(
        ((state: S) => {
          const patch = typeof partial === 'function' ? partial(state) : partial;
          if (!patch || patch === state || !('datasets' in patch)) return patch;
          if (patch.datasets === state.datasets) return patch;
          return { ...patch, rawRows: mergeDatasets(patch.datasets) };
        }) as never,
        replace as never,
      )) as typeof set;
    api.setState = derived as typeof api.setState;
    return init(derived, get, api);
  };
}

export const useAppStore = create<AppState>()(
  deriveRawRows(
    persist(
      (set, get) => ({
        ...initialState,

        uploadFiles: async (files) => {
          const result: UploadResult = { ok: [], errors: [] };
          const before = get().datasets;
          let datasets = before;
          for (const file of files) {
            try {
              const text = await file.text();
              const rows = parseStatementCsv(text);
              if (!rows.length) throw new CsvFormatError('No transactions found in this file.');
              datasets = addDataset(datasets, {
                id: crypto.randomUUID(),
                name: file.name,
                uploadedAt: new Date().toISOString(),
                rows,
              });
              result.ok.push(file.name);
            } catch (err) {
              result.errors.push({
                file: file.name,
                message: err instanceof Error ? err.message : 'Could not read this file.',
              });
            }
          }
          if (datasets !== before) set({ datasets });
          return result;
        },

        removeDataset: (id) =>
          set((s) => {
            const next = dropDataset(s, id);
            if (next === s) return s;
            // Datasets and their persons can both vanish; a filter or selection on one would otherwise
            // outlive every row it could match.
            const persons = new Set(mergeDatasets(next.datasets).map((r) => r.person));
            return {
              ...next,
              selectedIds: new Set<string>(),
              filters: withChecklist(
                s.filters,
                'person',
                currentChecklist(s.filters, 'person').filter((p) => persons.has(p)),
              ),
            };
          }),

        addCategory: (category) =>
          set((s) => ({
            categories: [
              ...s.categories.filter((c) => !c.builtin),
              category,
              ...s.categories.filter((c) => c.builtin),
            ],
          })),

        setCategory: (id, patch) =>
          set((s) => ({
            categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
          })),

        deleteCategory: (id) =>
          set((s) => {
            const next = removeCategory(s, id);
            if (next === s) return s;
            return {
              categories: next.categories,
              rules: next.rules,
              overrides: next.overrides,
              filters: withChecklist(
                s.filters,
                'category',
                currentChecklist(s.filters, 'category').filter((c) => c !== id),
              ),
            };
          }),

        addRule: (rule) =>
          set((s) => ({
            // the builtin payments rule stays pinned to the bottom so user rules get first look
            rules: [
              ...s.rules.filter((r) => !r.builtin),
              rule,
              ...s.rules.filter((r) => r.builtin),
            ],
          })),

        setRule: (id, patch) =>
          set((s) => ({ rules: s.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),

        deleteRule: (id) =>
          set((s) =>
            s.rules.find((r) => r.id === id)?.builtin
              ? s
              : { rules: s.rules.filter((r) => r.id !== id) },
          ),

        reorderRules: (id, direction) =>
          set((s) => {
            const movable = s.rules.filter((r) => !r.builtin);
            const builtins = s.rules.filter((r) => r.builtin);
            const from = movable.findIndex((r) => r.id === id);
            const to = from + direction;
            if (from < 0 || to < 0 || to >= movable.length) return s;
            const next = [...movable];
            [next[from], next[to]] = [next[to], next[from]];
            return { rules: [...next, ...builtins] };
          }),

        setOverride: (ids, categoryId) =>
          set((s) => {
            const overrides = { ...s.overrides };
            for (const id of ids) overrides[id] = categoryId;
            return { overrides };
          }),

        clearOverrides: (ids) =>
          set((s) => {
            const overrides = { ...s.overrides };
            for (const id of ids) delete overrides[id];
            return { overrides };
          }),

        setRuleSources: (ids) => set({ ruleSources: ids }),

        dismissSuggestion: (key) =>
          set((s) =>
            s.dismissedSuggestions.includes(key)
              ? s
              : { dismissedSuggestions: [...s.dismissedSuggestions, key].slice(-MAX_DISMISSED) },
          ),

        setFilter: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),

        setColumnFilter: (column, filter) =>
          set((s) => {
            const columnFilters = { ...s.filters.columnFilters };
            if (filter) columnFilters[column] = filter;
            else delete columnFilters[column];
            return { filters: { ...s.filters, columnFilters } };
          }),

        toggleCategoryFilter: (id) =>
          set((s) => {
            const values = currentChecklist(s.filters, 'category');
            return {
              filters: withChecklist(
                s.filters,
                'category',
                values.includes(id) ? values.filter((c) => c !== id) : [...values, id],
              ),
            };
          }),

        togglePersonFilter: (person) =>
          set((s) => {
            const values = currentChecklist(s.filters, 'person');
            return {
              filters: withChecklist(
                s.filters,
                'person',
                values.includes(person) ? values.filter((p) => p !== person) : [...values, person],
              ),
            };
          }),

        setChartMode: (chartMode) => set({ chartMode }),

        setPersonChartMode: (personChartMode) => set({ personChartMode }),

        setSort: (key, dir) =>
          set((s) => ({
            sort: dir
              ? { key, dir }
              : s.sort.key === key
                ? { key, dir: (s.sort.dir * -1) as 1 | -1 }
                : { key, dir: key === 'date' || key === 'amount' ? -1 : 1 },
          })),

        toggleSelected: (id) =>
          set((s) => {
            const selectedIds = new Set(s.selectedIds);
            if (selectedIds.has(id)) selectedIds.delete(id);
            else selectedIds.add(id);
            return { selectedIds };
          }),

        selectAll: (ids, selected) =>
          set((s) => {
            const selectedIds = new Set(s.selectedIds);
            for (const id of ids) {
              if (selected) selectedIds.add(id);
              else selectedIds.delete(id);
            }
            return { selectedIds };
          }),

        clearSelection: () => set({ selectedIds: new Set<string>() }),

        resetAll: () =>
          set((s) => ({
            ...initialState,
            mode: s.mode,
            selectedIds: new Set<string>(),
            ruleSources: [],
          })),
      }),
      {
        name: 'money-pit',
        storage,
        // Signed in, statement data lives in the account; only view state stays in the tab.
        partialize: (s): Partial<PersistedState> =>
          s.mode === 'account'
            ? { filters: s.filters, ruleSources: s.ruleSources }
            : {
                datasets: s.datasets,
                categorization: { categories: s.categories, rules: s.rules },
                overrides: s.overrides,
                filters: s.filters,
                chartMode: s.chartMode,
                personChartMode: s.personChartMode,
                sort: s.sort,
                ruleSources: s.ruleSources,
                dismissedSuggestions: s.dismissedSuggestions,
              },
        merge: (persisted, current) => {
          const raw = persisted as Partial<PersistedState> | undefined;
          if (!raw) return current;
          const { categorization, rules, rawRows, ...rest } = raw;
          return {
            ...current,
            ...rest,
            ...(!rest.datasets && rawRows?.length && { datasets: [legacyDataset(rawRows)] }),
            ...(categorization ?? (rules && upgradeLegacyRules(rules))),
            filters: { ...emptyFilters, ...raw.filters },
          };
        },
        // the server renders with empty state — sessionStorage only exists on the client, so
        // rehydrate after mount instead (see useHydrated)
        skipHydration: true,
      },
    ),
  ),
);

/** Set from the server-rendered session, so the very first client render already knows to wait. */
export const SignedInContext = createContext(false);

/**
 * Gates render until sessionStorage has been read, avoiding a hydration mismatch, and, when signed
 * in, until the account snapshot has replaced local state.
 */
export function useHydrated(): boolean {
  const signedIn = useContext(SignedInContext);
  const hydrated = useSyncExternalStore(
    (onChange) => useAppStore.persist.onFinishHydration(onChange),
    () => useAppStore.persist.hasHydrated(),
    () => false,
  );
  const synced = useAppStore((s) => s.mode === 'account');
  useEffect(() => {
    if (!useAppStore.persist.hasHydrated()) void useAppStore.persist.rehydrate();
  }, []);
  return hydrated && (!signedIn || synced);
}

export const OTHER_CATEGORY_ID = OTHER_ID;
