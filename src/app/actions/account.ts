'use server';

import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { user } from '@/db/schema';
import { deletePreference, readPreference, upsertPreference } from '@/db/queries/preference';
import { readCategorization, replaceCategorization } from '@/db/queries/categories';
import { deleteRows, insertRows, readRows, updateOverrides } from '@/db/queries/rows';
import { requireUserId } from '@/auth/session';
import { defaultCategorization } from '@/lib/defaultRules';
import { claimInto } from '@/lib/claim';
import { fromStoredRows, overrideChanges, toStoredRows, type StoredRow } from '@/lib/sync';
import type { Categorization } from '@/lib/types';
import type { Preference } from '@/db/queries/preference';
import { categorizationInput, preferenceInput, rowsInput } from './input';

// Server actions are public endpoints: every one takes its user from the session cookie and
// parses its arguments, whatever their declared types.

export async function appendRows(rows: StoredRow[]) {
  const userId = await requireUserId();
  const parsed = rowsInput.parse(rows);
  await getDb().transaction((tx) => insertRows(tx, userId, parsed));
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

export async function resetAccount() {
  const userId = await requireUserId();
  await getDb().transaction(async (tx) => {
    await deleteRows(tx, userId);
    await deletePreference(tx, userId);
    await replaceCategorization(tx, userId, defaultCategorization);
  });
}

/** Every other table cascades from `user`, sessions included, so this also signs the user out. */
export async function deleteAccount() {
  const userId = await requireUserId();
  await getDb().delete(user).where(eq(user.id, userId));
}

export async function loadSnapshot() {
  const userId = await requireUserId();
  return getDb().transaction(async (tx) => {
    return {
      rows: await readRows(tx, userId),
      ...(await readCategorization(tx, userId)),
      preference: await readPreference(tx, userId),
    };
  });
}

/** Saves a signed-out session's rows, overrides, categories and rules into the account; safe to retry. */
export async function claimLocal(
  rows: StoredRow[],
  categorization: Categorization,
  preference: Preference | null,
) {
  const userId = await requireUserId();
  const local = {
    ...fromStoredRows(rowsInput.parse(rows)),
    ...categorizationInput.parse(categorization),
  };
  const localPreference = preferenceInput.nullable().parse(preference);
  await getDb().transaction(async (tx) => {
    const account = {
      ...fromStoredRows(await readRows(tx, userId)),
      ...(await readCategorization(tx, userId)),
    };
    const merged = claimInto(account, local);
    await insertRows(
      tx,
      userId,
      toStoredRows(merged.rawRows, merged.overrides).slice(account.rawRows.length),
    );
    await updateOverrides(
      tx,
      userId,
      overrideChanges(account.rawRows, account.overrides, merged.overrides),
    );
    await replaceCategorization(tx, userId, merged);
    if (localPreference) await upsertPreference(tx, userId, localPreference);
  });
}
