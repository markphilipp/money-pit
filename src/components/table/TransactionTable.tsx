'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import type { Transaction } from '@/lib/types';
import { fmtMoney, personShort } from '@/lib/format';
import { activatesOnSpace, moveHighlight, resolveActionTargets } from '@/lib/shortcuts';
import { useHeightVar } from '@/hooks/useHeightVar';
import { useShortcut } from '@/hooks/useShortcut';
import { useAppState, usePersons, useSortedFiltered } from '@/store/hooks';
import { selectVisibleTotal } from '@/store/selectors';
import { emptyFilters, useAppStore } from '@/store/useAppStore';
import { BulkBar } from './BulkBar';
import { CategoryPicker } from './CategoryPicker';
import { ColumnMenu } from './ColumnMenu';
import { RowContextMenu } from './RowContextMenu';
import { buildColumns, type ColumnMeta } from './columns';
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
  const persons = usePersons();
  const setFilter = useAppStore((s) => s.setFilter);
  const setColumnFilter = useAppStore((s) => s.setColumnFilter);
  const setSort = useAppStore((s) => s.setSort);
  const setOverride = useAppStore((s) => s.setOverride);
  const toggleSelected = useAppStore((s) => s.toggleSelected);
  const selectAll = useAppStore((s) => s.selectAll);
  const clearSelection = useAppStore((s) => s.clearSelection);
  const setRuleSources = useAppStore((s) => s.setRuleSources);
  const router = useRouter();
  const [picker, setPicker] = useState<PickerState | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const rowEls = useRef(new Map<string, HTMLTableRowElement>());
  const headRef = useHeightVar('--table-head-h');
  const theadRef = useHeightVar('--table-thead-h');
  // Ephemeral keyboard cursor. Filtering or sorting can drop the row, so it only counts while visible.
  const [highlight, setHighlight] = useState<string | null>(null);

  const categoriesById = useMemo(
    () => new Map(state.categories.map((c) => [c.id, c])),
    [state.categories],
  );

  const columns = useMemo(
    () =>
      buildColumns({
        categoriesById,
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
    [categoriesById, state.selectedIds, toggleSelected],
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
  const highlightedId = highlight !== null && visibleIds.includes(highlight) ? highlight : null;
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => state.selectedIds.has(id));
  const someSelected = !allSelected && visibleIds.some((id) => state.selectedIds.has(id));

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  useEffect(() => {
    if (highlightedId) rowEls.current.get(highlightedId)?.scrollIntoView({ block: 'nearest' });
  }, [highlightedId]);

  const targetsFor = (id: string) => resolveActionTargets(id, state.selectedIds);

  const startRuleFrom = (ids: string[]) => {
    setRuleSources(ids);
    router.push('/rules/new');
  };

  const openPicker = (targetIds: string[], rect: DOMRect) => {
    setPicker({
      rect,
      currentCategoryId:
        targetIds.length > 1 ? null : (rows.find((r) => r.id === targetIds[0])?.categoryId ?? null),
      targetIds,
      bulk: targetIds.length > 1,
    });
  };

  const keyboardTargets = () => resolveActionTargets(highlightedId, state.selectedIds);

  const step = (dir: 1 | -1) => setHighlight(moveHighlight(visibleIds, highlightedId, dir));

  useShortcut(
    'search',
    () => {
      searchRef.current?.focus();
      searchRef.current?.select();
    },
    { preventDefault: true },
  );
  useShortcut('firstRow', () => setHighlight(visibleIds[0] ?? null));
  useShortcut('nextRow', () => step(1), { preventDefault: () => rows.length > 0, repeat: true });
  useShortcut('prevRow', () => step(-1), { preventDefault: () => rows.length > 0, repeat: true });
  useShortcut(
    'toggleRow',
    () => {
      if (highlightedId) toggleSelected(highlightedId);
    },
    {
      preventDefault: () => highlightedId !== null,
      ignoreWhen: (e) => activatesOnSpace(e.target),
    },
  );
  useShortcut('selectAll', () => selectAll(visibleIds, true));
  useShortcut(
    'changeCategory',
    () => {
      const targetIds = keyboardTargets();
      if (targetIds.length === 0) return;
      const anchor =
        (highlightedId &&
          rowEls.current.get(highlightedId)?.querySelector('[data-category-pill]')) ||
        searchRef.current;
      if (anchor) openPicker(targetIds, anchor.getBoundingClientRect());
    },
    // The picker focuses its search box mid-keydown, so the "c" would be typed into it.
    { preventDefault: () => keyboardTargets().length > 0 },
  );
  useShortcut('createRule', () => {
    const targetIds = keyboardTargets();
    if (targetIds.length > 0) startRuleFrom(targetIds);
  });
  useShortcut('clear', () => {
    if (state.selectedIds.size > 0) clearSelection();
    else setHighlight(null);
  });

  return (
    <div className={`card ${styles.tableCard}`}>
      <div ref={headRef} className={styles.head}>
        <h2>
          Transactions <span className={styles.count}>({rows.length})</span>
        </h2>
        <input
          className={styles.search}
          ref={searchRef}
          type="text"
          aria-label="Search description"
          placeholder="Search descriptions…"
          value={state.filters.search}
          onChange={(e) => setFilter({ search: e.target.value })}
        />
        <button
          className="btn-clear"
          onClick={() => {
            setFilter(emptyFilters);
            clearSelection();
          }}
        >
          Reset
        </button>

        <BulkBar
          count={state.selectedIds.size}
          onChangeCategory={(anchor) =>
            setPicker({
              rect: anchor.getBoundingClientRect(),
              currentCategoryId: null,
              targetIds: [...state.selectedIds],
              bulk: true,
            })
          }
          onCreateRule={() => startRuleFrom([...state.selectedIds])}
          onClear={clearSelection}
        />
      </div>

      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead ref={theadRef}>
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
                  const columnId = meta.sortKey;
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      className={meta.align === 'right' ? styles.right : undefined}
                    >
                      <ColumnMenu
                        label={meta.headerLabel ?? columnId}
                        columnId={columnId}
                        sort={{ active: state.sort.key === columnId, dir: state.sort.dir }}
                        onSort={(dir) => setSort(columnId, dir)}
                        filter={state.filters.columnFilters[columnId] ?? null}
                        onFilter={(filter) => setColumnFilter(columnId, filter)}
                        options={
                          columnId === 'person'
                            ? persons.map((p) => ({ value: p.name, label: personShort(p.name) }))
                            : columnId === 'category'
                              ? state.categories.map((c) => ({
                                  value: c.id,
                                  label: c.name,
                                  color: c.color,
                                }))
                              : undefined
                        }
                        align={meta.align}
                      />
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
                  <div className={styles.empty}>No transactions match these filters.</div>
                </td>
              </tr>
            )}
            {table.getRowModel().rows.map((row) => (
              <RowContextMenu
                key={row.id}
                selected={state.selectedIds.has(row.original.id)}
                onCreateRule={() => startRuleFrom(targetsFor(row.original.id))}
                onToggleSelect={() => toggleSelected(row.original.id)}
                onChangeCategory={({ x, y }) =>
                  openPicker(targetsFor(row.original.id), new DOMRect(x, y, 0, 0))
                }
              >
                <tr
                  ref={(el) => {
                    if (el) rowEls.current.set(row.original.id, el);
                    else rowEls.current.delete(row.original.id);
                  }}
                  aria-current={row.original.id === highlightedId ? 'true' : undefined}
                  className={[
                    state.selectedIds.has(row.original.id) && styles.selected,
                    row.original.id === highlightedId && styles.highlighted,
                  ]
                    .filter(Boolean)
                    .join(' ')}
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
              </RowContextMenu>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} />
              <td className={styles.totalLabel}>Total</td>
              <td colSpan={2} />
              <td className={`${styles.right} ${styles.totalValue}`}>
                {fmtMoney(selectVisibleTotal(rows))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {picker && (
        <CategoryPicker
          rect={picker.rect}
          currentCategoryId={picker.currentCategoryId}
          categories={state.categories}
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
