import { eq } from 'drizzle-orm';
import type { Tx } from '@/db';
import { preference } from '@/db/schema';

export type Preference = Omit<typeof preference.$inferSelect, 'userId'>;

export async function upsertPreference(tx: Tx, userId: string, value: Preference) {
  await tx
    .insert(preference)
    .values({ userId, ...value })
    .onConflictDoUpdate({ target: preference.userId, set: value });
}

export async function readPreference(tx: Tx, userId: string): Promise<Preference | null> {
  const [row] = await tx
    .select({
      chartMode: preference.chartMode,
      personChartMode: preference.personChartMode,
      sortKey: preference.sortKey,
      sortDir: preference.sortDir,
    })
    .from(preference)
    .where(eq(preference.userId, userId));
  return row ?? null;
}

export async function deletePreference(tx: Tx, userId: string) {
  await tx.delete(preference).where(eq(preference.userId, userId));
}
