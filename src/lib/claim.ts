import { mergeRows } from './csv';
import { defaultCategorization } from './defaultRules';
import type { Categorization, RawStatementRow } from './types';

export interface Dataset extends Categorization {
  rawRows: RawStatementRow[];
  overrides: Record<string, string>;
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
 * Folds a signed-out session into an account. Rows go through `mergeRows`, so overlap with what the
 * account already holds is deduped the same way a second upload would be. Overrides are keyed by
 * `txnId`, which survives the merge, and the session's win. An account still on the seeded defaults
 * takes the session's categories and rules wholesale; otherwise only the ones the account doesn't
 * have are added, ahead of the builtins. Category ids are name slugs, so a shared id is the same
 * category and the account's version stays. Rule ids are random, so a shared id only happens for
 * the fixed-id builtins; every other rule from each side is just unioned in, never merged.
 */
export function claimInto(account: Dataset, local: Dataset): Dataset {
  const seeded =
    !account.categories.length ||
    sameValue({ categories: account.categories, rules: account.rules }, defaultCategorization);
  return {
    rawRows: mergeRows(account.rawRows, local.rawRows),
    categories: seeded ? local.categories : union(account.categories, local.categories),
    rules: seeded ? local.rules : union(account.rules, local.rules),
    overrides: { ...account.overrides, ...local.overrides },
  };
}
