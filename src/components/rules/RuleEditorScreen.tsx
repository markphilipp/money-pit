'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RuleGroupType } from 'react-querybuilder';
import type { CategoryRule, Transaction } from '@/lib/types';
import { matchCategory } from '@/lib/categorize';
import { matchesGroup } from '@/lib/rules/engine';
import { uniqueRuleId } from '@/lib/rules/naming';
import { suggestRuleGroups } from '@/lib/rules/suggest';
import { fmtMoney, personShort } from '@/lib/format';
import { nextPaletteColor } from '@/lib/palette';
import { ColorPickerPopover } from '@/components/common/ColorPickerPopover';
import { useAppState, useTransactions } from '@/store/hooks';
import { useAppStore, useHydrated } from '@/store/useAppStore';
import { EMPTY_QUERY, RuleConditionsEditor } from './RuleConditionsEditor';
import { RuleForm } from './RuleForm';
import { fromRqb, toRqb } from './rqbMap';
import screen from './RuleScreen.module.css';
import styles from './RuleEditorScreen.module.css';

/** Stands in for the rule being drafted so the preview can honour first-match-wins ordering. */
const DRAFT_ID = '__draft__';

const sameGroup = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

interface PreviewRow {
  txn: Transaction;
  matched: boolean;
  /** The rule that would actually claim the row, when an earlier rule beats the draft. */
  shadowedBy?: CategoryRule;
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

  if (!hydrated) return <main className="wrap" aria-busy="true" />;
  // Reached straight from the rules screen, with nothing selected to induce a rule from.
  if (sourceIds.length === 0) return <RuleForm />;
  return <RuleEditorForm key={sourceIds.join()} sourceIds={sourceIds} />;
}

function RuleEditorForm({ sourceIds }: { sourceIds: string[] }) {
  const router = useRouter();
  const state = useAppState();
  const all = useTransactions();
  const addRule = useAppStore((s) => s.addRule);
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
  const [name, setName] = useState(suggestions[0]?.name ?? '');
  const [color, setColor] = useState(nextPaletteColor(state.rules.map((r) => r.color)));
  const [query, setQuery] = useState<RuleGroupType>(
    suggestions[0] ? toRqb(suggestions[0].group) : EMPTY_QUERY,
  );
  const [alsoClearOverrides, setAlsoClearOverrides] = useState(true);

  const group = useMemo(() => fromRqb(query), [query]);
  const hasConditions = group.rules.length > 0;
  const edited = !!suggestions[active] && !sameGroup(group, suggestions[active].group);

  const preview = useMemo(() => {
    if (!hasConditions) return { selected: [] as PreviewRow[], others: [] as PreviewRow[] };

    const draft: CategoryRule = {
      id: DRAFT_ID,
      name: name || 'New rule',
      color,
      conditions: group,
    };
    const ordered = [
      ...state.rules.filter((r) => !r.builtin),
      draft,
      ...state.rules.filter((r) => r.builtin),
    ];
    const inSource = new Set(sourceIds);

    const toRow = (txn: Transaction): PreviewRow => {
      const matched = matchesGroup(txn, group);
      const winner = matchCategory(txn, ordered);
      return {
        txn,
        matched,
        shadowedBy:
          matched && winner !== DRAFT_ID ? ordered.find((r) => r.id === winner) : undefined,
        overridden: state.overrides[txn.id] != null,
      };
    };

    return {
      selected: sources.map(toRow),
      others: all.filter((t) => !inSource.has(t.id) && matchesGroup(t, group)).map(toRow),
    };
  }, [all, color, group, hasConditions, name, sources, sourceIds, state.overrides, state.rules]);

  const excluded = preview.selected.filter((r) => !r.matched).length;
  const overriddenCount = sources.filter((t) => state.overrides[t.id] != null).length;
  const canSave = !!name.trim() && hasConditions;

  function chooseSuggestion(index: number) {
    setActive(index);
    setQuery(toRqb(suggestions[index].group));
    if (!nameTouched) setName(suggestions[index].name);
  }

  function leave() {
    setRuleSources([]);
    router.push('/');
  }

  function save() {
    const trimmed = name.trim();
    if (!canSave) return;
    addRule({
      id: uniqueRuleId(
        trimmed,
        state.rules.map((r) => r.id),
      ),
      name: trimmed,
      color,
      conditions: group,
    });
    if (alsoClearOverrides && overriddenCount) clearOverrides(sourceIds);
    clearSelection();
    leave();
  }

  return (
    <main className={`wrap ${screen.screen}`}>
      <div className={screen.topBar}>
        <button type="button" className={screen.back} onClick={leave}>
          ← Back
        </button>
        <h1 className={screen.title}>
          New rule from {sources.length} transaction{sources.length === 1 ? '' : 's'}
        </h1>
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
        <div className={screen.identity}>
          <ColorPickerPopover value={color} onChange={setColor} ariaLabel="Rule color" />
          <div className="field">
            <label htmlFor="rule-editor-name">Category name</label>
            <input
              id="rule-editor-name"
              type="text"
              value={name}
              placeholder="e.g. Groceries"
              onChange={(e) => {
                setName(e.target.value);
                setNameTouched(true);
              }}
            />
          </div>
        </div>
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
                ? 'No other transactions match'
                : `Also matches ${preview.others.length} other transaction${
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
        <button type="button" className="btn-clear" onClick={leave}>
          Cancel
        </button>
        <button type="button" className={screen.save} onClick={save} disabled={!canSave}>
          Save rule
        </button>
      </div>
    </main>
  );
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
