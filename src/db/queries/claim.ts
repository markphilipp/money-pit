import type { Tx } from '@/db';
import { claimInto, type Holdings } from '@/lib/claim';
import { mergeDatasets } from '@/lib/datasets';
import { fromStoredDatasets, overrideChanges, toStoredRows } from '@/lib/sync';
import { adoptUnownedRows, insertDataset, insertDatasetRows, readDatasets } from './datasets';
import { readCategorization, replaceCategorization } from './categories';
import { upsertPreference, type Preference } from './preference';
import { updateOverrides } from './rows';

/** Folds a signed-out session into the account; running it twice with the same session adds nothing. */
export async function saveClaim(
  tx: Tx,
  userId: string,
  local: Holdings,
  preference: Preference | null,
) {
  await adoptUnownedRows(tx, userId);
  const account = {
    ...fromStoredDatasets(await readDatasets(tx, userId)),
    ...(await readCategorization(tx, userId)),
  };
  const merged = claimInto(account, local);
  const known = new Set(account.datasets.map((d) => d.id));
  for (const added of merged.datasets.filter((d) => !known.has(d.id))) {
    await insertDataset(tx, userId, added);
    await insertDatasetRows(tx, userId, added.id, toStoredRows(added.rows, {}));
  }
  // After the inserts, so a session override lands on rows the account only just received.
  await updateOverrides(
    tx,
    userId,
    overrideChanges(mergeDatasets(merged.datasets), account.overrides, merged.overrides),
  );
  await replaceCategorization(tx, userId, merged);
  if (preference) await upsertPreference(tx, userId, preference);
}
