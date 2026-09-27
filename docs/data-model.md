# Data model & domain logic

Everything in `src/lib/` is pure and React-free. This is where business rules go, and it carries
most of the unit-test weight.

## Types — `src/lib/types.ts`

`RawStatementRow` is the persisted shape: six raw strings, straight off the CSV, nothing coerced.
It goes to `sessionStorage` when signed out and to the `statement_row` table when signed in.
`Transaction` is the derived shape (parsed `Date`, signed `amount`, `isCredit`, `categoryId`).
Two ids are reserved as constants: `PAYMENTS_ID = 'payments'` and `OTHER_ID = 'other'`.

## CSV parsing — `src/lib/csv.ts`

Header must match `EXPECTED_HEADER` exactly (case-insensitive, extra trailing columns tolerated):

```
Status,Date,Description,Debit,Credit,Member Name
```

Anything else throws `CsvFormatError` with a message naming what was found — that message is shown
to the user verbatim, so keep it human. A BOM is stripped; blank lines are dropped.

### Dedupe on re-upload — `mergeRows`

Statement exports overlap at period boundaries, so the same row appearing in a _different_ file is a
duplicate — but two identical rows _within one file_ are two real charges. Dedupe is therefore
per-key **multiplicity**: keep the highest count seen in any single file, never the sum across
files. Re-uploading the same file is a no-op; uploading an overlapping month adds only the new rows.

## Ids — `src/lib/hash.ts`

- `rowKey(row)` — `date|description|debit|credit|person`, the dedupe key.
- `txnId(row, ordinal)` — FNV-1a of the row key + description + a per-key ordinal, so genuine
  same-day duplicate charges get distinct stable ids.

Ids must stay stable across reloads: `overrides` is keyed by `txnId`, so changing the hash inputs
orphans every manual correction in an existing session.

## Categories and rules — `src/lib/types.ts`, `src/lib/categories.ts`

`Category { id, name, color, builtin? }` is what a transaction is filed under; `Rule { id,
categoryId, conditions: RuleGroup, builtin? }` is what files it there. Several rules can point at
one category — `payments` and `other` are `builtin: true` (renameable, recolorable, not deletable),
and `other` has no rule of its own: it's the fallback nothing else claims, not a matchable rule.
`Categorization { categories, rules }` is the pair, saved and synced as one unit.

`src/lib/categories.ts` is where category-level operations live, since they cut across both lists:

- `categoryUsage` / `deletionImpact` — how many rules and transactions a category holds, and the
  split between rows a rule filed there versus rows a manual override put there, for the warning
  shown before a delete.
- `removeCategory` — drops a category, every rule that files into it, and every override pointing
  at it. Refuses a builtin.
- `findCategoryByName` / `resolveCategoryChoice` — case-insensitive name lookup, so typing an
  existing category's name into a "new category" field reuses it instead of creating a lookalike.
  Used by the rule screens' category field and the categories screen's add form.
- `ruleLabels` — names a rule after its category, numbered when the category has more than one
  rule, so every row in the rules list keeps a distinct accessible name.
- `upgradeLegacyRules` — splits a pre-split rule (a rule that was its own category) into a category
  and a rule sharing its id, so overrides and category filters holding that id keep working with no
  rewrite. An empty-condition legacy rule (the old builtin `other`) becomes a category only.

## Categorization — `src/lib/categorize.ts`

`toTransactions(rows, { categories, rules }, overrides)` is the whole derivation. Precedence:

1. A manual override wins — unless it points at a category that no longer exists, in which case the
   row falls back to `other` (deleting a category can't strand a row on a dead one).
2. Otherwise the **first** rule whose conditions match, in array order, filed under its `categoryId`.
3. Otherwise `other`.

`parseAmount` takes `debit` if non-zero, else `credit`; credits are negative in the CSV, so
`amount < 0` means `isCredit`. `parseDate` reads `MM/DD/YYYY` as a local date.

## Rules — `src/lib/rules/`

`RuleGroup` is a recursive `{ combinator: 'and' | 'or', rules: (Condition | RuleGroup)[] }` —
arbitrarily nested, edited in the UI through react-querybuilder (`src/components/rules/rqbMap.ts`
maps between the two shapes). New rule ids are random (`newRuleId`), not name slugs: several rules
can file into one category, so a slug would collide with another rule of the same name when a
session is claimed into an account. Category ids stay slugs (`uniqueId`), since the same name is
meant to be the same category.

Condition fields and operators (`types.ts`):

| Field         | Operators                                                               |
| ------------- | ----------------------------------------------------------------------- |
| `description` | contains, notContains, equals, beginsWith, endsWith, regex, glob        |
| `amount`      | eq, neq, lt, lte, gt, gte, between — matched against `Math.abs(amount)` |
| `person`      | is, isNot                                                               |
| `date`        | on, before, after, between — values are ISO `yyyy-mm-dd`                |

`engine.ts` notes:

- Text comparisons are case-insensitive; regex/glob compile with the `i` flag.
- **Invalid patterns must never throw.** `compile()` caches per `kind:pattern` and stores `null` for
  a pattern that fails to compile, which then matches nothing. Users type regexes live.
- An **empty group matches nothing** (`matchesGroup` returns false) — an emptied builder means "no
  rule yet," not "a rule that excludes everything."
- Dates compare as local midnights on both sides, so a `between` never drifts by a timezone hour.
- `matchesColumnFilter` reuses the same operator implementations for table column filters, which is
  why filter and rule semantics can't diverge.
- `describeGroup` renders the one-line human summary shown in the rules manager (truncated at 80
  chars). `keywordsToGroup` builds the OR-of-contains group used by the defaults;
  `transactionsToDraftGroup` builds the literal one-condition-per-description fallback.

## Rule suggestions — `src/lib/rules/suggest.ts`

`suggestRuleGroups(selected, all)` induces 1–3 ranked description rules from the transactions the
user selected, always followed by the `exact-or` fallback so "just use the literal descriptions"
stays one click away. Every candidate must match **all** of the selected rows; `othersMatched`
reports how much else in the corpus it would claim. Pure, synchronous and cheap enough to re-run on
every keystroke at this app's scale (hundreds to low-thousands of rows).

Descriptors are tokenized on separators (`* # - _ , ; : | / \ ( ) [ ]`) **keeping raw offsets**,
because the engine does no normalization beyond upper-casing — an induced value has to be a literal
substring of every raw description. Tokens are then classified and the noise dropped:

| Kind      | Rule                                                                         |
| --------- | ---------------------------------------------------------------------------- |
| `marker`  | wallet/processor/POS word (`SQ`, `TST*`, `PAYPAL`, …) in the first 2 slots   |
| `numeric` | all digits/dots — store numbers, phone fragments                             |
| `alnumId` | ≥5 chars mixing letters and digits — order ids like `MKTPL*DEMO1234`         |
| `state`   | 2-letter US state in the last two slots                                      |
| `noise`   | `US`, `COM`, `INC`, … plus the word before a trailing state (the city guess) |
| `word`    | everything else — the content the suggestions are built from                 |

Candidates are the longest contiguous token run every example shares, taken twice: over content
tokens only (`token-core`, ranked first) and over the whole token list (`common-substring`). When
the examples share no run at all, they are clustered by Jaccard overlap of their content tokens
(single-linkage, threshold 0.5, ≤4 clusters) and each cluster contributes one condition to a flat OR
(`or-of-clusters`) — that is how `AMAZON MKTPL*…` and `AMZN Mktp US*…` end up in one rule.

Rejections that keep the output honest:

- A run flanked by another content word is a phrase cut in half — `ONLINE PAYMENT, THANK` out of
  `ONLINE PAYMENT, THANK YOU`. Runs must stop at dropped noise or at the ends of the descriptor.
- A run with no `word` token in it (`CHARLOTTE NC`) is a place, not a merchant.
- Under 4 chars, majority non-letters, or ending in a digit.
- Reproducing a whole descriptor verbatim generalizes nothing, so it falls through to `exact-or`.

Groups are emitted **flat** (a single-level OR) even though the engine supports nesting — nested
groups are hard to read back in the builder, and nothing here needs them.

## Default rules — `src/lib/defaultRules.ts`

Seed categories built from keyword lists. `payments` and `other` are `builtin: true`: renameable and
recolorable, but not deletable; `payments` keeps a rule and is always pinned last so user rules get
first look at every row, and `other` has no rule at all. Every new account gets all of them,
builtins included, from Better Auth's `user.create.after` hook.

## Account schema — `src/db/schema/app.ts`

Signed-in state lives in Postgres, keyed by `user_id` with `ON DELETE CASCADE`. Only raw inputs are
stored, never anything derived.

| Table           | Holds                                                                                                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `statement_row` | One `RawStatementRow` plus its per-key `ordinal` and `category_override`. Unique on the row key + ordinal. `ORDER BY id` is `rawRows` order.                                     |
| `category`      | The category list. `position` is the array index.                                                                                                                                |
| `rule`          | The rule list. A composite FK ties `(user_id, category_id)` to `category`'s primary key, cascading, so a rule can't outlive its category at the database layer either.           |
| `category_rule` | Superseded by `category` + `rule` — one row was a rule that was also its own category. Never written; kept as a read fallback for an account that hasn't saved either table yet. |
| `preference`    | `chart_mode`, `person_chart_mode`, `sort_key`, `sort_dir`.                                                                                                                       |

`src/db/queries/categories.ts` writes `category` and `rule` together: delete + insert both in one
transaction, so position is always the array index and a rule never points at a category not yet
saved. Overrides pointing at a category that's gone are cleared in the same transaction, so a later
category reusing the same id slug can't inherit them. Reading falls back to `category_rule` only
when an account has no `category` rows yet, and upgrades it in memory
(`upgradeLegacyRules`) — the fallback table itself is never migrated in place, so an unmigrated
account keeps reading it until its first save writes the new tables.

There is no `txnId` column and no override table. `txnId` is re-derived from the row and its
ordinal, so a stored copy would orphan every override the day the hash changed. An override is the
`category_override` column on its row, with no FK to categories, because categorization already
treats a missing category id as Other. Dedupe stays `mergeRows` run before the write, never `ON
CONFLICT DO NOTHING`, which would sum across files instead of taking the per-file maximum.

## Claiming a session — `src/lib/claim.ts`

`claimInto(account, local)` folds a signed-out session into an account. Rows go through
`mergeRows`, so overlap is deduped like a second upload. Overrides are keyed by `txnId`, which
survives the merge, and the session's win. An account still on the seeded defaults takes the
session's categories and rules wholesale. Otherwise only the ones whose id the account lacks are
added, ahead of the builtins: category ids are name slugs, so a shared id is the same category and
the account's version stays. Rule conditions read back from `jsonb` lose their key order, so "still
on the defaults" is a structural comparison. Claiming the same session twice changes nothing.

## Formatting & color

- `format.ts` — `fmtMoney` (US, minus sign is U+2212), `personShort` (first name, title-cased).
- `palette.ts` — 20-color category palette; `nextPaletteColor(used)` picks the first unused one.
- Cardholder colors are separate (`PERSON_COLORS` in `src/store/selectors.ts`).
