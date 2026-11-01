# UI

Components, layout mechanics and styling conventions.

## Component map — `src/components/`

| Area         | Files                                                                                                                | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layout`     | `Masthead`, `Header`, `UserMenu`, `StatsStrip`, `AccountSync`, `SaveStatusToast`, `PreviewBanner`                    | Preview deploys only: `PreviewBanner`, a "Not production" strip with a Load sample data button. `Masthead` sets the `Header` lockup left of the three `StatsStrip` cards (stacked above 900px down). `Header` is the lockup only; all actions live in `UserMenu`.                                                                                                                                                                           |
| `dashboard`  | `Dashboard`                                                                                                          | The `/` screen. `page.tsx` is a server component that renders it.                                                                                                                                                                                                                                                                                                                                                                           |
| `charts`     | `CategoryChart`, `PersonChart`, `ChartModeToggle`, `chartSetup`                                                      | `chartSetup` registers Chart.js elements — import it once, from `Dashboard`.                                                                                                                                                                                                                                                                                                                                                                |
| `table`      | `TransactionTable`, `columns`, `ColumnMenu`, `CategoryPicker`, `BulkBar`, `RowContextMenu`, `PeriodFilter`           | TanStack Table headless; sorting/filtering are `manual*` and live in the store.                                                                                                                                                                                                                                                                                                                                                             |
| `rules`      | `RulesScreen`, `RuleForm`, `RuleEditorScreen`, `RuleConditionsEditor`, `CategoryField`, `rqbMap`, `SuggestionsStrip` | One screen per route; `CategoryField` picks the category a rule files into or names a new one; `rqbMap` converts between `RuleGroup` and react-querybuilder's shape. `SuggestionsStrip` is the dashboard banner of proposed rules.                                                                                                                                                                                                          |
| `categories` | `CategoriesScreen`, `DeleteCategoryDialog`                                                                           | Add, rename, recolor and delete categories. The delete dialog warns before it takes any rules filing into the category with it.                                                                                                                                                                                                                                                                                                             |
| `settings`   | `SettingsShell`                                                                                                      | The shared frame for every `/settings/*` route: one `<main>`, `<h1>Settings</h1>`, a left sidebar holding the exit link to `/`, the title and the section nav (stacked above a tab strip below 720px); sub-pages add a `Breadcrumb`. Nav entries are the `SETTINGS_SECTIONS` table; add a section there.                                                                                                                                    |
| `datasets`   | `DatasetsScreen`, `RemoveDatasetDialog`                                                                              | List uploaded files, add more, remove one. The dialog states what removal does before it happens.                                                                                                                                                                                                                                                                                                                                           |
| `upload`     | `EmptyState`, `UploadZone`                                                                                           | Landing page + drop target. The privacy line reads `SignedInContext` and matches the mode.                                                                                                                                                                                                                                                                                                                                                  |
| `auth`       | `SignInScreen`                                                                                                       | Provider buttons for `/sign-in`, and what signing in stores.                                                                                                                                                                                                                                                                                                                                                                                |
| `common`     | `ColorPickerPopover`, `ConfirmDialog`, `ShortcutsDialog`, `SearchableListbox`                                        | Shared palette popover, `SearchableListbox` (the search-and-pick combobox behind `CategoryPicker` and `RulePicker`: filtering, arrow/Enter/Escape keys, active-option tracking, listbox ARIA and option styling, placed either `anchored` to a rect or `inline` under its field), a Radix `AlertDialog` wrapper (title, body, cancel/confirm) for anything that needs a confirm-before-acting step, and the keyboard-shortcuts help dialog. |

Every component with state or event handlers needs `'use client'`. The route files under
`src/app/` are server components that do nothing but pick a screen and set `metadata` — keep them
that way, so each route's shell and `<title>` are rendered on the server.

## Sticky charts and table header

The page scrolls normally until the charts reach the top; then the charts, the transactions bar and
the column header row pin while rows scroll beneath them.

Chart and header heights vary, so the offsets are **measured at runtime** rather than hardcoded.
`useHeightVar(name)` (`src/hooks/useHeightVar.ts`) observes an element with a `ResizeObserver` and
publishes its height as a CSS var on `:root`; it returns a callback ref so it also catches nodes
that mount late. Two vars stack:

- `--charts-h` — set by the sticky charts wrapper (`ChartsPane`); `.head` in `Table.module.css`
  sticks at `top: var(--charts-h)`.
- `--table-head-h` — set by the transactions bar; `thead th` sticks at
  `calc(var(--charts-h) + var(--table-head-h))`.

Constraints that are easy to break by accident:

- The table's scroll wrapper uses `overflow-x: clip`, **not `auto`** — an `auto` wrapper becomes the
  scrollport the sticky header sticks to, and the header stops pinning to the viewport.
- The table uses `border-collapse: separate` with `box-shadow` insets on `th`. Collapsed borders
  belong to the table and stay behind while the sticky cell moves; shadows travel with the cell.
- The pinned charts region (`ChartsPane`) is user-resizable. A `role="separator"` handle under it
  drags (pointer) or steps (Arrow Up/Down, Shift for bigger, Home/End) its height between
  `MIN_PANE_HEIGHT` and 60% of the viewport (`src/lib/chartsPane.ts`); a Hide/Show charts button
  collapses it to zero and restores the previous height. The wrapper height, handle included, feeds
  `--charts-h`, so the table header keeps pinning. Height and minimized state persist in
  `localStorage` (`money-pit:charts-pane`), a view preference and not statement data. The
  chart cards flex to fill the pane (`.charts`/`.box` in `Chart.module.css`), and Chart.js
  reflows via `responsive` + `maintainAspectRatio: false`. A community splitter
  (react-resizable-panels) was rejected: it lays out fixed-size panels inside a bounded container,
  whereas this page scrolls as a document with a sticky region.
- Below **820px** sticky is switched off entirely and horizontal scrolling returns.
- Anything new that pins must add its height to the chain, not guess a pixel offset.

## Rule suggestions strip — `SuggestionsStrip`

Rendered by `Dashboard` between `ChartsPane` and the table, in normal flow, so it scrolls away under
the pinned charts and never joins the `--charts-h` chain. It memoizes `discoverProposals`
(see [data-model.md](data-model.md#discovering-suggestions--srclibrulesdiscoverts)) over
`useTransactions()`, the overrides and the dismissed keys, and renders nothing when there are none.

Collapsed it is one line, "N rule suggestions for Other", a button with `aria-expanded`. Expanded it
shows up to five cards, largest first, each with the rule's label, "Covers N rows in Other", up to
three sample descriptions and two buttons whose accessible names carry the label ("Create rule for
…", "Dismiss …"). **Create rule** calls `setRuleSources` with the proposal's `txnIds` and routes to
`/settings/rules/new`, where the editor takes over exactly as it does for a table selection. **Dismiss**
stores the proposal's key and moves focus to the banner button, because the card that had it is
gone.

## Charts

Both charts read `useFiltered({ ignoreCategory })` / `{ ignorePerson }`, so a chart never filters
itself away: clicking a slice toggles that value in the checklist filter, and unselected slices dim
(`shade()` appends the `40` alpha suffix) rather than disappearing, so they stay clickable.
`chartMode` and `personChartMode` ('donut' | 'bar') are independent, one per chart, and persist for the session (and the account). The cards have no visible title or helper text; the Donut/Bars toggle is overlaid in the card's top-right corner and each chart is labelled through its canvas `aria-label`.

## Table

Column headers own their filters via `ColumnMenu` (sort + per-column filter; person and category get
checklists, description/amount/date get operator inputs). Description search and the
payments/credits toggle live in the bar above.

Row actions follow one rule — **acting inside a selection applies to the whole selection, otherwise
to that row alone** (`resolveActionTargets` in `src/lib/shortcuts.ts`, wrapped by `targetsFor` in
`TransactionTable.tsx`). This covers the category pill, the
right-click menu and "create rule from rows", which stores the ids and routes to `/settings/rules/new`.

The bar above the table holds `PeriodFilter`, a combobox next to the search box that narrows the
whole dashboard to one statement or one date range ("All dates" when empty). It is styled like the
search input; when a period is active it takes the accent border and a clear (×) button
(`aria-label="Clear date filter"`). Focusing or clicking it opens a panel under it, grouped as
**Statements** (one per file, hint = its date span; only with 2+ files), **Months in your data**
(newest first, at most 12; only when the data spans 2+ months), **Recent** (Last 7/30/90 days, This
month, Last month, This year, resolved to absolute inclusive dates when chosen) and **Custom
range…**, which swaps the panel for native From / To date inputs written live, with Back and Done.
Typing filters the options by label substring, and `3d`, `2 weeks`, `6m` or `1y` offers a top
"Last N …" option (Enter takes it); anything unmatched shows "No matching period" with Custom range
still offered.

It is an ARIA combobox: `role="combobox"` on the input with `aria-expanded`, `aria-controls` and
`aria-activedescendant`, a `role="listbox"` of `role="group"`s of `role="option"`s, ArrowUp/Down,
Home/End, Enter, Escape (which also closes the custom range), and closing on blur, an outside click
or a choice. It is not part of `SHORTCUTS`; `isShortcutBlocked` already ignores text inputs and the
custom range's date inputs sit inside the same container. All the logic is pure in
`src/lib/periods.ts` (`periodOptions`, `searchPeriods`, `parseShorthand`, `describePeriod`; each
takes `now` so tests are deterministic) and `src/lib/dateRange.ts`; the component only wires it to
`setPeriod`. The closed input shows the file name, "June 2026" when the date filter is exactly one
calendar month, otherwise the range text, and both joined by " · " if a statement and a date filter
coexist. Reset uses `emptyFilters`, so it clears the period. The bar wraps and `useHeightVar`
re-measures `--table-head-h` as it does, so no sticky offset is hardcoded; the panel is absolutely
positioned inside the sticky bar and overlays the table rather than growing the bar.

Payments rows are excluded unless "show payments & credits" is on; the footer total reflects only
what's visible.

## Keyboard shortcuts

`SHORTCUTS` in `src/lib/shortcuts.ts` is the single source of truth: each entry has an `id`, a
`hotkey` (react-hotkeys-hook syntax), the key labels to show, a label and a scope (`global` or
`transactions`). `ShortcutsDialog` renders straight from it, and components bind through
`useShortcut(id, handler)` (`src/hooks/useShortcut.ts`), so the help text can't drift from what is
bound. `?` is bound in `UserMenu` (it renders on every route and owns the dialog); the rest are bound
in `TransactionTable`.

To add one: add an entry to `SHORTCUTS` (and a `ShortcutId`), then call `useShortcut` where the
handler's state lives. Pass `preventDefault` only for presses you actually handle, as a function
when that depends on state, so native behavior (page scroll on Space, typing) survives otherwise.
Punctuation uses `useKey: true` to match the produced character rather than a physical key.

Shortcuts are plain unmodified keys: any ctrl/meta/alt combination never matches, so Cmd+A and
Cmd+C keep working. `isShortcutBlocked` decides when focus owns the key instead, and replaces the
library's own form-tag check (`enableOnFormTags: true`), which is too coarse. It blocks text-entry
inputs, `textarea`, `select`, contenteditable, and anything inside `dialog`, `alertdialog`, `menu`,
`listbox`, `separator`, `slider` or `combobox`. Checkboxes and buttons are deliberately _not_
blocked: row checkboxes keep focus after a click, and blocking them would kill every shortcut right
after selecting a row. The charts-pane resize handle (`separator`) already owns Arrow Up/Down, and
Radix dialogs/menus and `CategoryPicker` (`dialog`) trap keys themselves. Space additionally skips
buttons, links, checkboxes and radios (`activatesOnSpace`), which Space already activates.

The table's keyboard cursor is the highlighted row. It is a transaction id in `useState` inside
`TransactionTable`, never in the store or persisted. The index is derived from the current `rows`
on every render, so an id that filtering or sorting removed counts as no highlight. The row gets
`aria-current="true"` and scrolls into view with `block: 'nearest'`; its `scroll-margin-top` is
`--charts-h` + `--table-head-h` + `--table-thead-h`, the last published by `useHeightVar` on the
`thead`, so the row never lands under the pinned stack.

## Routes

| Route                  | Screen             | Notes                                                                                          |
| ---------------------- | ------------------ | ---------------------------------------------------------------------------------------------- |
| `/`                    | `Dashboard`        | Charts + table. Hydrated from `sessionStorage`, or from the account snapshot when signed in.   |
| `/settings`            | —                  | Redirects to `/settings/rules`.                                                                |
| `/settings/datasets`   | `DatasetsScreen`   | Uploaded files: add, remove.                                                                   |
| `/settings/categories` | `CategoriesScreen` | Add, rename, recolor and delete categories.                                                    |
| `/settings/rules`      | `RulesScreen`      | Reorder, edit, delete.                                                                         |
| `/settings/rules/new`  | `RuleEditorScreen` | Suggestion-driven when there is a selection, blank `RuleForm` when not.                        |
| `/settings/rules/[id]` | `RuleForm`         | Edit one rule. **Dynamic** — ids are minted in the browser, so there is nothing to pre-render. |
| `/sign-in`             | `SignInScreen`     | Google / GitHub via `authClient.signIn.social`. Redirects to `/` when already signed in.       |
| `/privacy`             | `LegalPage`        | Privacy policy. Google's OAuth consent screen links to it, so keep it true to what's stored.   |
| `/terms`               | `LegalPage`        | Terms of service, also linked from the consent screen. Both are linked from `Footer`.          |

All `/settings/*` routes render inside `src/app/settings/layout.tsx`, which wraps them in
`SettingsShell`; the screens themselves render no `<main>`, back link or exit button, only an `<h2>`
and their sections. The account menu has a single "Settings…" entry to `/settings`. `next.config.ts`
redirects the former `/datasets`, `/categories` and `/rules/*` URLs (temporary, `permanent: false`).

`new` is a reserved category id (`src/lib/rules/naming.ts`, `uniqueId`) — a holdover from when a
rule's own id doubled as its category id and could collide with the static `/settings/rules/new` route. A new
rule's own id is minted separately (`newRuleId`, random) and never reaches that check. `not-found.tsx`
and `error.tsx` cover unknown URLs and render errors; an id that matches no rule is _not_ a 404 —
rules are session-scoped, so the screen explains that instead.

Screens share their content chrome through `RuleScreen.module.css` (frame, heading, sections, action
row); each keeps only what is genuinely its own. The rule editor and form pages keep a contextual
breadcrumb (`Rules / New rule`) back to `/settings/rules`.

## Rule editor screen — `RuleEditorScreen`

"Create rule" from the table calls `setRuleSources(ids)` and routes to `/settings/rules/new`. The route
decides that the screen is showing; the store only carries which transactions the rule is being
induced from. `ruleSources` _is_ persisted, so reloading `/settings/rules/new` resumes rather than stranding
the screen with no subject.

Three stacked sections:

1. **Suggested rules** — cards from `suggestRuleGroups` (see
   [data-model.md](data-model.md#rule-suggestions--srclibrulessuggestts)), each showing its
   condition and `matches all N selected + M others`. Clicking one loads it into the builder and
   pre-fills the new category's name, unless the user has already typed one. The active card is
   marked `aria-pressed` and tagged **edited** once the builder diverges from it.
2. **Rule** — `CategoryField` (existing category, or a new one named and colored here) and
   `RuleConditionsEditor` (the react-querybuilder setup shared with `RuleForm`). When at least one
   non-builtin rule exists, a **New rule | Add to existing rule** radio group sits on top. Choosing
   the second option shows `RulePicker`. See _Adding to an existing rule_ below.
3. **Matches** — recomputed on every builder change.

The match preview is the guardrail, and it is deliberately honest about three things:

- The **originally selected transactions stay listed** whatever the rule now says. Ones the rule no
  longer matches are struck through, tagged _will not match_, and counted in a `role="alert"` banner
  above. Editing a suggestion into something too narrow is visible immediately.
- Rules are **first-match-wins**, so `matchesGroup` alone overstates the reach. The preview inserts
  the draft at the position `addRule` would give it (after the user rules, before the builtins) and
  runs `matchCategory`; a row an earlier rule already owns is tagged _stays in ‹category›_.
- **Manual overrides beat every rule.** A selected row with an override is tagged
  _manual category wins_, and saving offers to clear those overrides — otherwise "applies to
  everything it matches" would silently skip exactly the rows the user hand-corrected.

### Adding to an existing rule

The target is a `RuleTarget` (`{ kind: 'new' } | { kind: 'existing'; ruleId: string | null }`).
Choosing "Add to existing rule" starts with **no rule chosen** (`ruleId: null`), never a silent
default. In that state the heading reads "Add N transactions to an existing rule", the category
field is replaced by a note, the builder stays on the plain suggestion seed, and Save is disabled.
Switching back to "New rule" restores the new-rule seed. A chosen rule that has since vanished
falls back to the unchosen state.

`RulePicker` is a thin wrapper over the shared `common/SearchableListbox` in its `inline` placement
(`CategoryPicker` uses the same component `anchored`). It takes focus with its list open when it
appears, so the choice is one keystroke away. Typing filters the non-builtin rules through `searchRules`
([data-model.md](data-model.md#searching-rules--srclibrulessearchts)); ArrowUp/ArrowDown move the
highlight, Enter chooses it, Escape or blur closes the list. Each option (`role="option"` in a
`role="listbox"`) shows the category colour dot, the rule's
label and its truncated condition summary, and an empty search shows "No matching rule". Once
chosen, the input shows the rule's label.

With a rule R chosen:

- The category is locked to R's (`CategoryField` disabled, as `RuleForm` does for builtins), and the
  heading reads "Add N transactions to ‹Category› rule".
- The builder is seeded from `mergeConditions(R.conditions, suggestion.group)`
  ([data-model.md](data-model.md#merging-into-an-existing-rule--srclibrulesmergets)). Picking another
  suggestion card, or switching target, re-seeds it and overwrites manual edits, exactly as picking a
  card does for a new rule. What is in the builder at Save is the rule's new conditions.
- The preview puts the draft in R's slot of the precedence order instead of before the builtins, so
  _stays in ‹category›_ stays honest. "Also newly matches N other transactions" lists only rows the
  draft matches that R did not already match.
- Save calls `setRule(R.id, { conditions })`. No category or rule is added. The clear-overrides
  checkbox and the redirect behave as for a new rule.

An emptied builder means "no rule yet", not "a rule that excludes everything" — `fromRqb` drops
half-finished conditions, so mid-edit the group is briefly empty and flagging every row would be
noise. Saving is retroactive for free: categorization derives from the rules on read.

## Categories screen — `CategoriesScreen`

Add, rename, recolor and delete categories, one row per category with its rule and transaction
counts (`categoryUsage`). Renaming is inline (a text input replaces the name, Enter or Save
commits, Escape cancels); a name already in use by another category is rejected before Save
enables, case-insensitively (`findCategoryByName`). Builtins (`payments`, `other`) can be renamed
and recolored but their Delete button is disabled.

Deleting a non-builtin category opens `DeleteCategoryDialog`, built on the shared `ConfirmDialog`
with a rich `description` (a list of the rules that file into it, and how many rows an override
versus a rule put there) instead of a plain string — `ConfirmDialog`'s description renders inside a
`div`, not Radix's default `<p>`, specifically so a caller can nest block content like this list
without producing invalid HTML. The confirm button reads "Delete category" or "Delete category and N
rules" depending on whether any exist, and deleting removes the category, every rule filing into it,
and every override pointing at it in one store update.

## Uploaded files screen — `DatasetsScreen`

One row per dataset (one uploaded CSV): file name, transaction count, the span of its dates
(`datasetSpan`) and when it was uploaded, with a **Remove** button whose accessible name carries the
file name so every row's is unique. The page also holds an `UploadZone`, so a mistaken upload and its
replacement are handled in one place. With no files it shows "No files uploaded yet." and the zone.

Remove opens `RemoveDatasetDialog` on the shared `ConfirmDialog` (focus starts on Cancel, Escape
cancels, focus returns to the Remove button). Its body comes from `datasetImpact`: how many
transactions go, how many more stay because another file also holds them, and how many manual
category changes are lost. Removing the only file adds that the dashboard returns to the upload
screen while categories and rules stay. Confirming calls the store's `removeDataset`.

## Account menu — `UserMenu`

Rendered from `layout.tsx` (fixed, top-right) so it's available on the empty state as well. Holds
**Add statement**, **Start over** (confirms in a modal), **Settings…**, and
**Sign in…** (a link to `/sign-in`). Add statement and Start over only appear once there's data.
Signed in, Start over also removes the account's datasets and resets its categories and rules, but
keeps the account. Sign in becomes **Sign out** and **Delete account…** (same modal), which calls the
`deleteAccount` server action. Deleting the `user` row cascades to everything, sessions included.
Both sign out and delete clear the tab's persisted state and do a full reload to `/`, so no account
data survives in the in-memory store. The avatar stays a generic SVG: provider names and pictures
are never stored, and not loading provider images keeps `img-src` at `'self'`.

Two Radix gotchas encoded there, don't undo them:

- The file input is clicked in a `setTimeout(…, 0)`. Radix returns focus to the trigger as it
  closes, which swallows a picker opened in the same tick.
- "Start over" and "Delete account…" close the menu and open `common/ConfirmDialog` (Radix
  AlertDialog: Cancel focused, Escape cancels, no outside-click dismiss) driven by the `confirming`
  state, which lives outside the dropdown.

Upload errors render under the avatar in a `role="alert"` block with a dismiss control, following
the input that produced them.

## Styling

CSS Modules per component over tokens in `src/app/globals.css` (`--paper`, `--ink`, `--line`,
`--accent`, `--brand-green`, `--brand-brown`, `--radius`, …). The blueprint grid background lives on
`body`. Fonts are loaded in `layout.tsx` via `next/font/google` (Inter, Barlow Condensed, IBM Plex
Mono) and exposed as `--font-inter` (body), `--font-condensed` (headings/wordmark) and `--font-mono`
(table headers, numerics).

Brand assets: `public/money-pit-mark.png` (the pit mark in the header lockup),
`public/money-pit-logo.png` (full logo art on the empty state), `src/app/icon.png` (favicon). The
header lockup is text — condensed "Money" in `--brand-green` next to "Pit" in `--brand-brown` — not
an image, so it stays selectable and scales with the viewport.

`prototype/` is the original single-file dashboard, kept only as a visual reference. It is excluded
from lint, prettier and tests; don't import from it.
