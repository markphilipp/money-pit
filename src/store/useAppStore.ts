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
import type { ColumnFilter, ColumnId } from '@/lib/rules/types';
import { CsvFormatError, mergeRows, parseStatementCsv } from '@/lib/csv';
import { defaultRules } from '@/lib/defaultRules';
import { checklistValues } from '@/lib/rules/engine';

export interface UploadResult {
  ok: string[];
  errors: { file: string; message: string }[];
}

export const emptyFilters: FilterState = {
  search: '',
  showCredits: false,
  columnFilters: {},
};

/** The transactions a new rule is being induced from; `null` while the dashboard is showing. */
export interface RuleEditorState {
  sourceIds: string[];
}

export interface AppState {
  rawRows: RawStatementRow[];
  rules: CategoryRule[];
  overrides: Record<string, string>;
  filters: FilterState;
  chartMode: ChartMode;
  sort: SortState;
  selectedIds: Set<string>;
  ruleEditor: RuleEditorState | null;

  uploadFiles: (files: File[]) => Promise<UploadResult>;
  addRule: (rule: CategoryRule) => void;
  setRule: (id: string, patch: Partial<Omit<CategoryRule, 'id'>>) => void;
  deleteRule: (id: string) => void;
  reorderRules: (id: string, direction: -1 | 1) => void;
  setOverride: (ids: string[], categoryId: string) => void;
  clearOverrides: (ids: string[]) => void;
  openRuleEditor: (sourceIds: string[]) => void;
  closeRuleEditor: () => void;
  setFilter: (patch: Partial<FilterState>) => void;
  setColumnFilter: (column: ColumnId, filter: ColumnFilter | null) => void;
  toggleCategoryFilter: (id: string) => void;
  togglePersonFilter: (person: string) => void;
  setChartMode: (mode: ChartMode) => void;
  setSort: (key: SortKey, dir?: 1 | -1) => void;
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
  ruleEditor: null as RuleEditorState | null,
};

type PersistedState = Pick<
  AppState,
  'rawRows' | 'rules' | 'overrides' | 'filters' | 'chartMode' | 'sort'
>;

const noopStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const storage = createJSONStorage<PersistedState>(() =>
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
                filters: withChecklist(
                  s.filters,
                  'category',
                  currentChecklist(s.filters, 'category').filter((c) => c !== id),
                ),
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

      clearOverrides: (ids) =>
        set((s) => {
          const overrides = { ...s.overrides };
          for (const id of ids) delete overrides[id];
          return { overrides };
        }),

      openRuleEditor: (sourceIds) => set({ ruleEditor: { sourceIds } }),

      closeRuleEditor: () => set({ ruleEditor: null }),

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

      resetAll: () => set({ ...initialState, selectedIds: new Set<string>(), ruleEditor: null }),
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
        const raw = persisted as Partial<PersistedState> | undefined;
        if (!raw) return current;
        return {
          ...current,
          ...raw,
          filters: { ...emptyFilters, ...raw.filters },
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
