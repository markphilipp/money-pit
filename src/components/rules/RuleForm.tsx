'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { RuleGroupType } from 'react-querybuilder';
import type { CategoryRule } from '@/lib/types';
import { OTHER_ID } from '@/lib/types';
import type { RuleGroup } from '@/lib/rules/types';
import { uniqueRuleId } from '@/lib/rules/naming';
import { nextPaletteColor } from '@/lib/palette';
import { ColorPickerPopover } from '@/components/common/ColorPickerPopover';
import { useAppStore, useHydrated } from '@/store/useAppStore';
import { EMPTY_QUERY, RuleConditionsEditor } from './RuleConditionsEditor';
import { fromRqb, toRqb } from './rqbMap';
import screen from './RuleScreen.module.css';

/**
 * Writes one rule by hand — `/rules/[id]` to edit an existing one, or `/rules/new` when there is
 * no selection to induce a rule from. Rules only exist in sessionStorage, so which rule an id
 * refers to is not knowable until after hydration.
 */
export function RuleForm({ ruleId }: { ruleId?: string }) {
  const hydrated = useHydrated();
  const rules = useAppStore((s) => s.rules);

  if (!hydrated) return <main className="wrap" aria-busy="true" />;

  const rule = ruleId ? rules.find((r) => r.id === ruleId) : undefined;
  if (ruleId && !rule) return <MissingRule ruleId={ruleId} />;

  return <RuleFormFields key={rule?.id ?? 'new'} rule={rule} />;
}

function MissingRule({ ruleId }: { ruleId: string }) {
  return (
    <main className={`wrap ${screen.screen}`}>
      <div className={screen.topBar}>
        <Link href="/rules" className={screen.back}>
          ← All rules
        </Link>
        <h1 className={screen.title}>Rule not found</h1>
      </div>
      <section className={`card ${screen.section}`}>
        <p className={screen.empty}>
          There is no rule called “{ruleId}”. It may have been deleted, or this link may be from a
          different session — rules live in this tab only.
        </p>
      </section>
    </main>
  );
}

function RuleFormFields({ rule }: { rule?: CategoryRule }) {
  const router = useRouter();
  const rules = useAppStore((s) => s.rules);
  const addRule = useAppStore((s) => s.addRule);
  const setRule = useAppStore((s) => s.setRule);
  const deleteRule = useAppStore((s) => s.deleteRule);

  const [name, setName] = useState(rule?.name ?? '');
  const [color, setColor] = useState(rule?.color ?? nextPaletteColor(rules.map((r) => r.color)));
  const [query, setQuery] = useState<RuleGroupType>(
    rule?.conditions ? toRqb(rule.conditions) : EMPTY_QUERY,
  );

  const isBuiltin = !!rule?.builtin;
  const isFallback = rule?.id === OTHER_ID;

  function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const conditions = isBuiltin ? (rule!.conditions as RuleGroup) : fromRqb(query);

    if (rule) {
      setRule(rule.id, { name: trimmed, color, conditions });
    } else {
      addRule({
        id: uniqueRuleId(
          trimmed,
          rules.map((r) => r.id),
        ),
        name: trimmed,
        color,
        conditions,
      });
    }
    router.push('/rules');
  }

  return (
    <main className={`wrap ${screen.screen}`}>
      <div className={screen.topBar}>
        <Link href="/rules" className={screen.back}>
          ← All rules
        </Link>
        <h1 className={screen.title}>{rule ? `Edit ${rule.name}` : 'New rule'}</h1>
      </div>

      <section className={`card ${screen.section}`}>
        <div className={screen.identity}>
          <ColorPickerPopover value={color} onChange={setColor} ariaLabel="Rule color" />
          <div className="field">
            <label htmlFor="rule-name">Category name</label>
            <input
              id="rule-name"
              type="text"
              value={name}
              placeholder="e.g. Travel"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>

        {isFallback ? (
          <p className={screen.note}>Fallback — no conditions</p>
        ) : isBuiltin ? (
          <p className={screen.note}>Built-in rule — name and color only</p>
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
              router.push('/rules');
            }}
          >
            Delete
          </button>
        )}
        <span className={screen.spacer} />
        <Link href="/rules" className="btn-clear">
          Cancel
        </Link>
        <button type="button" className={screen.save} onClick={save} disabled={!name.trim()}>
          Save
        </button>
      </div>
    </main>
  );
}
