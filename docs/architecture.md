# Architecture

How data moves through the app, and the rules that keep the store honest.

## The one-way flow

```
CSV files → datasets (persisted, one per file)
                ↓  mergeDatasets()
            rawRows (derived, deduped)
                ├── + categories, rules (persisted)
                └── + overrides (persisted)
                        ↓  toTransactions()
                   Transaction[]  ← derived, never stored
                        ↓  selectFiltered() / sortTransactions()
                   charts · stats strip · table
```

Only `datasets`, `categories`, `rules`, `overrides`, `filters`, `chartMode`, `personChartMode`, `sort`,
`ruleSources` and `dismissedSuggestions` are persisted (`partialize` in `src/store/useAppStore.ts`, under the key
`categorization` for the category/rule pair — see [data-model.md](data-model.md)). Signed out, all
of them go to
`sessionStorage`. Signed in, only `filters` and `ruleSources` do, and the account holds the rest
(see [Signed-in sync](#signed-in-sync--srcstoresyncts)). Everything a component renders below that line is
recomputed. **Adding a derived field to persisted state is the mistake this design exists to
prevent** — a stale persisted category would survive a rule edit and silently disagree with the
charts. `rawRows` is the same kind of thing one level up: it lives on `AppState` so selectors and
components read it, but it is recomputed from `datasets` and left out of `partialize`.

`selectedIds` is deliberately _not_ persisted: a `Set` doesn't survive JSON, and a selection
outliving a reload is not useful. `ruleEditor` isn't either — a reload should land on the dashboard,
not resume a half-written rule.

## The store — `src/store/useAppStore.ts`

Single Zustand store with `persist` middleware over `sessionStorage` (key `money-pit`).

Actions worth knowing before you add one:

- `uploadFiles(files)` — parses each file independently and returns `{ ok, errors }`. One bad file
  never blocks the others; callers render `errors` inline. Each parsed file becomes a `Dataset`
  (random id, upload time), unless a dataset already holds exactly its rows, which is a silent no-op
  that still reports the file in `ok`. Any other file is its own dataset even when it overlaps an
  earlier one entirely, so removal stays exact (see [data-model.md](data-model.md)).
- `removeDataset(id)` — routes through `removeDataset` in `src/lib/datasets.ts`: drops the dataset and
  the overrides of any row no other dataset holds, then clears the selection and any person filter
  nobody is left to match. Removing the last dataset empties the data only. Categories, rules and
  preferences stay, and the dashboard falls back to `EmptyState` because `rawRows` is empty.
- `addCategory` / `setCategory` — a new category is pinned ahead of the builtins, same as a rule.
  `setCategory` patches name or color; renaming happens here even for a builtin category.
- `deleteCategory` — routes through `removeCategory` (`src/lib/categories.ts`): drops the category,
  every rule that files into it, and every override pointing at it, then strips the id out of the
  active category checklist filter so the table never filters on a category that's gone. Refuses a
  builtin. This is the operation the delete-warning dialog confirms before calling.
- `addRule` / `reorderRules` — the builtin `payments` rule is always re-pinned to the bottom (`other`
  has no rule to pin). First matching rule wins, so a new rule placed after `payments` could never
  match.
- `deleteRule` — removes one rule; its category and any other rules filing into it are untouched.
- `setRuleSources(ids)` — seeds `/settings/rules/new` with the transactions to induce a rule from. The
  _route_ decides which screen shows; this only carries its subject. It is inside `partialize`, so
  reloading `/settings/rules/new` keeps working instead of landing on a screen with no subject.
- `dismissSuggestion(key)` — remembers a proposal key from `discoverProposals` so it stops showing.
  Idempotent. Only the keys are stored: the proposals themselves are derived from the transactions
  every render, which is how an upload re-checks them. `resetAll` clears them with everything else.
- `clearOverrides(ids)` — hands rows back to the rules. Used when saving a rule that would otherwise
  be shadowed by manual categories on the very rows it was induced from.
- `toggleCategoryFilter` / `togglePersonFilter` — checklist filters are removed from
  `filters.columnFilters` entirely when they go empty, so `columnFilters` only ever holds live
  filters. Use `checklistValues()` from `src/lib/rules/engine.ts` to read them back; the map is
  typed as the whole `ColumnFilter` union and needs narrowing.

### Derived `rawRows`

`deriveRawRows` wraps the store's `set` and `api.setState`, and whenever a write changes `datasets`
it adds `rawRows: mergeDatasets(datasets)` to the same update. An action, hydration and the sync
layer's `setState` all go through it, so no writer can leave the two out of step, and `rawRows`
keeps its identity while `datasets` does — the transaction selector's cache depends on that. Never
set `rawRows` yourself.

### Hydration

The server renders with empty state — `sessionStorage` only exists in the browser — so `persist`
runs with `skipHydration: true` and `useHydrated()` rehydrates after mount via
`useSyncExternalStore`. Every screen renders an `aria-busy` placeholder until then. Reading store
state before hydration gives you the initial state, not the session's — anything that must see
persisted data belongs below that gate. This is why `/settings/rules/[id]` resolves its rule _after_
hydration rather than on the server: which rule an id refers to is not knowable there.

A tab saved before datasets existed has `rawRows` and no `datasets`. `merge` hydrates that as a
single dataset named "Earlier uploads" with a fresh random id, the same way it upgrades legacy rules.

Signed in, the gate also waits for the account snapshot (`mode === 'account'`). The root layout
reads the session on the server and passes `signedIn` down through `SignedInContext`, so the very
first client render already knows to wait instead of flashing the tab's local data.

## Signed-in sync — `src/store/sync.ts`

Store actions don't know about accounts. They stay local and synchronous, and components never
await the network. `AccountSync` (in the root layout) calls `startAccountSync()` when the request
had a valid session. It loads the snapshot into the store, sets `mode: 'account'`, and then
subscribes to the store and turns each diff into a server action from `src/app/actions/account.ts`:

| Slice                                  | Change      | Server action                                                                                  |
| -------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------- |
| `datasets`                             | added       | `createDataset`, then `appendDatasetRows` for the whole file in chunks under the 1 MB body cap |
| `datasets`                             | removed     | `removeDataset`                                                                                |
| `categories`, `rules`                  | ref changed | `replaceCategories` with both lists, written together                                          |
| `overrides`                            | diff        | `setOverrides` with the changed rows, identified by content                                    |
| `chartMode`, `personChartMode`, `sort` | changed     | `setPreference`                                                                                |
| `dismissedSuggestions`                 | changed     | `setPreference`, the same row and the same write                                               |

There is no whole-account reset. Start over (`resetAll`) is the ordinary diffs: every dataset
removed, categories and rules replaced with the defaults, overrides cleared, preferences reset. Only
the slices that actually changed produce a write. Removing the last dataset is likewise just a
`removeDataset`, so it never touches categories. An override pruned along with its removed rows
produces no write, because `overrideChanges` runs against the rows that are left and the server
deleted the vanished rows (and their `category_override` column) itself.

Every action re-derives the user from the session cookie and parses its arguments with the zod
schemas in `src/app/actions/input.ts`. Every write is idempotent (`createDataset` and the row and
membership inserts conflict and do nothing, `removeDataset` finds nothing the second time, the rest
overwrite), so a failed write is retried in place after 1 s, 2 s
and 4 s, and the queue behind it waits. Writes run one at a time, in order. If the retries run out,
the queue behind the write is dropped and the snapshot is reloaded over local state. There is no
per-action rollback. While a write is pending, a `beforeunload` guard asks before the page is left,
because a server action can't outlive the page.

**Save status.** The sync layer owns a `SaveStatus` state machine (`src/lib/saveStatus.ts`: `idle`,
`saving`, `saved`, `retrying(attempt)`, `failed`) and reports each transition through the optional
`onStatus` argument. `AccountSync` renders it as `SaveStatusToast`, bottom right. Signed out there
is no sync, so no status and no toast; the privacy line already says the data stays in the browser.

**Claiming a signed-out session.** Loading the snapshot switches persistence to account mode,
which drops the tab's statements from `sessionStorage`. So before the first load, if the rehydrated
tab still holds signed-out rows (the case right after a sign-in), `AccountSync` asks whether to save
them. Save calls `claimLocal`, which runs `claimInto()` from `src/lib/claim.ts` against the account
in one transaction (`saveClaim`, `src/db/queries/claim.ts`). It also saves the tab's chart type and sort order, unless both are still the
defaults, so untouched defaults never overwrite what the account has saved. Dismissed suggestions
are always sent and unioned with the account's. Discard just loads the
account. A failed claim stops before the load, so the
rows stay in the tab and a reload asks again. The prompt can't be dismissed without choosing, and
focus starts on Save so Enter never discards.

The layout's session check reads the cookie first and builds the auth instance only if one is
present, so signed-out rendering never needs a database. Reading request headers makes every route
dynamic.

## Selectors — `src/store/selectors.ts`

Pure functions taking `AppState`. `selectTransactions` memoizes on the identity quadruple
`(rawRows, categories, rules, overrides)` in a module-level cache, because deriving transactions
walks every row on every render. Keep store updates immutable or the cache silently goes stale.

- `selectFiltered(state, opts)` — applies search, the payments exclusion and column filters.
  `opts.ignoreCategory` / `ignorePerson` let a chart exclude its _own_ dimension, which is why
  clicking a donut slice dims the others instead of collapsing the chart to one slice.
- `selectCategoryTotals` / `selectPersonTotals` / `selectStats` — all drop `PAYMENTS_ID` rows.
  Statement payments never count toward spend, in charts or totals. Category-facing selectors take
  `categories`, not `rules` — a category's name and color, not what fills it, is what a chart or the
  sort key needs.
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
