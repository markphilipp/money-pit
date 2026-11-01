'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RuleGroupType } from 'react-querybuilder';
import type { Category, Rule, Transaction } from '@/lib/types';
import { resolveCategoryChoice, ruleLabels, type CategoryChoice } from '@/lib/categories';
import { matchRule } from '@/lib/categorize';
import { matchesGroup } from '@/lib/rules/engine';
import { mergeConditions } from '@/lib/rules/merge';
import { newRuleId } from '@/lib/rules/naming';
import { suggestRuleGroups } from '@/lib/rules/suggest';
import type { RuleGroup } from '@/lib/rules/types';
import { fmtMoney, personShort } from '@/lib/format';
import { nextPaletteColor } from '@/lib/palette';
import { useAppState, useTransactions } from '@/store/hooks';
import { useAppStore, useHydrated } from '@/store/useAppStore';
import { CategoryField } from './CategoryField';
import { EMPTY_QUERY, RuleConditionsEditor } from './RuleConditionsEditor';
import { Breadcrumb } from '@/components/settings/Breadcrumb';
import { RuleForm } from './RuleForm';
import { RulePicker } from './RulePicker';
import { fromRqb, toRqb } from './rqbMap';
import screen from './RuleScreen.module.css';
import styles from './RuleEditorScreen.module.css';

/** Stands in for the rule being drafted so the preview can honour first-match-wins ordering. */
const DRAFT_ID = '__draft__';

const sameGroup = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Whether the draft becomes a rule of its own or widens one that already exists. */
type RuleTarget = { kind: 'new' } | { kind: 'existing'; ruleId: string | null };

interface PreviewRow {
  txn: Transaction;
  matched: boolean;
  /** Where the row stays, when an earlier rule beats the draft to it. */
  shadowedBy?: Category;
  overridden: boolean;
}

/**
 * The route decides that this screen is showing; the store only carries which transactions the
 * rule is being induced from. Remounting on a change of sources keeps the drafted name, colour
 * and conditions from leaking between two runs of the flow.
 */
export function RuleEditorScreen() {
  const hydrated = useHydrated();
  const sourceIds = useAppStore((s) => s.ruleSources);

  if (!hydrated) return <div aria-busy="true" />;
  // Reached straight from the rules screen, with nothing selected to induce a rule from.
  if (sourceIds.length === 0) return <RuleForm />;
  return <RuleEditorForm key={sourceIds.join()} sourceIds={sourceIds} />;
}

function RuleEditorForm({ sourceIds }: { sourceIds: string[] }) {
  const router = useRouter();
  const state = useAppState();
  const all = useTransactions();
  const addCategory = useAppStore((s) => s.addCategory);
  const addRule = useAppStore((s) => s.addRule);
  const setRule = useAppStore((s) => s.setRule);
  const clearOverrides = useAppStore((s) => s.clearOverrides);
  const setRuleSources = useAppStore((s) => s.setRuleSources);
  const clearSelection = useAppStore((s) => s.clearSelection);

  const sources = useMemo(() => {
    const byId = new Map(all.map((t) => [t.id, t]));
    return sourceIds.map((id) => byId.get(id)).filter((t): t is Transaction => !!t);
  }, [all, sourceIds]);

  const suggestions = useMemo(() => suggestRuleGroups(sources, all), [sources, all]);

  const [active, setActive] = useState(0);
  const [nameTouched, setNameTouched] = useState(false);
  const [choice, setChoice] = useState<CategoryChoice>({
    kind: 'new',
    name: suggestions[0]?.name ?? '',
    color: nextPaletteColor(state.categories.map((c) => c.color)),
  });
  const [query, setQuery] = useState<RuleGroupType>(
    suggestions[0] ? toRqb(suggestions[0].group) : EMPTY_QUERY,
  );
  const [target, setTarget] = useState<RuleTarget>({ kind: 'new' });
  const [alsoClearOverrides, setAlsoClearOverrides] = useState(true);

  const userRules = useMemo(() => state.rules.filter((r) => !r.builtin), [state.rules]);
  const labels = useMemo(
    () => ruleLabels(state.rules, state.categories),
    [state.rules, state.categories],
  );
  const adding = target.kind === 'existing' && userRules.length > 0;
  const targetRule =
    adding && target.ruleId ? userRules.find((r) => r.id === target.ruleId) : undefined;
  const awaitingRule = adding && !targetRule;
  const categoryChoice: CategoryChoice = targetRule
    ? { kind: 'existing', id: targetRule.categoryId }
    : choice;

  const group = useMemo(() => fromRqb(query), [query]);
  const hasConditions = group.rules.length > 0;
  const seed = suggestions[active] && seedGroup(targetRule, suggestions[active].group);
  const edited = !!seed && !sameGroup(group, seed);
  const resolved = awaitingRule ? null : resolveCategoryChoice(categoryChoice, state.categories);
  const categoryId = resolved?.category.id;

  const preview = useMemo(() => {
    if (!hasConditions) return { selected: [] as PreviewRow[], others: [] as PreviewRow[] };

    const draft: Rule = { id: DRAFT_ID, categoryId: categoryId ?? DRAFT_ID, conditions: group };
    const categoriesById = new Map(state.categories.map((c) => [c.id, c]));
    const ordered = targetRule
      ? state.rules.map((r) => (r.id === targetRule.id ? draft : r))
      : [...state.rules.filter((r) => !r.builtin), draft, ...state.rules.filter((r) => r.builtin)];
    const inSource = new Set(sourceIds);

    const toRow = (txn: Transaction): PreviewRow => {
      const matched = matchesGroup(txn, group);
      const winner = matchRule(txn, ordered);
      return {
        txn,
        matched,
        shadowedBy:
          matched && winner && winner.id !== DRAFT_ID && winner.categoryId !== draft.categoryId
            ? categoriesById.get(winner.categoryId)
            : undefined,
        overridden: state.overrides[txn.id] != null,
      };
    };

    return {
      selected: sources.map(toRow),
      others: all
        .filter(
          (t) =>
            !inSource.has(t.id) &&
            matchesGroup(t, group) &&
            !(targetRule && matchesGroup(t, targetRule.conditions)),
        )
        .map(toRow),
    };
  }, [
    all,
    categoryId,
    group,
    hasConditions,
    sources,
    sourceIds,
    targetRule,
    state.categories,
    state.overrides,
    state.rules,
  ]);

  const excluded = preview.selected.filter((r) => !r.matched).length;
  const overriddenCount = sources.filter((t) => state.overrides[t.id] != null).length;
  const canSave = !!resolved && hasConditions;

  function chooseSuggestion(index: number) {
    setActive(index);
    setQuery(toRqb(seedGroup(targetRule, suggestions[index].group)));
    if (!nameTouched && choice.kind === 'new')
      setChoice({ ...choice, name: suggestions[index].name });
  }

  function chooseTarget(next: RuleTarget) {
    const rule =
      next.kind === 'existing' && next.ruleId
        ? userRules.find((r) => r.id === next.ruleId)
        : undefined;
    setTarget(next);
    setQuery(
      suggestions[active]
        ? toRqb(seedGroup(rule, suggestions[active].group))
        : rule
          ? toRqb(rule.conditions)
          : EMPTY_QUERY,
    );
  }

  function leave() {
    setRuleSources([]);
    router.push('/');
  }

  function save() {
    if (!resolved || !hasConditions) return;
    if (targetRule) {
      setRule(targetRule.id, { conditions: group });
    } else {
      const { category, isNew } = resolved;
      if (isNew) addCategory(category);
      addRule({
        id: newRuleId(state.rules.map((r) => r.id)),
        categoryId: category.id,
        conditions: group,
      });
    }
    if (alsoClearOverrides && overriddenCount) clearOverrides(sourceIds);
    clearSelection();
    leave();
  }

  return (
    <div className={screen.screen}>
      <div className={screen.topBar}>
        <Breadcrumb
          parent={{ label: 'Rules', href: '/settings/rules' }}
          current={adding ? 'Add to rule' : 'New rule'}
          onNavigate={() => setRuleSources([])}
        />
        <h2 className={screen.title}>
          {adding
            ? `Add ${sources.length} transaction${sources.length === 1 ? '' : 's'} to ${
                targetRule
                  ? `${state.categories.find((c) => c.id === targetRule.categoryId)?.name ?? 'the'} rule`
                  : 'an existing rule'
              }`
            : `New rule from ${sources.length} transaction${sources.length === 1 ? '' : 's'}`}
        </h2>
      </div>

      {suggestions.length > 0 && (
        <section className={`card ${screen.section}`}>
          <h2>Suggested rules</h2>
          <p className="sub">Pick a starting point, then refine it below.</p>
          <ul className={styles.cards}>
            {suggestions.map((suggestion, i) => (
              <li key={suggestion.kind + suggestion.label}>
                <button
                  type="button"
                  className={`${styles.card} ${i === active ? styles.cardActive : ''}`}
                  aria-pressed={i === active}
                  onClick={() => chooseSuggestion(i)}
                >
                  <span className={styles.cardLabel}>{suggestion.label}</span>
                  <span className={styles.cardMeta}>
                    matches all {suggestion.selectedMatched} selected
                    {suggestion.othersMatched > 0
                      ? ` + ${suggestion.othersMatched} other${suggestion.othersMatched === 1 ? '' : 's'}`
                      : ' + 0 others'}
                  </span>
                  {i === active && edited && <span className={styles.cardEdited}>edited</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={`card ${screen.section}`}>
        <h2>Rule</h2>
        {userRules.length > 0 && (
          <div className={styles.targetRow}>
            <div role="radiogroup" aria-label="Rule target" className={styles.segmented}>
              <label className={styles.segment}>
                <input
                  type="radio"
                  name="rule-target"
                  checked={!adding}
                  onChange={() => chooseTarget({ kind: 'new' })}
                />
                New rule
              </label>
              <label className={styles.segment}>
                <input
                  type="radio"
                  name="rule-target"
                  checked={adding}
                  onChange={() => chooseTarget({ kind: 'existing', ruleId: null })}
                />
                Add to existing rule
              </label>
            </div>
            {adding && (
              <RulePicker
                rules={userRules}
                labels={labels}
                categories={state.categories}
                value={targetRule?.id ?? null}
                onChange={(ruleId) => chooseTarget({ kind: 'existing', ruleId })}
                autoFocus
              />
            )}
          </div>
        )}
        {awaitingRule ? (
          <p className={screen.note}>
            Choose a rule — its category is used for these transactions.
          </p>
        ) : (
          <CategoryField
            categories={state.categories}
            disabled={!!targetRule}
            value={categoryChoice}
            onChange={(next) => {
              if (next.kind === 'new' && choice.kind === 'new' && next.name !== choice.name) {
                setNameTouched(true);
              }
              setChoice(next);
            }}
            placeholder="e.g. Groceries"
          />
        )}
        <RuleConditionsEditor query={query} onQueryChange={setQuery} />
      </section>

      <section className={`card ${screen.section}`}>
        <h2>Matches</h2>
        {!hasConditions ? (
          <p className={screen.empty}>Add a condition to preview what this rule will match.</p>
        ) : (
          <>
            {excluded > 0 && (
              <p role="alert" className={styles.warning}>
                {excluded} of the {preview.selected.length} transactions you selected will NOT match
                this rule.
              </p>
            )}

            <h3 className={styles.subhead}>Selected transactions ({preview.selected.length})</h3>
            <PreviewTable rows={preview.selected} />

            <h3 className={styles.subhead}>
              {preview.others.length === 0
                ? `No other transactions ${targetRule ? 'newly ' : ''}match`
                : `Also ${targetRule ? 'newly ' : ''}matches ${preview.others.length} other transaction${
                    preview.others.length === 1 ? '' : 's'
                  }`}
            </h3>
            {preview.others.length > 0 && <PreviewTable rows={preview.others} muted />}
          </>
        )}
      </section>

      <div className={screen.actions}>
        {overriddenCount > 0 && (
          <label className="toggle">
            <input
              type="checkbox"
              checked={alsoClearOverrides}
              onChange={(e) => setAlsoClearOverrides(e.target.checked)}
            />
            Clear {overriddenCount} manual categor{overriddenCount === 1 ? 'y' : 'ies'} so this rule
            applies
          </label>
        )}
        <span className={screen.spacer} />
        <button type="button" className="btn-clear" onClick={() => leave()}>
          Cancel
        </button>
        <button type="button" className={screen.save} onClick={save} disabled={!canSave}>
          Save rule
        </button>
      </div>
    </div>
  );
}

/** What the builder starts from for a suggestion: as drafted, or folded into the rule being widened. */
function seedGroup(rule: Rule | undefined, suggestion: RuleGroup): RuleGroup {
  return rule ? mergeConditions(rule.conditions, suggestion) : suggestion;
}

function PreviewTable({ rows, muted }: { rows: PreviewRow[]; muted?: boolean }) {
  if (!rows.length) return <p className={screen.empty}>Nothing here.</p>;
  return (
    <div className={styles.tableWrap}>
      <table className={`${styles.table} ${muted ? styles.mutedTable : ''}`}>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Description</th>
            <th scope="col">Person</th>
            <th scope="col" className={styles.right}>
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.txn.id} className={row.matched ? undefined : styles.excludedRow}>
              <td>
                <span className={row.matched ? undefined : styles.struck}>{row.txn.dateStr}</span>
              </td>
              <td>
                <span className={row.matched ? undefined : styles.struck}>
                  {row.txn.description}
                </span>
                {!row.matched ? (
                  <span className={styles.tagWarn}>will not match</span>
                ) : row.overridden ? (
                  // A manual category beats every rule, so the draft cannot claim this row yet.
                  <span className={styles.tagWarn}>manual category wins</span>
                ) : row.shadowedBy ? (
                  <span className={styles.tag}>stays in {row.shadowedBy.name}</span>
                ) : null}
              </td>
              <td>
                <span className={row.matched ? undefined : styles.struck}>
                  {personShort(row.txn.person)}
                </span>
              </td>
              <td className={styles.right}>
                <span className={row.matched ? undefined : styles.struck}>
                  {fmtMoney(row.txn.amount)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
