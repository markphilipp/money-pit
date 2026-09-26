import { mergeRows } from './csv';
import { defaultRules } from './defaultRules';
import type { CategoryRule, RawStatementRow } from './types';

export interface Dataset {
  rawRows: RawStatementRow[];
  rules: CategoryRule[];
  overrides: Record<string, string>;
}

// Rules read back from jsonb lose their key order, so compare structurally.
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

/**
 * Folds a signed-out session into an account. Rows go through `mergeRows`, so overlap with what the
 * account already holds is deduped the same way a second upload would be. Overrides are keyed by
 * `txnId`, which survives the merge, and the session's win. An account still on the seeded defaults
 * takes the session's rules wholesale; otherwise only rules the account doesn't have are added,
 * ahead of the builtins. Ids are name slugs, so a shared id is the same rule and the account's
 * version stays.
 */
export function claimInto(account: Dataset, local: Dataset): Dataset {
  const seeded = !account.rules.length || sameValue(account.rules, defaultRules);
  const accountIds = new Set(account.rules.map((r) => r.id));
  const rules = seeded
    ? local.rules
    : [
        ...account.rules.filter((r) => !r.builtin),
        ...local.rules.filter((r) => !r.builtin && !accountIds.has(r.id)),
        ...account.rules.filter((r) => r.builtin),
      ];
  return {
    rawRows: mergeRows(account.rawRows, local.rawRows),
    rules,
    overrides: { ...account.overrides, ...local.overrides },
  };
}
