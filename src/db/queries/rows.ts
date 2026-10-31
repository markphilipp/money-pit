import { sql } from 'drizzle-orm';
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
 * A conflict on (content, ordinal) is a row an earlier file or a retried append already put there,
 * so it is skipped rather than duplicated. The row stays deduped; datasets record who holds it.
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
