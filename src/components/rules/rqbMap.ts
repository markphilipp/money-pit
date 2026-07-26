import type { RuleGroupType, RuleType } from 'react-querybuilder';
import type {
  Condition,
  DateOperator,
  NumberOperator,
  PersonOperator,
  RuleGroup,
  TextOperator,
} from '@/lib/rules/types';

/** react-querybuilder keeps a single `value` per rule, so ranges travel as "low,high". */
const RANGE = 'between';

function conditionToRule(condition: Condition, id: string): RuleType {
  const value =
    condition.operator === RANGE
      ? [condition.value, condition.value2 ?? ''].join(',')
      : condition.value;
  return { id, field: condition.field, operator: condition.operator, value };
}

export function toRqb(group: RuleGroup, id = 'g'): RuleGroupType {
  return {
    id,
    combinator: group.combinator,
    rules: group.rules.map((node, i) =>
      'combinator' in node ? toRqb(node, `${id}-${i}`) : conditionToRule(node, `${id}-${i}`),
    ),
  };
}

function rangeParts(value: unknown): [string, string] {
  const parts = Array.isArray(value) ? value : String(value ?? '').split(',');
  return [String(parts[0] ?? '').trim(), String(parts[1] ?? '').trim()];
}

function ruleToCondition(rule: RuleType): Condition | null {
  const text = String(rule.value ?? '').trim();
  switch (rule.field) {
    case 'description':
      return text
        ? { field: 'description', operator: rule.operator as TextOperator, value: text }
        : null;
    case 'person':
      return text
        ? { field: 'person', operator: rule.operator as PersonOperator, value: text }
        : null;
    case 'amount': {
      if (rule.operator === RANGE) {
        const [lo, hi] = rangeParts(rule.value);
        if (!lo || Number.isNaN(Number(lo))) return null;
        return {
          field: 'amount',
          operator: RANGE,
          value: Number(lo),
          ...(hi && !Number.isNaN(Number(hi)) ? { value2: Number(hi) } : {}),
        };
      }
      return text === '' || Number.isNaN(Number(text))
        ? null
        : { field: 'amount', operator: rule.operator as NumberOperator, value: Number(text) };
    }
    case 'date': {
      if (rule.operator === RANGE) {
        const [lo, hi] = rangeParts(rule.value);
        return lo
          ? { field: 'date', operator: RANGE, value: lo, ...(hi ? { value2: hi } : {}) }
          : null;
      }
      return text ? { field: 'date', operator: rule.operator as DateOperator, value: text } : null;
    }
    default:
      return null;
  }
}

/** Half-finished rules (no value yet) are dropped rather than persisted as never-matching noise. */
export function fromRqb(query: RuleGroupType): RuleGroup {
  const rules: (Condition | RuleGroup)[] = [];
  for (const node of query.rules) {
    if (typeof node === 'string') continue;
    if ('rules' in node) {
      const group = fromRqb(node as RuleGroupType);
      if (group.rules.length) rules.push(group);
      continue;
    }
    const condition = ruleToCondition(node);
    if (condition) rules.push(condition);
  }
  return { combinator: query.combinator === 'or' ? 'or' : 'and', rules };
}
