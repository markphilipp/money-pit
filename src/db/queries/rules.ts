import { asc, eq } from 'drizzle-orm';
import type { Tx } from '@/db';
import { categoryRule } from '@/db/schema';
import type { CategoryRule } from '@/lib/types';

// Delete + insert rather than diffing, so position is always the array index and a reorder can
// never collide with the (userId, position) unique constraint mid-update.
export async function replaceRules(tx: Tx, userId: string, rules: CategoryRule[]) {
  await tx.delete(categoryRule).where(eq(categoryRule.userId, userId));
  if (!rules.length) return;
  await tx.insert(categoryRule).values(
    rules.map((rule, position) => ({
      userId,
      id: rule.id,
      name: rule.name,
      color: rule.color,
      conditions: rule.conditions,
      builtin: rule.builtin ?? false,
      position,
    })),
  );
}

export async function readRules(tx: Tx, userId: string): Promise<CategoryRule[]> {
  const rows = await tx
    .select()
    .from(categoryRule)
    .where(eq(categoryRule.userId, userId))
    .orderBy(asc(categoryRule.position));
  return rows.map(({ id, name, color, conditions, builtin }) =>
    builtin ? { id, name, color, conditions, builtin } : { id, name, color, conditions },
  );
}
