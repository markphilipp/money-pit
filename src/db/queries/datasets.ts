import { randomUUID } from 'node:crypto';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { Tx } from '@/db';
import { dataset, statementRow, statementRowDataset } from '@/db/schema';
import type { StoredDataset, StoredRow } from '@/lib/sync';
import { insertRows } from './rows';

export interface NewDataset {
  id: string;
  name: string;
  uploadedAt: string;
}

export async function insertDataset(tx: Tx, userId: string, value: NewDataset) {
  await tx
    .insert(dataset)
    .values({ userId, ...value, uploadedAt: new Date(value.uploadedAt) })
    .onConflictDoNothing();
}

/**
 * Rows are shared between datasets, so this inserts any the account lacks and then records that
 * this dataset's file held each one. A retry converges on the same rows and memberships.
 */
export async function insertDatasetRows(
  tx: Tx,
  userId: string,
  datasetId: string,
  rows: StoredRow[],
) {
  if (!rows.length) return;
  await insertRows(tx, userId, rows);
  await tx.execute(sql`
    insert into ${statementRowDataset} (row_id, user_id, dataset_id)
    select ${statementRow.id}, ${userId}, ${datasetId}
    from ${statementRow}
    join jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) as v(
      "dateStr" text, "description" text, "debit" text, "credit" text, "person" text, "ordinal" int
    )
      on ${statementRow.dateStr} = v."dateStr"
      and ${statementRow.description} = v."description"
      and ${statementRow.debit} = v."debit"
      and ${statementRow.credit} = v."credit"
      and ${statementRow.person} = v."person"
      and ${statementRow.ordinal} = v."ordinal"
    where ${statementRow.userId} = ${userId}
    on conflict do nothing
  `);
}

/**
 * Drops a dataset and the rows only it held. A row another dataset also holds stays, which is
 * what makes removal equal to never having uploaded the file. Rows with no membership at all (an
 * older deployment's) are left alone: only rows this dataset held are candidates.
 */
export async function deleteDataset(tx: Tx, userId: string, id: string) {
  await tx.execute(sql`
    delete from ${statementRow} sr
    where sr.user_id = ${userId}
      and sr.id in (
        select row_id from ${statementRowDataset} where user_id = ${userId} and dataset_id = ${id}
      )
      and not exists (
        select 1 from ${statementRowDataset} m where m.row_id = sr.id and m.dataset_id <> ${id}
      )
  `);
  await tx.delete(dataset).where(and(eq(dataset.userId, userId), eq(dataset.id, id)));
}

/**
 * Rows saved before datasets existed, or by a deployment that predates them, belong to no file.
 * They become one "Earlier uploads" dataset the first time the account is read. The advisory lock
 * keeps two tabs loading at once from each creating one.
 */
export async function adoptUnownedRows(tx: Tx, userId: string) {
  const unowned = sql`
    select 1 from ${statementRow} sr
    where sr.user_id = ${userId}
      and not exists (select 1 from ${statementRowDataset} m where m.row_id = sr.id)
  `;
  if (!(await tx.execute(sql`${unowned} limit 1`)).rows.length) return;
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
  const id = randomUUID();
  const created = await tx.execute(sql`
    insert into ${dataset} (user_id, id, name, uploaded_at)
    select ${userId}, ${id}, 'Earlier uploads', min(sr.created_at) at time zone 'UTC'
    from ${statementRow} sr
    where sr.user_id = ${userId}
      and not exists (select 1 from ${statementRowDataset} m where m.row_id = sr.id)
    having count(*) > 0
    returning id
  `);
  if (!created.rows.length) return;
  await tx.execute(sql`
    insert into ${statementRowDataset} (row_id, user_id, dataset_id)
    select sr.id, ${userId}, ${id}
    from ${statementRow} sr
    where sr.user_id = ${userId}
      and not exists (select 1 from ${statementRowDataset} m where m.row_id = sr.id)
  `);
}

export async function readDatasets(tx: Tx, userId: string): Promise<StoredDataset[]> {
  const datasets = await tx
    .select({ id: dataset.id, name: dataset.name, uploadedAt: dataset.uploadedAt })
    .from(dataset)
    .where(eq(dataset.userId, userId))
    .orderBy(asc(dataset.uploadedAt), asc(dataset.id));
  const members = await tx
    .select({
      datasetId: statementRowDataset.datasetId,
      status: statementRow.status,
      dateStr: statementRow.dateStr,
      description: statementRow.description,
      debit: statementRow.debit,
      credit: statementRow.credit,
      person: statementRow.person,
      ordinal: statementRow.ordinal,
      categoryOverride: statementRow.categoryOverride,
    })
    .from(statementRowDataset)
    .innerJoin(statementRow, eq(statementRow.id, statementRowDataset.rowId))
    .where(eq(statementRowDataset.userId, userId))
    .orderBy(asc(statementRow.id));
  const byDataset = Map.groupBy(members, (m) => m.datasetId);
  return datasets.map((d) => ({
    ...d,
    uploadedAt: d.uploadedAt.toISOString(),
    rows: (byDataset.get(d.id) ?? []).map((m) => ({
      status: m.status,
      dateStr: m.dateStr,
      description: m.description,
      debit: m.debit,
      credit: m.credit,
      person: m.person,
      ordinal: m.ordinal,
      categoryOverride: m.categoryOverride,
    })),
  }));
}
