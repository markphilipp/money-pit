'use client';

import { useMemo } from 'react';
import { QueryBuilder, type Field, type RuleGroupType } from 'react-querybuilder';
import { personShort } from '@/lib/format';
import { usePersons } from '@/store/hooks';
import styles from './RuleBuilder.module.css';

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

export const EMPTY_QUERY: RuleGroupType = { combinator: 'and', rules: [] };

interface RuleConditionsEditorProps {
  query: RuleGroupType;
  onQueryChange: (query: RuleGroupType) => void;
}

/** The react-querybuilder setup shared by the rule modal and the rule editor screen. */
export function RuleConditionsEditor({ query, onQueryChange }: RuleConditionsEditorProps) {
  const persons = usePersons();

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

  return (
    <div className={styles.builder}>
      <QueryBuilder
        fields={fields}
        query={query}
        onQueryChange={onQueryChange}
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
  );
}
