import { sql } from 'drizzle-orm';
import { getDb } from '@/db';

try {
  const db = getDb();
  const { rows } = await db.execute(sql`select 1 as ok`);
  console.log(rows);
  await db.$client.end();
} catch (error) {
  const { message, cause } = error as Error;
  console.error(cause instanceof Error ? `${message}\n${cause.message}` : message);
  process.exit(1);
}
