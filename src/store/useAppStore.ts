import { useEffect, useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  CategoryRule,
  ChartMode,
  FilterState,
  RawStatementRow,
  SortKey,
  SortState,
} from '@/lib/types';
import { OTHER_ID } from '@/lib/types';
import { CsvFormatError, mergeRows, parseStatementCsv } from '@/lib/csv';
import { defaultRules } from '@/lib/defaultRules';

export interface UploadResult {
  ok: string[];
  errors: { file: string; message: string }[];
}

export const emptyFilters: FilterState = {
  search: '',
  person: null,
  amountMin: null,
  amountMax: null,
  categoryIds: new Set<string>(),
  showCredits: false,
};

export interface AppState {
  rawRows: RawStatementRow[];
  rules: CategoryRule[];
  overrides: Record<string, string>;
  filters: FilterState;
  chartMode: ChartMode;
  sort: SortState;
  selectedIds: Set<string>;

  uploadFiles: (files: File[]) => Promise<UploadResult>;
  addRule: (rule: CategoryRule) => void;
  setRule: (id: string, patch: Partial<Omit<CategoryRule, 'id'>>) => void;
  deleteRule: (id: string) => void;
  reorderRules: (id: string, direction: -1 | 1) => void;
  setOverride: (ids: string[], categoryId: string) => void;
  setFilter: (patch: Partial<FilterState>) => void;
  toggleCategoryFilter: (id: string) => void;
  setChartMode: (mode: ChartMode) => void;
  setSort: (key: SortKey) => void;
  toggleSelected: (id: string) => void;
  selectAll: (ids: string[], selected: boolean) => void;
  clearSelection: () => void;
  resetAll: () => void;
}

const initialState = {
  rawRows: [] as RawStatementRow[],
  rules: defaultRules,
  overrides: {} as Record<string, string>,
  filters: emptyFilters,
  chartMode: 'donut' as ChartMode,
  sort: { key: 'date', dir: -1 } as SortState,
  selectedIds: new Set<string>(),
};

type PersistedState = Pick<
  AppState,
  'rawRows' | 'rules' | 'overrides' | 'filters' | 'chartMode' | 'sort'
>;

type SerializedState = Omit<PersistedState, 'filters'> & {
  filters: Omit<FilterState, 'categoryIds'> & { categoryIds: string[] };
};

const noopStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const storage = createJSONStorage<PersistedState>(
  () => (typeof window === 'undefined' ? noopStorage : window.sessionStorage),
  { replacer: (_key, value) => (value instanceof Set ? [...value] : value) },
);

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialState,

      uploadFiles: async (files) => {
        const result: UploadResult = { ok: [], errors: [] };
        let rows = get().rawRows;
        for (const file of files) {
          try {
            const text = await file.text();
            const parsed = parseStatementCsv(text);
            if (!parsed.length) throw new CsvFormatError('No transactions found in this file.');
            rows = mergeRows(rows, parsed);
            result.ok.push(file.name);
          } catch (err) {
            result.errors.push({
              file: file.name,
              message: err instanceof Error ? err.message : 'Could not read this file.',
            });
          }
        }
        if (result.ok.length) set({ rawRows: rows });
        return result;
      },

      addRule: (rule) =>
        set((s) => ({
          // builtin fallbacks stay pinned to the bottom so a new rule can actually match
          rules: [...s.rules.filter((r) => !r.builtin), rule, ...s.rules.filter((r) => r.builtin)],
        })),

      setRule: (id, patch) =>
        set((s) => ({ rules: s.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),

      deleteRule: (id) =>
        set((s) =>
          s.rules.find((r) => r.id === id)?.builtin
            ? s
            : {
                rules: s.rules.filter((r) => r.id !== id),
                filters: s.filters.categoryIds.has(id)
                  ? {
                      ...s.filters,
                      categoryIds: new Set(
                        [...s.filters.categoryIds].filter((c) => c !== id),
                      ) as Set<string>,
                    }
                  : s.filters,
              },
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

      setFilter: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),

      toggleCategoryFilter: (id) =>
        set((s) => {
          const categoryIds = new Set(s.filters.categoryIds);
          if (categoryIds.has(id)) categoryIds.delete(id);
          else categoryIds.add(id);
          return { filters: { ...s.filters, categoryIds } };
        }),

      setChartMode: (chartMode) => set({ chartMode }),

      setSort: (key) =>
        set((s) => ({
          sort:
            s.sort.key === key
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
        set({
          ...initialState,
          filters: { ...emptyFilters, categoryIds: new Set<string>() },
          selectedIds: new Set<string>(),
        }),
    }),
    {
      name: 'money-pit',
      storage,
      partialize: (s) => ({
        rawRows: s.rawRows,
        rules: s.rules,
        overrides: s.overrides,
        filters: s.filters,
        chartMode: s.chartMode,
        sort: s.sort,
      }),
      merge: (persisted, current) => {
        const raw = persisted as Partial<SerializedState> | undefined;
        if (!raw) return current;
        return {
          ...current,
          ...raw,
          filters: {
            ...emptyFilters,
            ...raw.filters,
            categoryIds: new Set(raw.filters?.categoryIds ?? []),
          },
        };
      },
      // static export prerenders with empty state; rehydrate after mount instead (see useHydrated)
      skipHydration: true,
    },
  ),
);

/** Gates render until sessionStorage has been read, avoiding an SSG hydration mismatch. */
export function useHydrated(): boolean {
  const hydrated = useSyncExternalStore(
    (onChange) => useAppStore.persist.onFinishHydration(onChange),
    () => useAppStore.persist.hasHydrated(),
    () => false,
  );
  useEffect(() => {
    if (!useAppStore.persist.hasHydrated()) void useAppStore.persist.rehydrate();
  }, []);
  return hydrated;
}

export const OTHER_CATEGORY_ID = OTHER_ID;
