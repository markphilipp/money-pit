'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { RuleGroupType } from 'react-querybuilder';
import type { CategoryRule } from '@/lib/types';
import { OTHER_ID } from '@/lib/types';
import type { RuleGroup } from '@/lib/rules/types';
import { uniqueRuleId } from '@/lib/rules/naming';
import { nextPaletteColor } from '@/lib/palette';
import { ColorPickerPopover } from '@/components/common/ColorPickerPopover';
import { useAppStore } from '@/store/useAppStore';
import { EMPTY_QUERY, RuleConditionsEditor } from './RuleConditionsEditor';
import { fromRqb, toRqb } from './rqbMap';
import styles from './RuleBuilder.module.css';

interface RuleBuilderModalProps {
  open: boolean;
  onClose: () => void;
  rule?: CategoryRule;
  draft?: { name?: string; conditions: RuleGroup };
}

/** Mounting only while open keeps the draft state fresh for each rule the caller opens. */
export function RuleBuilderModal(props: RuleBuilderModalProps) {
  if (!props.open) return null;
  return <RuleBuilderForm {...props} />;
}

function RuleBuilderForm({ open, onClose, rule, draft }: RuleBuilderModalProps) {
  const rules = useAppStore((s) => s.rules);
  const addRule = useAppStore((s) => s.addRule);
  const setRule = useAppStore((s) => s.setRule);
  const deleteRule = useAppStore((s) => s.deleteRule);

  const initial = rule?.conditions ?? draft?.conditions;
  const [name, setName] = useState(rule?.name ?? draft?.name ?? '');
  const [color, setColor] = useState(rule?.color ?? nextPaletteColor(rules.map((r) => r.color)));
  const [query, setQuery] = useState<RuleGroupType>(initial ? toRqb(initial) : EMPTY_QUERY);

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
    onClose();
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.modal} aria-describedby={undefined}>
          <Dialog.Title className={styles.title}>{rule ? 'Edit rule' : 'New rule'}</Dialog.Title>

          <div className={styles.identity}>
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
            <p className={styles.note}>Fallback — no conditions</p>
          ) : isBuiltin ? (
            <p className={styles.note}>Built-in rule — name and color only</p>
          ) : (
            <RuleConditionsEditor query={query} onQueryChange={setQuery} />
          )}

          <div className={styles.actions}>
            {rule && !isBuiltin && (
              <button
                type="button"
                className={styles.danger}
                onClick={() => {
                  deleteRule(rule.id);
                  onClose();
                }}
              >
                Delete
              </button>
            )}
            <span className={styles.spacer} />
            <button type="button" className="btn-clear" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className={styles.save} onClick={save} disabled={!name.trim()}>
              Save
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
