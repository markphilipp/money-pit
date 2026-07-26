# Architecture

How data moves through the app, and the rules that keep the store honest.

## The one-way flow

```
CSV files → rawRows (persisted)
                ├── + rules (persisted)
                └── + overrides (persisted)
                        ↓  toTransactions()
                   Transaction[]  ← derived, never stored
                        ↓  selectFiltered() / sortTransactions()
                   charts · stats strip · table
```

Only `rawRows`, `rules`, `overrides`, `filters`, `chartMode` and `sort` are persisted
(`partialize` in `src/store/useAppStore.ts`). Everything a component renders below that line is
recomputed. **Adding a derived field to persisted state is the mistake this design exists to
prevent** — a stale persisted category would survive a rule edit and silently disagree with the
charts.

`selectedIds` is deliberately _not_ persisted: a `Set` doesn't survive JSON, and a selection
outliving a reload is not useful. `ruleEditor` isn't either — a reload should land on the dashboard,
not resume a half-written rule.

## The store — `src/store/useAppStore.ts`

Single Zustand store with `persist` middleware over `sessionStorage` (key `money-pit`).

Actions worth knowing before you add one:

- `uploadFiles(files)` — parses each file independently and returns `{ ok, errors }`. One bad file
  never blocks the others; callers render `errors` inline. Rows are merged through `mergeRows`
  (see [data-model.md](data-model.md)) and only committed if at least one file parsed.
- `addRule` / `reorderRules` — builtin rules (`payments`, `other`) are always re-pinned to the
  bottom. First matching rule wins, so a new rule placed after `other` could never match.
- `deleteRule` — also strips the deleted id out of the active category checklist filter, otherwise
  the table would filter on a category that no longer exists.
- `openRuleEditor(ids)` / `closeRuleEditor()` — the app has one route, so the rule editor screen is
  store state that `page.tsx` renders instead of the dashboard (see [ui.md](ui.md)).
- `clearOverrides(ids)` — hands rows back to the rules. Used when saving a rule that would otherwise
  be shadowed by manual categories on the very rows it was induced from.
- `toggleCategoryFilter` / `togglePersonFilter` — checklist filters are removed from
  `filters.columnFilters` entirely when they go empty, so `columnFilters` only ever holds live
  filters. Use `checklistValues()` from `src/lib/rules/engine.ts` to read them back; the map is
  typed as the whole `ColumnFilter` union and needs narrowing.

### Hydration

Static export prerenders with empty state, so `persist` runs with `skipHydration: true` and
`useHydrated()` rehydrates after mount via `useSyncExternalStore`. `src/app/page.tsx` renders an
`aria-busy` placeholder until then. Reading store state before hydration gives you the initial
state, not the session's — anything that must see persisted data belongs below that gate.

## Selectors — `src/store/selectors.ts`

Pure functions taking `AppState`. `selectTransactions` memoizes on the identity triple
`(rawRows, rules, overrides)` in a module-level cache, because deriving transactions walks every
row on every render. Keep store updates immutable or the cache silently goes stale.

- `selectFiltered(state, opts)` — applies search, the payments exclusion and column filters.
  `opts.ignoreCategory` / `ignorePerson` let a chart exclude its _own_ dimension, which is why
  clicking a donut slice dims the others instead of collapsing the chart to one slice.
- `selectCategoryTotals` / `selectPersonTotals` / `selectStats` — all drop `PAYMENTS_ID` rows.
  Statement payments never count toward spend, in charts or totals.
- `selectPersons` assigns colors by first-seen order across all rows (not filtered rows) so a
  cardholder keeps the same color as filters change.

## Hooks — `src/store/hooks.ts`

`useAppState()` subscribes to the **whole** store and components memoize derivations locally. This
is intentional: Zustand compares snapshots by identity, and a selector returning a fresh array each
call would loop forever. Don't "optimize" a component by returning computed arrays from
`useAppStore(selector)`.

Available: `useTransactions`, `useFiltered(opts)`, `useSortedFiltered`, `usePersons`,
`usePersonColors`. Single scalar values and actions _can_ be pulled with
`useAppStore((s) => s.someAction)` — that's stable and used throughout.

## Page composition — `src/app/page.tsx`

`layout.tsx` renders `<UserMenu />` (fixed, top-right) outside the page, so the account menu is
reachable on the empty state too. `page.tsx` then picks one of three renders: hydration
placeholder → `EmptyState` when `rawRows` is empty → the dashboard (`Header`, `StatsStrip`, sticky
charts, `TransactionTable`).
