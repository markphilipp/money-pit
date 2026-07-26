# UI

Components, layout mechanics and styling conventions.

## Component map — `src/components/`

| Area        | Files                                                                                      | Notes                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `layout`    | `Header`, `UserMenu`, `StatsStrip`                                                         | `Header` is the brand lockup only; all actions live in `UserMenu`.                          |
| `dashboard` | `Dashboard`                                                                                | The `/` screen. `page.tsx` is a server component that renders it.                           |
| `charts`    | `CategoryChart`, `PersonChart`, `ChartModeToggle`, `chartSetup`                            | `chartSetup` registers Chart.js elements — import it once, from `Dashboard`.                |
| `table`     | `TransactionTable`, `columns`, `ColumnMenu`, `CategoryPicker`, `BulkBar`, `RowContextMenu` | TanStack Table headless; sorting/filtering are `manual*` and live in the store.             |
| `rules`     | `RulesScreen`, `RuleForm`, `RuleEditorScreen`, `RuleConditionsEditor`, `rqbMap`            | One screen per route; `rqbMap` converts between `RuleGroup` and react-querybuilder's shape. |
| `upload`    | `EmptyState`, `UploadZone`                                                                 | Landing page + drop target.                                                                 |
| `common`    | `ColorPickerPopover`                                                                       | Shared palette popover.                                                                     |

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

- `--charts-h` — set by the sticky charts wrapper in `page.tsx`; `.head` in `Table.module.css`
  sticks at `top: var(--charts-h)`.
- `--table-head-h` — set by the transactions bar; `thead th` sticks at
  `calc(var(--charts-h) + var(--table-head-h))`.

Constraints that are easy to break by accident:

- The table's scroll wrapper uses `overflow-x: clip`, **not `auto`** — an `auto` wrapper becomes the
  scrollport the sticky header sticks to, and the header stops pinning to the viewport.
- The table uses `border-collapse: separate` with `box-shadow` insets on `th`. Collapsed borders
  belong to the table and stay behind while the sticky cell moves; shadows travel with the cell.
- Below **820px** sticky is switched off entirely and horizontal scrolling returns.
- Anything new that pins must add its height to the chain, not guess a pixel offset.

## Charts

Both charts read `useFiltered({ ignoreCategory })` / `{ ignorePerson }`, so a chart never filters
itself away: clicking a slice toggles that value in the checklist filter, and unselected slices dim
(`shade()` appends the `40` alpha suffix) rather than disappearing, so they stay clickable.
`chartMode` ('donut' | 'bar') applies to the category chart and persists for the session.

## Table

Column headers own their filters via `ColumnMenu` (sort + per-column filter; person and category get
checklists, description/amount/date get operator inputs). Description search and the
payments/credits toggle live in the bar above.

Row actions follow one rule — **acting inside a selection applies to the whole selection, otherwise
to that row alone** (`targetsFor` in `TransactionTable.tsx`). This covers the category pill, the
right-click menu and "create rule from rows", which stores the ids and routes to `/rules/new`.

Payments rows are excluded unless "show payments & credits" is on; the footer total reflects only
what's visible.

## Routes

| Route         | Screen             | Notes                                                                                          |
| ------------- | ------------------ | ---------------------------------------------------------------------------------------------- |
| `/`           | `Dashboard`        | Charts + table. Prerendered shell, hydrated from `sessionStorage`.                             |
| `/rules`      | `RulesScreen`      | Reorder, edit, delete. Reached from the account menu.                                          |
| `/rules/new`  | `RuleEditorScreen` | Suggestion-driven when there is a selection, blank `RuleForm` when not.                        |
| `/rules/[id]` | `RuleForm`         | Edit one rule. **Dynamic** — ids are minted in the browser, so there is nothing to pre-render. |

`new` is a reserved rule id (`src/lib/rules/naming.ts`) because the static segment shadows the
dynamic one. `not-found.tsx` and `error.tsx` cover unknown URLs and render errors; an id that
matches no rule is _not_ a 404 — rules are session-scoped, so the screen explains that instead.

Screens share their chrome through `RuleScreen.module.css` (frame, heading, action row); each keeps
only what is genuinely its own.

## Rule editor screen — `RuleEditorScreen`

"Create rule" from the table calls `setRuleSources(ids)` and routes to `/rules/new`. The route
decides that the screen is showing; the store only carries which transactions the rule is being
induced from. `ruleSources` _is_ persisted, so reloading `/rules/new` resumes rather than stranding
the screen with no subject.

Three stacked sections:

1. **Suggested rules** — cards from `suggestRuleGroups` (see
   [data-model.md](data-model.md#rule-suggestions--srclibrulessuggestts)), each showing its
   condition and `matches all N selected + M others`. Clicking one loads it into the builder and
   pre-fills the category name, unless the user has already typed one. The active card is marked
   `aria-pressed` and tagged **edited** once the builder diverges from it.
2. **Rule** — color, name, and `RuleConditionsEditor` (the react-querybuilder setup shared with
   `RuleForm`).
3. **Matches** — recomputed on every builder change.

The match preview is the guardrail, and it is deliberately honest about three things:

- The **originally selected transactions stay listed** whatever the rule now says. Ones the rule no
  longer matches are struck through, tagged _will not match_, and counted in a `role="alert"` banner
  above. Editing a suggestion into something too narrow is visible immediately.
- Rules are **first-match-wins**, so `matchesGroup` alone overstates the reach. The preview inserts
  the draft at the position `addRule` would give it (after the user rules, before the builtins) and
  runs `matchCategory`; a row an earlier rule already owns is tagged _stays in ‹rule›_.
- **Manual overrides beat every rule.** A selected row with an override is tagged
  _manual category wins_, and saving offers to clear those overrides — otherwise "applies to
  everything it matches" would silently skip exactly the rows the user hand-corrected.

An emptied builder means "no rule yet", not "a rule that excludes everything" — `fromRqb` drops
half-finished conditions, so mid-edit the group is briefly empty and flagging every row would be
noise. Saving is retroactive for free: categorization derives from the rules on read.

## Account menu — `UserMenu`

Rendered from `layout.tsx` (fixed, top-right) so it's available on the empty state as well. Holds
**Add statement**, **Start over** (two-step confirm, in-menu), **Category rules…**, and a disabled
"Sign in — coming soon". Add statement and Start over only appear once there's data.

Two Radix gotchas encoded there, don't undo them:

- The file input is clicked in a `setTimeout(…, 0)`. Radix returns focus to the trigger as it
  closes, which swallows a picker opened in the same tick.
- "Start over" calls `e.preventDefault()` on select to keep the menu open for the confirm step, and
  `onOpenChange` resets `confirming` so a reopened menu never starts armed.

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
