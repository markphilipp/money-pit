# Data model & domain logic

Everything in `src/lib/` is pure and React-free. This is where business rules go, and it carries
most of the unit-test weight.

## Types — `src/lib/types.ts`

`RawStatementRow` is the persisted shape: six raw strings, straight off the CSV, nothing coerced.
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

## Categorization — `src/lib/categorize.ts`

`toTransactions(rows, rules, overrides)` is the whole derivation. Precedence:

1. A manual override wins — unless it points at a rule that no longer exists, in which case the row
   falls back to `other` (deleting a rule can't strand a row on a dead category).
2. Otherwise the **first** rule whose conditions match, in array order.
3. Otherwise `other`.

`parseAmount` takes `debit` if non-zero, else `credit`; credits are negative in the CSV, so
`amount < 0` means `isCredit`. `parseDate` reads `MM/DD/YYYY` as a local date.

## Rules — `src/lib/rules/`

A rule is `{ id, name, color, conditions: RuleGroup, builtin? }`. `RuleGroup` is a recursive
`{ combinator: 'and' | 'or', rules: (Condition | RuleGroup)[] }` — arbitrarily nested, edited in the
UI through react-querybuilder (`src/components/rules/rqbMap.ts` maps between the two shapes).

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
- An **empty group matches nothing** (`matchesGroup` returns false). That's how the builtin `other`
  rule works — it has no conditions and is only reached by the `?? OTHER_ID` fallback.
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
recolorable, but not deletable, and always pinned last so user rules get first look at every row.

## Formatting & color

- `format.ts` — `fmtMoney` (US, minus sign is U+2212), `personShort` (first name, title-cased).
- `palette.ts` — 20-color category palette; `nextPaletteColor(used)` picks the first unused one.
- Cardholder colors are separate (`PERSON_COLORS` in `src/store/selectors.ts`).
