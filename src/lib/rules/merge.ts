import type { RuleGroup } from './types';

type Node = RuleGroup['rules'][number];

const sameNode = (a: Node, b: Node) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Folds `addition` into an existing rule's conditions so the result matches everything either did.
 * An `or` group is extended in place of nesting; an `and` group becomes one branch of a new `or`.
 * Nodes already present are skipped, so adding the same thing twice changes nothing.
 */
export function mergeConditions(existing: RuleGroup, addition: RuleGroup): RuleGroup {
  if (!existing.rules.length) return addition;
  if (!addition.rules.length) return existing;

  const incoming = addition.combinator === 'or' ? addition.rules : [addition];
  const base = existing.combinator === 'or' ? existing.rules : [existing];
  const merged = [...base];
  for (const node of incoming) {
    if (!merged.some((m) => sameNode(m, node))) merged.push(node);
  }
  return merged.length === base.length && existing.combinator === 'and'
    ? existing
    : { combinator: 'or', rules: merged };
}
