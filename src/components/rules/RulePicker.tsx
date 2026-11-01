'use client';

import { useCallback } from 'react';
import type { Category, Rule } from '@/lib/types';
import { describeGroup } from '@/lib/rules/engine';
import { searchRules } from '@/lib/rules/search';
import { SearchableListbox } from '@/components/common/SearchableListbox';
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
  const search = useCallback((query: string) => searchRules(rules, labels, query), [rules, labels]);
  const colors = new Map(categories.map((c) => [c.id, c.color]));

  return (
    <SearchableListbox
      search={search}
      getKey={(rule) => rule.id}
      getColor={(rule) => colors.get(rule.categoryId)}
      renderOption={(rule) => (
        <>
          <span className={styles.name}>{labels.get(rule.id)}</span>
          <span className={styles.summary}>{describeGroup(rule.conditions)}</span>
        </>
      )}
      isSelected={(rule) => rule.id === value}
      onChoose={(rule) => onChange(rule.id)}
      label="Existing rule"
      listLabel="Existing rules"
      placeholder="Search rules…"
      emptyText="No matching rule"
      placement={{
        kind: 'inline',
        selectedLabel: value ? (labels.get(value) ?? '') : '',
        autoFocus,
      }}
    />
  );
}
