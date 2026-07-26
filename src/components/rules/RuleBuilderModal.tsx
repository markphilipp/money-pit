'use client';

import { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { QueryBuilder, type Field, type RuleGroupType } from 'react-querybuilder';
import type { CategoryRule } from '@/lib/types';
import { OTHER_ID } from '@/lib/types';
import type { RuleGroup } from '@/lib/rules/types';
import { nextPaletteColor } from '@/lib/palette';
import { personShort } from '@/lib/format';
import { ColorPickerPopover } from '@/components/common/ColorPickerPopover';
import { usePersons } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { fromRqb, toRqb } from './rqbMap';
import styles from './RuleBuilder.module.css';

interface RuleBuilderModalProps {
  open: boolean;
  onClose: () => void;
  rule?: CategoryRule;
  draft?: { name?: string; conditions: RuleGroup };
}

const TEXT_OPERATORS = [
  { name: 'contains', label: 'contains' },
  { name: 'notContains', label: 'does not contain' },
  { name: 'equals', label: 'is' },
  { name: 'beginsWith', label: 'starts with' },
  { name: 'endsWith', label: 'ends with' },
  { name: 'regex', label: 'matches regex' },
  { name: 'glob', label: 'matches pattern' },
];

const NUMBER_OPERATORS = [
  { name: 'eq', label: '=' },
  { name: 'neq', label: '≠' },
  { name: 'lt', label: '<' },
  { name: 'lte', label: '≤' },
  { name: 'gt', label: '>' },
  { name: 'gte', label: '≥' },
  { name: 'between', label: 'between' },
];

const DATE_OPERATORS = [
  { name: 'on', label: 'on' },
  { name: 'before', label: 'before' },
  { name: 'after', label: 'after' },
  { name: 'between', label: 'between' },
];

const PERSON_OPERATORS = [
  { name: 'is', label: 'is' },
  { name: 'isNot', label: 'is not' },
];

const EMPTY_QUERY: RuleGroupType = { combinator: 'and', rules: [] };

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'category'
  );
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
  const persons = usePersons();

  const initial = rule?.conditions ?? draft?.conditions;
  const [name, setName] = useState(rule?.name ?? draft?.name ?? '');
  const [color, setColor] = useState(rule?.color ?? nextPaletteColor(rules.map((r) => r.color)));
  const [query, setQuery] = useState<RuleGroupType>(initial ? toRqb(initial) : EMPTY_QUERY);

  const fields = useMemo<Field[]>(
    () => [
      {
        name: 'description',
        label: 'Description',
        operators: TEXT_OPERATORS,
        defaultOperator: 'contains',
      },
      {
        name: 'amount',
        label: 'Amount',
        inputType: 'number',
        operators: NUMBER_OPERATORS,
        defaultOperator: 'gte',
      },
      {
        name: 'person',
        label: 'Person',
        operators: PERSON_OPERATORS,
        defaultOperator: 'is',
        valueEditorType: 'select',
        values: persons.map((p) => ({ name: p.name, label: personShort(p.name) })),
      },
      {
        name: 'date',
        label: 'Date',
        inputType: 'date',
        operators: DATE_OPERATORS,
        defaultOperator: 'on',
      },
    ],
    [persons],
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
      let id = slugify(trimmed);
      while (rules.some((r) => r.id === id)) id = `${id}-1`;
      addRule({ id, name: trimmed, color, conditions });
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
            <div className={styles.builder}>
              <QueryBuilder
                fields={fields}
                query={query}
                onQueryChange={setQuery}
                controlClassnames={{
                  queryBuilder: styles.qb,
                  ruleGroup: styles.group,
                  header: styles.groupHeader,
                  body: styles.groupBody,
                  rule: styles.rule,
                  combinators: styles.select,
                  fields: styles.select,
                  operators: styles.select,
                  value: styles.value,
                  addRule: styles.addBtn,
                  addGroup: styles.addBtn,
                  removeRule: styles.iconBtn,
                  removeGroup: styles.iconBtn,
                }}
              />
            </div>
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
