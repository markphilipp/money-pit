'use client';

import { useContext, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { RuleGroupType } from 'react-querybuilder';
import type { Rule } from '@/lib/types';
import { resolveCategoryChoice, type CategoryChoice } from '@/lib/categories';
import { newRuleId } from '@/lib/rules/naming';
import { nextPaletteColor } from '@/lib/palette';
import { SignedInContext, useAppStore, useHydrated } from '@/store/useAppStore';
import { SettingsHeading } from '@/components/settings/SettingsHeading';
import { CategoryField } from './CategoryField';
import { EMPTY_QUERY, RuleConditionsEditor } from './RuleConditionsEditor';
import { fromRqb, toRqb } from './rqbMap';
import screen from './RuleScreen.module.css';

/**
 * Writes one rule by hand — `/settings/rules/[id]` to edit an existing one, or `/settings/rules/new` when there is
 * no selection to induce a rule from. Rules only exist in sessionStorage, so which rule an id
 * refers to is not knowable until after hydration.
 */
export function RuleForm({ ruleId }: { ruleId?: string }) {
  const hydrated = useHydrated();
  const rules = useAppStore((s) => s.rules);

  if (!hydrated) return <div aria-busy="true" />;

  const rule = ruleId ? rules.find((r) => r.id === ruleId) : undefined;
  if (ruleId && !rule) return <MissingRule ruleId={ruleId} />;

  return <RuleFormFields key={rule?.id ?? 'new'} rule={rule} />;
}

function MissingRule({ ruleId }: { ruleId: string }) {
  const signedIn = useContext(SignedInContext);
  return (
    <div className={screen.screen}>
      <SettingsHeading section="/settings/rules" current="Not found" title="Rule not found" />
      <section className={`card ${screen.section}`}>
        <p className={screen.empty}>
          There is no rule called “{ruleId}”. It may have been deleted, or this link may be from a{' '}
          {signedIn ? 'different account' : 'different session — rules live in this tab only'}.
        </p>
      </section>
    </div>
  );
}

function RuleFormFields({ rule }: { rule?: Rule }) {
  const router = useRouter();
  const categories = useAppStore((s) => s.categories);
  const rules = useAppStore((s) => s.rules);
  const addCategory = useAppStore((s) => s.addCategory);
  const addRule = useAppStore((s) => s.addRule);
  const setRule = useAppStore((s) => s.setRule);
  const deleteRule = useAppStore((s) => s.deleteRule);

  const [choice, setChoice] = useState<CategoryChoice>(
    rule
      ? { kind: 'existing', id: rule.categoryId }
      : { kind: 'new', name: '', color: nextPaletteColor(categories.map((c) => c.color)) },
  );
  const [query, setQuery] = useState<RuleGroupType>(
    rule?.conditions ? toRqb(rule.conditions) : EMPTY_QUERY,
  );

  const isBuiltin = !!rule?.builtin;
  const resolved = resolveCategoryChoice(choice, categories);
  const title = rule
    ? `Edit ${categories.find((c) => c.id === rule.categoryId)?.name ?? 'rule'} rule`
    : 'New rule';

  function save() {
    if (!resolved) return;
    const { category, isNew } = resolved;
    if (isNew) addCategory(category);
    if (rule) {
      // A builtin rule's category is fixed — the field above is disabled, and this form has
      // nothing else of its own to save for one.
      if (!isBuiltin) setRule(rule.id, { categoryId: category.id, conditions: fromRqb(query) });
    } else {
      addRule({
        id: newRuleId(rules.map((r) => r.id)),
        categoryId: category.id,
        conditions: fromRqb(query),
      });
    }
    router.push('/settings/rules');
  }

  return (
    <div className={screen.screen}>
      <SettingsHeading
        section="/settings/rules"
        current={rule ? 'Edit rule' : 'New rule'}
        title={title}
      />

      <section className={`card ${screen.section}`}>
        <CategoryField
          categories={categories}
          value={choice}
          onChange={setChoice}
          placeholder="e.g. Travel"
          disabled={isBuiltin}
        />

        {isBuiltin ? (
          <p className={screen.note}>Built-in rule — conditions are fixed</p>
        ) : (
          <RuleConditionsEditor query={query} onQueryChange={setQuery} />
        )}
      </section>

      <div className={screen.actions}>
        {rule && !isBuiltin && (
          <button
            type="button"
            className={screen.danger}
            onClick={() => {
              deleteRule(rule.id);
              router.push('/settings/rules');
            }}
          >
            Delete
          </button>
        )}
        <span className={screen.spacer} />
        <Link href="/settings/rules" className="btn-clear">
          Cancel
        </Link>
        <button type="button" className={screen.save} onClick={save} disabled={!resolved}>
          Save
        </button>
      </div>
    </div>
  );
}
