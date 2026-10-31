import { defaultCategorization } from './defaultRules';
import { MAX_DISMISSED } from './rules/discover';
import type { Categorization, Dataset } from './types';

/** Everything a signed-out session or an account holds, as `claimInto` folds it. */
export interface Holdings extends Categorization {
  datasets: Dataset[];
  overrides: Record<string, string>;
  dismissedSuggestions: string[];
}

// Conditions read back from jsonb lose their key order, so compare structurally.
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((k) => sameValue(a[k as keyof typeof a], b[k as keyof typeof b]))
  );
}

/** The account's items, then the session's that the account lacks, with the account's builtins last. */
function union<T extends { id: string; builtin?: boolean }>(account: T[], local: T[]): T[] {
  const ids = new Set(account.map((item) => item.id));
  return [
    ...account.filter((item) => !item.builtin),
    ...local.filter((item) => !item.builtin && !ids.has(item.id)),
    ...account.filter((item) => item.builtin),
  ];
}

/**
 * Folds a signed-out session into an account. The account keeps its datasets and gains the
 * session's whose id it lacks, so claiming the same session twice adds nothing, and rows shared
 * between them dedupe through `mergeDatasets` like a second upload. Overrides are keyed by `txnId`,
 * which survives the merge, and the session's win. An account still on the seeded defaults
 * takes the session's categories and rules wholesale; otherwise only the ones the account doesn't
 * have are added, ahead of the builtins. Category ids are name slugs, so a shared id is the same
 * category and the account's version stays. Dismissed suggestions are unioned, since a proposal
 * turned down on either side shouldn't come back. Rule ids are random, so a shared id only happens for
 * the fixed-id builtins; every other rule from each side is just unioned in, never merged.
 */
export function claimInto(account: Holdings, local: Holdings): Holdings {
  const seeded =
    !account.categories.length ||
    sameValue({ categories: account.categories, rules: account.rules }, defaultCategorization);
  return {
    datasets: [
      ...account.datasets,
      ...local.datasets.filter((d) => !account.datasets.some((a) => a.id === d.id)),
    ],
    categories: seeded ? local.categories : union(account.categories, local.categories),
    rules: seeded ? local.rules : union(account.rules, local.rules),
    overrides: { ...account.overrides, ...local.overrides },
    dismissedSuggestions: [
      ...new Set([...account.dismissedSuggestions, ...local.dismissedSuggestions]),
    ].slice(-MAX_DISMISSED),
  };
}
