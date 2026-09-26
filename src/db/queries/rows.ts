import { asc, eq, sql } from 'drizzle-orm';
import type { Tx } from '@/db';
import { statementRow } from '@/db/schema';
import type { StoredRow } from '@/lib/sync';

const identity = [
  statementRow.userId,
  statementRow.dateStr,
  statementRow.description,
  statementRow.debit,
  statementRow.credit,
  statementRow.person,
  statementRow.ordinal,
];

// Postgres caps a statement at 65535 bind parameters; a row binds 9.
const INSERT_BATCH = 5000;

/**
 * The client already ran `mergeRows`, so a conflict on (content, ordinal) can only be a retried
 * append of the same row, never a second copy that dedupe let through.
 */
export async function insertRows(tx: Tx, userId: string, rows: StoredRow[]) {
  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    await tx
      .insert(statementRow)
      .values(rows.slice(i, i + INSERT_BATCH).map((row) => ({ ...row, userId })))
      .onConflictDoNothing({ target: identity });
  }
}

export async function updateOverrides(tx: Tx, userId: string, rows: StoredRow[]) {
  if (!rows.length) return;
  await tx.execute(sql`
    update ${statementRow} set category_override = v."categoryOverride"
    from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) as v(
      "dateStr" text, "description" text, "debit" text, "credit" text, "person" text,
      "ordinal" int, "categoryOverride" text
    )
    where ${statementRow.userId} = ${userId}
      and ${statementRow.dateStr} = v."dateStr"
      and ${statementRow.description} = v."description"
      and ${statementRow.debit} = v."debit"
      and ${statementRow.credit} = v."credit"
      and ${statementRow.person} = v."person"
      and ${statementRow.ordinal} = v."ordinal"
  `);
}

export function readRows(tx: Tx, userId: string): Promise<StoredRow[]> {
  return tx
    .select({
      status: statementRow.status,
      dateStr: statementRow.dateStr,
      description: statementRow.description,
      debit: statementRow.debit,
      credit: statementRow.credit,
      person: statementRow.person,
      ordinal: statementRow.ordinal,
      categoryOverride: statementRow.categoryOverride,
    })
    .from(statementRow)
    .where(eq(statementRow.userId, userId))
    .orderBy(asc(statementRow.id));
}

export async function deleteRows(tx: Tx, userId: string) {
  await tx.delete(statementRow).where(eq(statementRow.userId, userId));
}
