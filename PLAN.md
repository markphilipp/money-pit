# money-pit v1 — Implementation Plan (agent team)

Migrate the single-file prototype (`index.html`, repo root — keep as reference until Wave 3) to a production Next.js app. This document is the coordination contract: **Section 2–4 are locked decisions; agent briefs in Section 6 are self-contained.** Give each agent only its own brief plus Sections 2–4.

## 1. Product summary

Client-side credit-card statement analyzer. User uploads CSV statement(s), transactions are auto-categorized by keyword rules, user explores via charts + table and corrects categories. No backend, no auth, no cross-session persistence — everything lives in the browser tab (sessionStorage).

## 2. Locked architecture decisions

| Decision               | Choice                                                    | Why                                                                                |
| ---------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Framework              | Next.js 15, App Router, `output: 'export'` (static)       | No server needed (no auth/persistence); static export deploys free anywhere        |
| Hosting                | Netlify free tier, connected to GitHub repo               | Free, deploy previews on PRs                                                       |
| Language               | TypeScript, `strict: true`                                | requirement                                                                        |
| State                  | Zustand + `persist` middleware backed by `sessionStorage` | Session-only persistence for free; decoupled store enables parallel component work |
| Charts                 | Chart.js 4 + `react-chartjs-2`                            | Direct port of prototype chart logic                                               |
| Table                  | TanStack Table v8 (headless)                              | Built-in sorting + per-column filtering (requirement 5)                            |
| CSV parsing            | Papa Parse                                                | Robust quoted-field handling                                                       |
| Styling                | CSS Modules + global design tokens (no Tailwind)          | Prototype CSS ports nearly verbatim                                                |
| Unit/integration tests | Vitest + React Testing Library + jsdom                    | Testing-trophy core                                                                |
| E2E                    | Playwright (chromium only)                                | Few happy-path flows incl. file upload                                             |
| Lint/format            | ESLint (next/core-web-vitals + typescript) + Prettier     | requirement                                                                        |
| CI                     | GitHub Actions (quality gate) + Netlify auto-deploy       | requirement                                                                        |
| Package manager        | npm                                                       | default                                                                            |

Testing trophy allocation: static analysis everywhere → many unit tests for pure `lib/` logic → **most effort in RTL integration tests** (components + store wired together) → 3–4 Playwright E2E flows.

## 3. Shared contracts

All agents code against these. Defined in `src/lib/types.ts` by Wave 0; do not redefine locally.

```ts
export interface Transaction {
  id: string; // stable hash of (date|description|amount|member) + dedupe ordinal
  status: string;
  date: Date;
  dateStr: string; // MM/DD/YYYY as parsed
  description: string;
  amount: number; // debits positive, credits negative
  isCredit: boolean;
  person: string; // "Member Name" column, raw
  categoryId: string; // resolved: manual override ?? rule match ?? 'other'
}

export interface CategoryRule {
  id: string; // slug or nanoid
  name: string;
  color: string; // hex
  keywords: string[]; // uppercase substring match against description; first rule (array order) wins
  builtin?: boolean; // 'payments' and 'other' are non-deletable
}

export interface FilterState {
  search: string; // description substring, case-insensitive (top bar)
  person: string | null; // column-header filter
  amountMin: number | null; // column-header filter (abs value)
  amountMax: number | null;
  categoryIds: Set<string>; // chart click-to-filter; empty = all
  showCredits: boolean; // when false, hide 'payments' category rows everywhere
}
```

Zustand store (`src/store/useAppStore.ts`) — single store, persisted to sessionStorage (Sets/Dates need custom serialization; overrides and raw rows persist, `Transaction[]` is derived):

```ts
interface AppState {
  rawRows: RawStatementRow[]; // parsed CSV rows from all uploads, deduped
  rules: CategoryRule[]; // seeded from defaultRules
  overrides: Record<string, string>; // txnId -> categoryId (manual corrections)
  filters: FilterState;
  chartMode: 'donut' | 'bar'; // user pref, persists for session
  sort: { key: 'date' | 'description' | 'category' | 'person' | 'amount'; dir: 1 | -1 };
  selectedIds: Set<string>; // bulk-edit selection
  // actions: uploadFiles(files), setRule/addRule/deleteRule/reorderRules,
  // setOverride(ids[], categoryId), setFilter(partial), toggleCategoryFilter(id),
  // setChartMode, setSort, toggleSelected/selectAll/clearSelection, resetAll
}
// selector: selectTransactions(state): Transaction[]  — memoized derive from rawRows+rules+overrides
// selector: selectFiltered(state, opts?: {ignoreCategory?, ignorePerson?}): Transaction[]
```

`selectFiltered` opts exist because charts must ignore their own dimension (category chart ignores category filter so dimmed slices stay clickable; person chart likewise — see prototype `filtered()` lines 378–389).

CSV input format (header row required): `Status,Date,Description,Debit,Credit,Member Name`. Debit XOR Credit populated; credits are negative numbers in the Credit column.

### File layout

```
src/
  app/           layout.tsx, page.tsx, globals.css (tokens)
  lib/           types.ts, csv.ts, categorize.ts, defaultRules.ts, format.ts, hash.ts
  store/         useAppStore.ts, selectors.ts
  components/
    layout/      Header.tsx, StatsStrip.tsx
    upload/      EmptyState.tsx, UploadZone.tsx
    charts/      CategoryChart.tsx, PersonChart.tsx, ChartModeToggle.tsx
    table/       TransactionTable.tsx, columns.tsx, HeaderFilters.tsx, CategoryPicker.tsx, BulkBar.tsx
    rules/       RulesPanel.tsx, RuleEditor.tsx
e2e/             *.spec.ts + fixtures/*.csv
```

### Design tokens (port from prototype)

Fonts: Inter (body), Barlow Condensed (headings, uppercase), IBM Plex Mono (numbers/labels) via `next/font/google`. CSS vars: `--paper:#F2F4F1 --grid:#DDE3DC --ink:#1E2A26 --ink-soft:#5B6A64 --line:#C6CFC7 --accent:#E8641B --accent-soft:#FBE6D8 --card:#FFFFFF --green:#2E7D5B --radius:10px`. Graph-paper background, card style, pill/tag styles: copy from `index.html` `<style>` block. Person colors: `['#E8641B','#1F6F8B','#7B5CB8','#5F9E62']` pinned per person for the session.

## 4. UX requirements (delta from prototype)

1. **Empty state**: on load with no data, show a landing/empty state — app title, short explainer, expected CSV format, and an upload dropzone (drag-drop + file picker, multiple files, .csv only). After upload, dashboard replaces it; a compact "add statement" affordance stays in the header.
2. **Filters move into the table header** (requirement 5): Person = dropdown in Person column header; Amount min/max = inputs in Amount column header; Date sort stays header-click. The top filter bar shrinks to: description search input + "Show payments & credits" toggle + Reset button.
3. **Rules panel**: collapsible panel/drawer to view + CRUD category rules (name, color, keyword list, delete, reorder via up/down buttons). `payments` and `other` are builtin: rename/recolor allowed, delete disallowed; `other` has no keywords (fallback). Rule changes re-categorize immediately (manual overrides always win).
4. Everything else matches the prototype exactly: stats strip, category donut/bar toggle (mode persists in session), person donut, click-to-filter with dimmed-not-removed slices, sortable table, per-row category pill → searchable picker popover, multi-select checkboxes + bulk category change, payments excluded from charts/stats always and from table unless toggle on.
5. Default rules (`defaultRules.ts`): generic national merchants only — derive from prototype `CATEGORIES` (index.html lines 297–321) but **drop personal/local merchant keywords** (COLIN LESENGER, LIFESTANCE, MINDFULHEALTH, BLUE ORCHID, LILY CLEANERS, WHOLE PET, SPARK PAWS, TURF BROTHERS, LANIER MATERIAL, GCX, EVOLVEAI, RING AI, NEEDLE, USCONNECT, PROTAGONIST, LOWER LEFT BREWING, PAL'S, ACTIVE N FIT, DO MY OWN). Keep national brands (AMAZON, WALMART, MCDONALD, LOWES, APPLE.COM/BILL, SPOTIFY, HULU, NETLIFY, TESLA, EXXON, CVS/PHARMACY, DUKE-ENERGY, AT&T, SPECTRUM, ONLINE PAYMENT, etc.).

## 5. Waves & dependency graph

```
Wave 0 (1 agent, sequential):   A0 Scaffold + contracts
Wave 1 (6 agents, parallel):    A1 lib   A2 store   A3 upload/empty   A4 charts   A5 table   A6 CI/CD+deploy
        A1 ─┐
            ├─→ A2 depends on A1 types only (types.ts lands in Wave 0, so A2 runs parallel using stub lib fns behind interfaces)
        A3,A4,A5 code against store interface (Section 3) with a test store; no cross-dependencies
        A6 independent
Wave 2 (1 agent):               A7 Integration: wire page.tsx, real store into components, fix seams
Wave 3 (2 agents, parallel):    A8 E2E + trophy audit    A9 Visual/a11y polish + README + prototype removal
```

Wave 1 agents each own their directory exclusively — no file conflicts. Each ships its own unit/integration tests alongside. If running agents in git worktrees, merge order: A1, A2, then A3–A6 in any order.

## 6. Agent briefs

Each brief is standalone given Sections 2–4. All agents: TypeScript strict, no `any`, tests colocated as `*.test.ts(x)`, follow existing Prettier/ESLint config, `npm test` and `npm run typecheck` must pass before handoff.

---

### A0 — Scaffold (Wave 0, blocks everyone)

Create the Next.js app at repo root (move prototype `index.html`/`data.js` to `prototype/`, keep `data.js` gitignored).

- `create-next-app` — TS, App Router, ESLint, no Tailwind, `src/` dir. Set `output: 'export'` and `images.unoptimized: true` in `next.config.ts`.
- Add + configure: Prettier, Vitest (+ jsdom, @testing-library/react, @testing-library/user-event, @testing-library/jest-dom), Playwright (chromium), `tsconfig` strict.
- Scripts: `dev build lint typecheck test test:watch e2e format`.
- Commit `src/lib/types.ts` exactly as Section 3 (types only), plus empty-but-typed stubs: `src/store/useAppStore.ts` (interface + `create` with throwing stubs), `src/lib/{csv,categorize,defaultRules,format,hash}.ts` (exported signatures, `throw new Error('not implemented')` bodies).
- `src/app/globals.css` with Section 3 design tokens + fonts via `next/font/google`; base `layout.tsx` applying background/fonts; placeholder `page.tsx`.
- Verify: `npm run build` produces `out/`, one passing smoke test of each runner (Vitest + Playwright).

**Done when**: clean install → lint, typecheck, test, e2e, build all green.

---

### A1 — Domain lib (Wave 1) — owns `src/lib/`

Implement pure functions (no React, no store). Heavy unit-test coverage — this is the trophy's unit layer.

- `csv.ts`: `parseStatementCsv(text: string): RawStatementRow[]` using Papa Parse. Validate header matches `Status,Date,Description,Debit,Credit,Member Name` (throw typed `CsvFormatError` with human message otherwise). Skip blank lines. `mergeRows(existing, incoming)`: concat + dedupe exact duplicates (same date/description/amount/member appearing in overlapping statement exports) — dedupe only across files, preserve legit same-day duplicates within one file.
- `hash.ts`: `txnId(row, ordinal)` — stable id from field content + per-duplicate ordinal (same input → same id across reloads; overrides keyed on it must survive re-upload of the same file).
- `categorize.ts`: `toTransactions(rows, rules, overrides): Transaction[]` — parse amounts (debit positive, credit negative), dates (`MM/DD/YYYY` → local Date), apply first-matching rule by uppercase substring, override wins, fallback `'other'`.
- `defaultRules.ts`: per Section 4 item 5.
- `format.ts`: `fmtMoney(n)` → `$1,234.56` / `−$1,234.56` (U+2212 minus, matches prototype); `personShort(name)` → first name title-cased ("MARK PHILIPP" → "Mark").

Tests: quoted fields with commas/escaped quotes, credit rows, bad header, empty file, dedupe across files vs within file, rule precedence order, override precedence, id stability.

**Done when**: stubs replaced, ≥95% line coverage on `src/lib/`, typecheck green.

---

### A2 — Store (Wave 1) — owns `src/store/`

Implement the Zustand store per Section 3 against the `lib/` signatures (real lib may still be stubs — mock in tests).

- `persist` middleware → `sessionStorage`; custom `storage` serializer for `Set` and raw rows; do NOT persist derived transactions. `skipHydration`-safe for SSG (guard `window`).
- All actions from Section 3. `uploadFiles(files: File[])` reads text, parses via `lib/csv`, merges into `rawRows`, surfaces per-file errors as return value `{ok: string[], errors: {file: string, message: string}[]}` (no toast lib — UI renders it).
- `selectors.ts`: memoized `selectTransactions`, `selectFiltered(opts)`, `selectCategoryTotals` (excludes payments; positive totals only, sorted desc), `selectPersonTotals`, `selectStats` (net/purchases/refunds/count/topCategory), `selectPersons` (with pinned color assignment, insertion order).
- Filter semantics: exactly prototype lines 378–389 — payments hidden unless `showCredits`; category/person filters skippable via opts; amount filters compare `Math.abs(amount)`; search case-insensitive substring on description.
- Rule mutations must not touch `overrides`; deleting a rule reassigns affected (non-overridden) txns via normal re-derivation, and overrides pointing at a deleted rule fall back to `'other'` in `selectTransactions`.

Tests (integration-style, real Zustand): upload→derive, filter matrix, bulk override, rule delete fallback, sessionStorage round-trip incl. Set revival, chartMode persistence.

**Done when**: store stubs replaced, tests green.

---

### A3 — Empty state & upload (Wave 1) — owns `src/components/upload/`, `src/components/layout/`

Build against the store interface (Section 3) — in tests, use the real store if available, else a hand-rolled stub implementing the interface.

- `EmptyState.tsx`: centered card on the graph-paper background — app name ("Money Pit / Spending Breakdown" styling per tokens), one-line pitch, expected-CSV-format hint (show the header row in mono font), and embedded `UploadZone`.
- `UploadZone.tsx`: drag-drop + click-to-browse, `accept=".csv"`, multiple. Calls `uploadFiles`; renders returned per-file errors inline (dashed accent border box). Keyboard accessible.
- `Header.tsx`: eyebrow + H1 per prototype header, plus compact "＋ Add statement" button (reuses UploadZone logic via hidden input) and a "Start over" (calls `resetAll`, confirm via inline two-step button, not `window.confirm`).
- `StatsStrip.tsx`: renders `selectStats` in prototype's 5-card layout.

Tests (RTL): drop/browse dispatches files to store, error rendering, empty vs loaded switching, stats formatting, reset flow.

**Done when**: components render standalone in tests; no direct `lib/` imports except types/format.

---

### A4 — Charts (Wave 1) — owns `src/components/charts/`

Chart.js 4 + react-chartjs-2. Port prototype behavior (index.html lines 395–528) exactly.

- `CategoryChart.tsx`: donut/bar per `chartMode` from store; `ChartModeToggle.tsx` segmented control (Donut/Bars) → `setChartMode`. Data from `selectCategoryTotals` over `selectFiltered({ignoreCategory: true})`. Click slice/bar → `toggleCategoryFilter(id)`. Selected categories full color; when any selected, others get `color + '40'` alpha suffix (dimmed, still clickable). Tooltip: ` $x,xxx.xx (pp.p%)`. Bar mode: horizontal (`indexAxis:'y'`), $-formatted x ticks, mono font.
- `PersonChart.tsx`: donut over `selectFiltered({ignorePerson: true})`, labels via `personShort`, pinned person colors, click toggles `filters.person` (click active person → clear). Same dimming.
- Both: subtitle text explaining click-to-filter (swap wording donut/bars per prototype), `maintainAspectRatio:false` in fixed-height box, white 2px borders, right legend, cutout 55%.

Tests (RTL, mock canvas via `vitest-canvas-mock` or assert on chart props/config objects): mode toggle updates store + chart type, click handler dispatches toggles, dimming logic, data derivation excludes payments.

**Done when**: charts render from a seeded store and interactions dispatch correct actions.

---

### A5 — Table (Wave 1) — owns `src/components/table/`

TanStack Table v8, headless, styled per prototype table CSS. This is the largest brief — the prototype's table behavior (index.html lines 543–690) is the reference.

- Columns: select-checkbox, Date, Description, Category (pill), Person, Amount (right, mono, green when credit). Sort by header click (arrows ▲▼; default date desc; first-click dir: desc for date/amount, asc otherwise).
- **Header filters (new)**: Person column header contains a small dropdown (All + persons via `selectPersons`); Amount header contains min/max number inputs (abs-value filter). Both write to store `filters`. Filter controls must not trigger sort (stopPropagation); keep headers keyboard-operable.
- `CategoryPicker.tsx`: anchored popover — search input, keyboard nav (↑↓ Enter Esc), color-dot options, ✓ on current, excludes `payments`, click-outside closes, flips above anchor near viewport bottom. Reused by pill click (single txn) and BulkBar.
- Row selection: per-row checkbox + header select-all over _visible/filtered_ rows (indeterminate state); selected rows highlighted.
- `BulkBar.tsx`: shows when selection non-empty — "N selected", "Change category" (opens picker → `setOverride(selectedIds, cat)` → clear selection), "Clear selection".
- Empty-filter-result row with helpful message; txn count `(N)` next to title; footnote about payments toggle.

Tests (RTL — bulk of trophy): sort toggling, each header filter, search interplay, pill→picker→override flow, picker keyboard nav, select-all semantics with filters active, bulk change, credit styling.

**Done when**: full table works against a seeded store in tests.

---

### A6 — CI/CD & deploy (Wave 1) — owns `.github/`, `netlify.toml`

- `.github/workflows/ci.yml`: on PR + push to main — checkout, setup-node 22 + npm cache, `npm ci`, then parallel jobs: lint, typecheck, unit/integration (`vitest run --coverage`), build, e2e (Playwright, needs build; cache browsers). All required for merge.
- `netlify.toml`: build `npm run build`, publish `out/`. Add SPA-safe 404 handling (static export: default 404.html is fine — no redirects needed for a single route).
- README section: local dev, test commands, deploy flow (Netlify auto-deploys `main`; PRs get deploy previews), CSV format, privacy note (data never leaves the browser).
- Do NOT create the Netlify site (needs owner login) — document the 3 clicks required.

**Done when**: `act`-free validation — workflow YAML lints (`actionlint` if available), a dry `npm run build && npx serve out` smoke works.

---

### A7 — Integration (Wave 2, after all Wave 1)

Assemble `src/app/page.tsx`: hydration-guarded store (`'use client'`, wait for persist rehydrate before render to avoid SSG mismatch), conditional EmptyState vs dashboard (Header, StatsStrip, top bar [search + credits toggle + Reset], charts grid, RulesPanel trigger, table). Build `src/components/rules/` (RulesPanel drawer + RuleEditor per Section 4 item 3 — it lands here because it touches store+lib+UI seams). Replace any remaining stubs, resolve interface drift between agents' components and the real store, delete dead code. Add integration tests for the page-level flows: upload→dashboard appears; chart click filters table; rule edit re-categorizes; reset returns to empty state.

**Done when**: `npm run build` green, all tests green, manual `npx serve out` walkthrough of every Section 4 behavior passes.

---

### A8 — E2E + trophy audit (Wave 3)

Playwright specs with fixture CSVs in `e2e/fixtures/` (synthesize from the sample block in `prototype/index.html` lines 266–291 — never real data): (1) land→empty state→upload two files→stats/charts/table appear, dedupe verified; (2) donut click filters table, toggle to bars persists after reload (sessionStorage), filters via column headers; (3) recategorize single + bulk, add custom rule and see re-categorization; (4) bad-format file shows error, valid file still loads. Then audit coverage against the trophy: report gaps where E2E duplicates what integration tests already cover (delete the duplicate E2E, not the integration test) and where logic lacks unit tests.

---

### A9 — Polish (Wave 3)

Visual QA against `prototype/index.html` side-by-side (spacing, fonts, colors, hover states, reduced-motion media query). A11y pass: labels on all inputs, focus-visible rings, picker as proper listbox, table th scope, color-contrast check on category colors over white. Mobile: charts stack, table scrolls horizontally, header filters usable at 375px. Update README top section; move `prototype/` to a `prototype` git branch or delete per owner preference (ask; default: keep `prototype/` directory, gitignore stays for `data.js`).

## 7. Quality gates (all waves)

- No PII/real data in any committed file or test fixture — synthetic "Alex/Jamie Sample" data only.
- `npm run lint && npm run typecheck && npm test && npm run build` green before any handoff.
- Testing trophy: unit tests only for pure `lib/` logic; component behavior via RTL integration; ≤5 E2E specs; no snapshot tests.
