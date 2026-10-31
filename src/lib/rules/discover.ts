import { OTHER_ID, type Transaction } from '../types';
import { matchesGroup } from './engine';
import { clusterByContent, suggestRuleGroups } from './suggest';
import type { RuleGroup } from './types';

export interface RuleProposal {
  /** Canonical id of the pattern, stable across uploads; what a dismissal remembers. */
  key: string;
  group: RuleGroup;
  label: string;
  /** Category name guess. */
  name: string;
  /** Every Other-pool transaction the group matches, not just the cluster it was induced from. */
  txnIds: string[];
  samples: string[];
}

export const MIN_CLUSTER = 3;
const MAX_SAMPLES = 3;
/** Dismissed keys are persisted, and the account schema bounds their length. */
export const MAX_KEY_LENGTH = 500;
export const MAX_DISMISSED = 500;

function keyOf(group: RuleGroup): string {
  const parts = group.rules.flatMap((node) =>
    'combinator' in node
      ? []
      : [`${node.field}.${node.operator}:${String(node.value).toLowerCase()}`],
  );
  return JSON.stringify(parts.sort());
}

/**
 * Description-only rules worth offering for the Other pool: rows no rule claimed and no override
 * moved. Derived on every call from what is already stored, so an upload re-checks for free.
 */
export function discoverProposals(
  txns: Transaction[],
  overrides: Record<string, string>,
  dismissed: ReadonlySet<string>,
): RuleProposal[] {
  const pool = txns.filter((t) => t.categoryId === OTHER_ID && overrides[t.id] === undefined);
  if (pool.length < MIN_CLUSTER) return [];
  const poolIds = new Set(pool.map((t) => t.id));

  // Recurring merchants repeat descriptions verbatim; clustering the distinct ones keeps it cheap.
  const byDescription = new Map<string, Transaction[]>();
  for (const t of pool) {
    const description = t.description.trim();
    const rows = byDescription.get(description);
    if (rows) rows.push(t);
    else byDescription.set(description, [t]);
  }
  const distinct = [...byDescription].map(([description, rows]) => ({ description, rows }));

  const seen = new Set<string>();
  const proposals: RuleProposal[] = [];
  for (const cluster of clusterByContent(distinct)) {
    const rows = cluster.flatMap((c) => c.rows);
    if (rows.length < MIN_CLUSTER) continue;

    const candidate = suggestRuleGroups(rows, rows).find((s) => s.kind !== 'exact-or');
    if (!candidate) continue;

    const key = keyOf(candidate.group);
    if (seen.has(key)) continue;
    seen.add(key);
    if (dismissed.has(key) || key.length > MAX_KEY_LENGTH) continue;

    const matched: Transaction[] = [];
    let stealsCategorized = false;
    for (const t of txns) {
      if (!matchesGroup(t, candidate.group)) continue;
      if (!poolIds.has(t.id)) {
        stealsCategorized = true;
        break;
      }
      matched.push(t);
    }
    if (stealsCategorized) continue;

    proposals.push({
      key,
      group: candidate.group,
      label: candidate.label,
      name: candidate.name,
      txnIds: matched.map((t) => t.id),
      samples: [...new Set(matched.map((t) => t.description.trim()))].slice(0, MAX_SAMPLES),
    });
  }

  return proposals.sort(
    (a, b) => b.txnIds.length - a.txnIds.length || a.label.localeCompare(b.label),
  );
}
