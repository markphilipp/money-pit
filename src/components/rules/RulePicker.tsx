'use client';

import { useId, useMemo, useState } from 'react';
import type { Category, Rule } from '@/lib/types';
import { describeGroup } from '@/lib/rules/engine';
import { searchRules } from '@/lib/rules/search';
import styles from './RulePicker.module.css';

interface Props {
  rules: Rule[];
  labels: Map<string, string>;
  categories: Category[];
  value: string | null;
  onChange: (ruleId: string) => void;
  autoFocus?: boolean;
}

/** Searches existing rules by label or conditions and picks one. */
export function RulePicker({ rules, labels, categories, value, onChange, autoFocus }: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(!!autoFocus);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);

  const colors = useMemo(() => new Map(categories.map((c) => [c.id, c.color])), [categories]);
  const options = useMemo(() => searchRules(rules, labels, query), [rules, labels, query]);
  const active = open ? options[highlight] : undefined;

  const close = () => {
    setOpen(false);
    setQuery('');
    setHighlight(0);
  };

  const choose = (ruleId: string) => {
    onChange(ruleId);
    close();
  };

  return (
    <div className={`field ${styles.picker}`}>
      <label htmlFor={`${id}-input`}>Existing rule</label>
      <input
        id={`${id}-input`}
        type="text"
        role="combobox"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder="Search rules…"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active ? `${id}-option-${active.id}` : undefined}
        value={open ? query : value ? (labels.get(value) ?? '') : ''}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={close}
        onChange={(e) => {
          setOpen(true);
          setQuery(e.target.value);
          setHighlight(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!open) setOpen(true);
            else setHighlight((h) => Math.min(h + 1, options.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (open && options[highlight]) choose(options[highlight].id);
          } else if (e.key === 'Escape' && open) {
            e.preventDefault();
            close();
          }
        }}
      />
      {open && (
        <div
          id={listId}
          className={styles.list}
          role="listbox"
          aria-label="Existing rules"
          onMouseDown={(e) => e.preventDefault()}
        >
          {options.length === 0 && <p className={styles.empty}>No matching rule</p>}
          {options.map((rule, i) => (
            <button
              key={rule.id}
              id={`${id}-option-${rule.id}`}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={rule.id === value}
              className={`${styles.item} ${i === highlight ? styles.hl : ''}`}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => choose(rule.id)}
            >
              <span className={styles.dot} style={{ background: colors.get(rule.categoryId) }} />
              <span className={styles.name}>{labels.get(rule.id)}</span>
              <span className={styles.summary}>{describeGroup(rule.conditions)}</span>
              {rule.id === value && (
                <span className={styles.check} aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
