'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import type { Transaction } from '@/lib/types';
import { useAppState, useSortedFiltered } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { BulkBar } from './BulkBar';
import { CategoryPicker } from './CategoryPicker';
import { buildColumns, type ColumnMeta } from './columns';
import { AmountFilter, PersonFilter } from './HeaderFilters';
import styles from './Table.module.css';

interface PickerState {
  rect: DOMRect;
  currentCategoryId: string | null;
  targetIds: string[];
  bulk: boolean;
}

export function TransactionTable() {
  const state = useAppState();
  const rows = useSortedFiltered();
  const setSort = useAppStore((s) => s.setSort);
  const setOverride = useAppStore((s) => s.setOverride);
  const toggleSelected = useAppStore((s) => s.toggleSelected);
  const selectAll = useAppStore((s) => s.selectAll);
  const clearSelection = useAppStore((s) => s.clearSelection);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const rulesById = useMemo(() => new Map(state.rules.map((r) => [r.id, r])), [state.rules]);

  const columns = useMemo(
    () =>
      buildColumns({
        rulesById,
        isSelected: (id) => state.selectedIds.has(id),
        onToggleRow: toggleSelected,
        onPillClick: (txn: Transaction, anchor: HTMLElement) =>
          setPicker({
            rect: anchor.getBoundingClientRect(),
            currentCategoryId: txn.categoryId,
            targetIds: [txn.id],
            bulk: false,
          }),
      }),
    [rulesById, state.selectedIds, toggleSelected],
  );

  // Table state lives in the store, so the compiler skipping memoization here is harmless.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualFiltering: true,
  });

  const visibleIds = rows.map((r) => r.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => state.selectedIds.has(id));
  const someSelected = !allSelected && visibleIds.some((id) => state.selectedIds.has(id));

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className={styles.head}>
        <h2>
          Transactions <span className={styles.count}>({rows.length})</span>
        </h2>
        <span className="sub">
          Click a category pill to reassign it · check rows to bulk-edit · click headers to sort
        </span>
      </div>

      <BulkBar
        count={state.selectedIds.size}
        onClear={clearSelection}
        onChangeCategory={(anchor) =>
          setPicker({
            rect: anchor.getBoundingClientRect(),
            currentCategoryId: null,
            targetIds: [...state.selectedIds],
            bulk: true,
          })
        }
      />

      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const meta = header.column.columnDef.meta as ColumnMeta | undefined;
                  if (!meta?.sortKey) {
                    return (
                      <th key={header.id} className={styles.sel} scope="col">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          className={styles.rowCk}
                          checked={allSelected}
                          onChange={(e) => selectAll(visibleIds, e.target.checked)}
                          aria-label="Select all visible rows"
                        />
                      </th>
                    );
                  }
                  const active = state.sort.key === meta.sortKey;
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      className={meta.align === 'right' ? styles.right : undefined}
                    >
                      <button
                        className={styles.sortBtn}
                        onClick={() => setSort(meta.sortKey!)}
                        aria-label={`Sort by ${meta.headerLabel}`}
                      >
                        {meta.headerLabel}
                        <span className={styles.arrow}>
                          {active ? (state.sort.dir === 1 ? '▲' : '▼') : ''}
                        </span>
                      </button>
                      {meta.filter === 'person' && <PersonFilter />}
                      {meta.filter === 'amount' && <AmountFilter />}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length}>
                  <div className={styles.empty}>
                    No transactions match these filters. Try widening the amount range or clearing a
                    category.
                  </div>
                </td>
              </tr>
            )}
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={state.selectedIds.has(row.original.id) ? styles.selected : undefined}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as ColumnMeta | undefined;
                  return (
                    <td
                      key={cell.id}
                      className={
                        meta?.sortKey
                          ? meta.align === 'right'
                            ? styles.right
                            : undefined
                          : styles.sel
                      }
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.footNote}>
        Auto-categorized by merchant keywords — click any category pill to correct it. Statement
        payments are excluded from charts and totals; toggle “Show payments &amp; credits” to see
        them in the table.
      </div>

      {picker && (
        <CategoryPicker
          rect={picker.rect}
          currentCategoryId={picker.currentCategoryId}
          rules={state.rules}
          onClose={() => setPicker(null)}
          onChoose={(categoryId) => {
            setOverride(picker.targetIds, categoryId);
            if (picker.bulk) clearSelection();
          }}
        />
      )}
    </div>
  );
}
