import { eq } from 'drizzle-orm';
import type { Tx } from '@/db';
import { preference } from '@/db/schema';

export type Preference = Omit<typeof preference.$inferSelect, 'userId'>;

/** The columns a user changes by using the dashboard, as opposed to dismissing a suggestion. */
export type ViewPreference = Omit<Preference, 'dismissedSuggestions'>;

/** Columns left out keep their stored value, or their default on a first write. */
export async function upsertPreference(tx: Tx, userId: string, value: Partial<Preference>) {
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
      dismissedSuggestions: preference.dismissedSuggestions,
    })
    .from(preference)
    .where(eq(preference.userId, userId));
  return row ?? null;
}

export async function deletePreference(tx: Tx, userId: string) {
  await tx.delete(preference).where(eq(preference.userId, userId));
}
