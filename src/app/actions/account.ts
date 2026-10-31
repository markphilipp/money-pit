'use server';

import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { user } from '@/db/schema';
import { readPreference, upsertPreference } from '@/db/queries/preference';
import { readCategorization, replaceCategorization } from '@/db/queries/categories';
import { saveClaim } from '@/db/queries/claim';
import { updateOverrides } from '@/db/queries/rows';
import {
  adoptUnownedRows,
  deleteDataset,
  insertDataset,
  insertDatasetRows,
  readDatasets,
} from '@/db/queries/datasets';
import { requireUserId } from '@/auth/session';
import { fromStoredDatasets, type StoredRow } from '@/lib/sync';
import type { StoredDataset } from '@/lib/sync';
import type { Categorization } from '@/lib/types';
import type { Preference, ViewPreference } from '@/db/queries/preference';
import {
  categorizationInput,
  datasetInput,
  datasetsInput,
  dismissedInput,
  preferenceInput,
  rowsInput,
  viewPreferenceInput,
} from './input';

// Server actions are public endpoints: every one takes its user from the session cookie and
// parses its arguments, whatever their declared types.

export async function createDataset(value: { id: string; name: string; uploadedAt: string }) {
  const userId = await requireUserId();
  const parsed = datasetInput.parse(value);
  await getDb().transaction((tx) => insertDataset(tx, userId, parsed));
}

/** Rows arrive in chunks under the body cap, each already numbered within the whole file. */
export async function appendDatasetRows(datasetId: string, rows: StoredRow[]) {
  const userId = await requireUserId();
  const parsedId = datasetInput.shape.id.parse(datasetId);
  const parsed = rowsInput.parse(rows);
  await getDb().transaction((tx) => insertDatasetRows(tx, userId, parsedId, parsed));
}

export async function removeDataset(id: string) {
  const userId = await requireUserId();
  const parsedId = datasetInput.shape.id.parse(id);
  await getDb().transaction((tx) => deleteDataset(tx, userId, parsedId));
}

export async function setOverrides(rows: StoredRow[]) {
  const userId = await requireUserId();
  const parsed = rowsInput.parse(rows);
  await getDb().transaction((tx) => updateOverrides(tx, userId, parsed));
}

/** Categories and rules are written together, so a rule never points at a category not yet saved. */
export async function replaceCategories(value: Categorization) {
  const userId = await requireUserId();
  const parsed = categorizationInput.parse(value);
  await getDb().transaction((tx) => replaceCategorization(tx, userId, parsed));
}

export async function setPreference(value: Preference) {
  const userId = await requireUserId();
  const parsed = preferenceInput.parse(value);
  await getDb().transaction((tx) => upsertPreference(tx, userId, parsed));
}

/** Every other table cascades from `user`, sessions included, so this also signs the user out. */
export async function deleteAccount() {
  const userId = await requireUserId();
  await getDb().delete(user).where(eq(user.id, userId));
}

export async function loadSnapshot() {
  const userId = await requireUserId();
  return getDb().transaction(async (tx) => {
    await adoptUnownedRows(tx, userId);
    return {
      datasets: await readDatasets(tx, userId),
      ...(await readCategorization(tx, userId)),
      preference: await readPreference(tx, userId),
    };
  });
}

/**
 * Saves a signed-out session's datasets, overrides, categories and rules into the account; safe to
 * retry. `view` is null while the chart and sort choices are still the defaults, so they never
 * overwrite what the account saved. Dismissed suggestions are unioned either way.
 */
export async function claimLocal(
  datasets: StoredDataset[],
  categorization: Categorization,
  view: ViewPreference | null,
  dismissedSuggestions: string[],
) {
  const userId = await requireUserId();
  const local = {
    ...fromStoredDatasets(datasetsInput.parse(datasets)),
    ...categorizationInput.parse(categorization),
  };
  const localView = viewPreferenceInput.nullable().parse(view);
  const localDismissed = dismissedInput.parse(dismissedSuggestions);
  await getDb().transaction((tx) =>
    saveClaim(tx, userId, { ...local, dismissedSuggestions: localDismissed }, localView),
  );
}
