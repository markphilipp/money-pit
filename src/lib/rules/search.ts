import type { Rule } from '@/lib/types';
import { describeGroupFull } from './engine';

/**
 * Rules whose label or full conditions text contains the query, case-insensitively, in their
 * original order. Searching the uncapped description means a term past the list's 80-char summary
 * still finds its rule.
 */
export function searchRules(rules: Rule[], labels: Map<string, string>, query: string): Rule[] {
  const q = query.trim().toLowerCase();
  if (!q) return rules;
  return rules.filter(
    (rule) =>
      (labels.get(rule.id) ?? '').toLowerCase().includes(q) ||
      describeGroupFull(rule.conditions).toLowerCase().includes(q),
  );
}
