import { defaultCategorization } from './defaultRules';
import { uniqueId } from './rules/naming';
import type { RuleGroup } from './rules/types';
import type { Categorization, Category, Rule, Transaction } from './types';

/** A rule as stored before categories had their own list: the rule was its own category. */
export interface LegacyRule {
  id: string;
  name: string;
  color: string;
  conditions: RuleGroup;
  builtin?: boolean;
}

/**
 * Splits pre-category rules into the current shape. Each becomes a category and a rule under the
 * same id, so overrides and filters holding that id keep pointing at the same category. A rule with
 * no conditions matched nothing (the builtin Other among them), so only its category survives.
 *
 * Every account is supposed to have both builtins, but a legacy record is trusted only as far as
 * what it actually stored — any builtin category or rule it's missing is filled in from the
 * defaults, by id, so this never hands back a categorization the server would reject for lacking
 * one. An id already present, builtin or not, is kept exactly as stored.
 */
export function upgradeLegacyRules(legacy: LegacyRule[]): Categorization {
  if (!legacy.length) return defaultCategorization;
  const categories = legacy.map(({ id, name, color, builtin }) =>
    builtin ? { id, name, color, builtin } : { id, name, color },
  );
  const rules = legacy
    .filter((r) => r.conditions.rules.length)
    .map(({ id, conditions, builtin }) =>
      builtin ? { id, categoryId: id, conditions, builtin } : { id, categoryId: id, conditions },
    );
  const ids = new Set(categories.map((c) => c.id));
  return {
    categories: [
      ...categories,
      ...defaultCategorization.categories.filter((c) => c.builtin && !ids.has(c.id)),
    ],
    rules: [
      ...rules,
      ...defaultCategorization.rules.filter((r) => r.builtin && !ids.has(r.categoryId)),
    ],
  };
}

export interface CategoryUsage {
  rules: number;
  transactions: number;
}

export function categoryUsage(
  { categories, rules }: Categorization,
  transactions: Transaction[],
): Map<string, CategoryUsage> {
  const usage = new Map(categories.map((c) => [c.id, { rules: 0, transactions: 0 }]));
  for (const rule of rules) {
    const entry = usage.get(rule.categoryId);
    if (entry) entry.rules++;
  }
  for (const txn of transactions) {
    const entry = usage.get(txn.categoryId);
    if (entry) entry.transactions++;
  }
  return usage;
}

/** What deleting a category takes with it, for the warning shown before it happens. */
export interface DeletionImpact {
  rules: Rule[];
  /** Rows filed here by hand; their override is cleared and the remaining rules decide. */
  overridden: number;
  /** Every row currently in the category, overridden or not. */
  transactions: number;
}

export function deletionImpact(
  id: string,
  rules: Rule[],
  overrides: Record<string, string>,
  transactions: Transaction[],
): DeletionImpact {
  return {
    rules: rules.filter((r) => r.categoryId === id),
    overridden: Object.values(overrides).filter((c) => c === id).length,
    transactions: transactions.filter((t) => t.categoryId === id).length,
  };
}

export interface CategorizedOverrides extends Categorization {
  overrides: Record<string, string>;
}

/**
 * Drops a category, every non-builtin rule that fills it, and every override pointing at it.
 * Builtin categories and builtin rules both stay — a builtin rule can never be deleted, even if it
 * somehow ends up filed under a category that is.
 */
export function removeCategory<T extends CategorizedOverrides>(state: T, id: string): T {
  if (!state.categories.some((c) => c.id === id && !c.builtin)) return state;
  const overrides = Object.fromEntries(Object.entries(state.overrides).filter(([, c]) => c !== id));
  return {
    ...state,
    categories: state.categories.filter((c) => c.id !== id),
    rules: state.rules.filter((r) => r.categoryId !== id || r.builtin),
    overrides,
  };
}

/** Case-insensitive, so typing an existing name into a "new category" field reuses it. */
export function findCategoryByName(categories: Category[], name: string): Category | undefined {
  const needle = name.trim().toLowerCase();
  return categories.find((c) => c.name.trim().toLowerCase() === needle);
}

/** What a rule editor's category field holds: a category that exists, or one to create on save. */
export type CategoryChoice =
  { kind: 'existing'; id: string } | { kind: 'new'; name: string; color: string };

/**
 * The category a rule should file into, and whether it still has to be added. A new name that
 * matches an existing category reuses it rather than creating a lookalike. Null when a new
 * category has no name yet, or an existing one has since been deleted.
 */
export function resolveCategoryChoice(
  choice: CategoryChoice,
  categories: Category[],
): { category: Category; isNew: boolean } | null {
  if (choice.kind === 'existing') {
    const category = categories.find((c) => c.id === choice.id);
    return category ? { category, isNew: false } : null;
  }
  const name = choice.name.trim();
  if (!name) return null;
  const existing = findCategoryByName(categories, name);
  if (existing) return { category: existing, isNew: false };
  const id = uniqueId(
    name,
    categories.map((c) => c.id),
  );
  return { category: { id, name, color: choice.color }, isNew: true };
}

/**
 * How the rules list names a rule: its category's name, numbered when the category has several
 * rules, so every row's controls keep a distinct accessible name.
 */
export function ruleLabels(rules: Rule[], categories: Category[]): Map<string, string> {
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const perCategory = new Map<string, number>();
  for (const rule of rules)
    perCategory.set(rule.categoryId, (perCategory.get(rule.categoryId) ?? 0) + 1);
  const seen = new Map<string, number>();
  return new Map(
    rules.map((rule) => {
      const name = names.get(rule.categoryId) ?? rule.categoryId;
      const n = (seen.get(rule.categoryId) ?? 0) + 1;
      seen.set(rule.categoryId, n);
      return [rule.id, perCategory.get(rule.categoryId)! > 1 ? `${name} #${n}` : name];
    }),
  );
}
