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

Only `rawRows`, `rules`, `overrides`, `filters`, `chartMode`, `sort` and `ruleSources` are
persisted (`partialize` in `src/store/useAppStore.ts`). Signed out, all of them go to
`sessionStorage`. Signed in, only `filters` and `ruleSources` do, and the account holds the rest
(see [Signed-in sync](#signed-in-sync--srcstoresyncts)). Everything a component renders below that line is
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
- `setRuleSources(ids)` — seeds `/rules/new` with the transactions to induce a rule from. The
  _route_ decides which screen shows; this only carries its subject. It is inside `partialize`, so
  reloading `/rules/new` keeps working instead of landing on a screen with no subject.
- `clearOverrides(ids)` — hands rows back to the rules. Used when saving a rule that would otherwise
  be shadowed by manual categories on the very rows it was induced from.
- `toggleCategoryFilter` / `togglePersonFilter` — checklist filters are removed from
  `filters.columnFilters` entirely when they go empty, so `columnFilters` only ever holds live
  filters. Use `checklistValues()` from `src/lib/rules/engine.ts` to read them back; the map is
  typed as the whole `ColumnFilter` union and needs narrowing.

### Hydration

The server renders with empty state — `sessionStorage` only exists in the browser — so `persist`
runs with `skipHydration: true` and `useHydrated()` rehydrates after mount via
`useSyncExternalStore`. Every screen renders an `aria-busy` placeholder until then. Reading store
state before hydration gives you the initial state, not the session's — anything that must see
persisted data belongs below that gate. This is why `/rules/[id]` resolves its rule _after_
hydration rather than on the server: which rule an id refers to is not knowable there.

Signed in, the gate also waits for the account snapshot (`mode === 'account'`). The root layout
reads the session on the server and passes `signedIn` down through `SignedInContext`, so the very
first client render already knows to wait instead of flashing the tab's local data.

## Signed-in sync — `src/store/sync.ts`

Store actions don't know about accounts. They stay local and synchronous, and components never
await the network. `AccountSync` (in the root layout) calls `startAccountSync()` when the request
had a valid session. It loads the snapshot into the store, sets `mode: 'account'`, and then
subscribes to the store and turns each diff into a server action from `src/app/actions/account.ts`:

| Slice               | Change      | Server action                                                     |
| ------------------- | ----------- | ----------------------------------------------------------------- |
| `rawRows`           | grew        | `appendRows` with the new tail, in chunks under the 1 MB body cap |
| `rawRows`           | emptied     | `resetAccount` only: `resetAll` resets every other slice too      |
| `rules`             | ref changed | `replaceRules` with the whole list                                |
| `overrides`         | diff        | `setOverrides` with the changed rows, identified by content       |
| `chartMode`, `sort` | changed     | `setPreference`                                                   |

Every action re-derives the user from the session cookie and parses its arguments with the zod
schemas in `src/app/actions/input.ts`. Every write is idempotent. Writes run one at a time, in
order. If one fails, the queue behind it is dropped, the snapshot is reloaded over local state,
and an alert says so. There is no per-action rollback. While a write is pending, a `beforeunload`
guard asks before the page is left, because a server action can't outlive the page.

**Claiming a signed-out session.** Loading the snapshot switches persistence to account mode,
which drops the tab's statements from `sessionStorage`. So before the first load, if the rehydrated
tab still holds signed-out rows (the case right after a sign-in), `AccountSync` asks whether to save
them. Save calls `claimLocal`, which runs `claimInto()` from `src/lib/claim.ts` against the account
in one transaction. It also saves the tab's chart type and sort order, unless both are still the
defaults, so untouched defaults never overwrite what the account has saved. Discard just loads the
account. A failed claim stops before the load, so the
rows stay in the tab and a reload asks again. The prompt can't be dismissed without choosing, and
focus starts on Save so Enter never discards.

The layout's session check reads the cookie first and builds the auth instance only if one is
present, so signed-out rendering never needs a database. Reading request headers makes every route
dynamic.

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
