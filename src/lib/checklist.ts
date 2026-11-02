import type { ColumnFilter, ColumnId } from './rules/types';

export type ChecklistColumn = 'person' | 'category';

/** `exclude` omitted means include, so filters saved before exclusion existed keep their meaning. */
export type Checklist = { values: string[]; exclude?: boolean };

/** Filters are typed as the whole union, so narrow checklists here. */
export function checklistOf(filter: ColumnFilter | null | undefined): Checklist {
  if (!filter || !('values' in filter)) return { values: [] };
  return filter.exclude ? { values: filter.values, exclude: true } : { values: filter.values };
}

export function readChecklist(
  columnFilters: Partial<Record<ColumnId, ColumnFilter>>,
  column: ChecklistColumn,
): Checklist {
  return checklistOf(columnFilters[column]);
}

/** An empty list is no filter at all, so it matches everything in either mode. */
export function checklistIncludes(list: Checklist, value: string): boolean {
  if (list.values.length === 0) return true;
  return list.values.includes(value) !== !!list.exclude;
}

/** Empty lists return null: a checklist with nothing in it must not linger as a live filter. */
export function toColumnFilter(column: ChecklistColumn, list: Checklist): ColumnFilter | null {
  if (list.values.length === 0) return null;
  return list.exclude
    ? { column, values: list.values, exclude: true }
    : { column, values: list.values };
}

const toggleIn = (values: string[], value: string) =>
  values.includes(value) ? values.filter((v) => v !== value) : [...values, value];

export function toggleInclude(list: Checklist, value: string): Checklist {
  if (!list.exclude) return { values: toggleIn(list.values, value) };
  return list.values.includes(value)
    ? { values: list.values.filter((v) => v !== value), exclude: true }
    : { values: [value] };
}

export function toggleExclude(list: Checklist, value: string): Checklist {
  if (!list.exclude) return { values: [value], exclude: true };
  return { values: toggleIn(list.values, value), exclude: true };
}
