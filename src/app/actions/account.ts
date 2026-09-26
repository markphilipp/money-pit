'use server';

import { getDb } from '@/db';
import { deletePreference, readPreference, upsertPreference } from '@/db/queries/preference';
import { readRules, replaceRules as writeRules } from '@/db/queries/rules';
import { deleteRows, insertRows, readRows, updateOverrides } from '@/db/queries/rows';
import { requireUserId } from '@/auth/session';
import { defaultRules } from '@/lib/defaultRules';
import { claimInto } from '@/lib/claim';
import { fromStoredRows, overrideChanges, toStoredRows, type StoredRow } from '@/lib/sync';
import type { CategoryRule } from '@/lib/types';
import type { Preference } from '@/db/queries/preference';
import { preferenceInput, rowsInput, rulesInput } from './input';

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

export async function replaceRules(rules: CategoryRule[]) {
  const userId = await requireUserId();
  const parsed = rulesInput.parse(rules);
  await getDb().transaction((tx) => writeRules(tx, userId, parsed));
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
    await writeRules(tx, userId, defaultRules);
  });
}

export async function loadSnapshot() {
  const userId = await requireUserId();
  return getDb().transaction(async (tx) => {
    const rules = await readRules(tx, userId);
    return {
      rows: await readRows(tx, userId),
      // Only a failed seeding hook leaves an account with no rules; fall back rather than render none.
      rules: rules.length ? rules : defaultRules,
      preference: await readPreference(tx, userId),
    };
  });
}

/** Saves a signed-out session's rows, overrides and rules into the account; safe to retry. */
export async function claimLocal(rows: StoredRow[], rules: CategoryRule[]) {
  const userId = await requireUserId();
  const local = { ...fromStoredRows(rowsInput.parse(rows)), rules: rulesInput.parse(rules) };
  await getDb().transaction(async (tx) => {
    const account = {
      ...fromStoredRows(await readRows(tx, userId)),
      rules: await readRules(tx, userId),
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
    await writeRules(tx, userId, merged.rules);
  });
}
