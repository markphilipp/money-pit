import { and, asc, eq, isNotNull, notInArray } from 'drizzle-orm';
import type { Tx } from '@/db';
import { category, categoryRule, rule, statementRow } from '@/db/schema';
import { upgradeLegacyRules } from '@/lib/categories';
import type { Categorization } from '@/lib/types';

/**
 * Delete + insert rather than diffing, so position is always the array index and a reorder can
 * never collide with the (userId, position) unique constraints mid-update. Overrides pointing at a
 * category that is gone are cleared in the same transaction, so a later category that reuses the
 * slug can't inherit them.
 */
export async function replaceCategorization(
  tx: Tx,
  userId: string,
  { categories, rules }: Categorization,
) {
  await tx.delete(rule).where(eq(rule.userId, userId));
  await tx.delete(category).where(eq(category.userId, userId));
  await tx.insert(category).values(
    categories.map((c, position) => ({
      userId,
      id: c.id,
      name: c.name,
      color: c.color,
      builtin: c.builtin ?? false,
      position,
    })),
  );
  if (rules.length) {
    await tx.insert(rule).values(
      rules.map((r, position) => ({
        userId,
        id: r.id,
        categoryId: r.categoryId,
        conditions: r.conditions,
        builtin: r.builtin ?? false,
        position,
      })),
    );
  }
  await tx
    .update(statementRow)
    .set({ categoryOverride: null })
    .where(
      and(
        eq(statementRow.userId, userId),
        isNotNull(statementRow.categoryOverride),
        notInArray(
          statementRow.categoryOverride,
          categories.map((c) => c.id),
        ),
      ),
    );
}

const optionalBuiltin = <T extends { builtin: boolean }>({ builtin, ...rest }: T) =>
  builtin ? { ...rest, builtin } : rest;

/** An account nothing has written categories for yet is read from its pre-split rules. */
export async function readCategorization(tx: Tx, userId: string): Promise<Categorization> {
  const categories = await tx
    .select({
      id: category.id,
      name: category.name,
      color: category.color,
      builtin: category.builtin,
    })
    .from(category)
    .where(eq(category.userId, userId))
    .orderBy(asc(category.position));
  if (!categories.length) {
    const legacy = await tx
      .select({
        id: categoryRule.id,
        name: categoryRule.name,
        color: categoryRule.color,
        conditions: categoryRule.conditions,
        builtin: categoryRule.builtin,
      })
      .from(categoryRule)
      .where(eq(categoryRule.userId, userId))
      .orderBy(asc(categoryRule.position));
    return upgradeLegacyRules(legacy.map(optionalBuiltin));
  }
  const rules = await tx
    .select({
      id: rule.id,
      categoryId: rule.categoryId,
      conditions: rule.conditions,
      builtin: rule.builtin,
    })
    .from(rule)
    .where(eq(rule.userId, userId))
    .orderBy(asc(rule.position));
  return { categories: categories.map(optionalBuiltin), rules: rules.map(optionalBuiltin) };
}
