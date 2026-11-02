import type { FilterState } from './types';

export function isFiltered(filters: FilterState): boolean {
  return (
    filters.search !== '' ||
    filters.showCredits ||
    filters.statementIds.length > 0 ||
    Object.keys(filters.columnFilters).length > 0
  );
}
