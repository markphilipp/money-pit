import { Pool } from '@neondatabase/serverless';
import { attachDatabasePool } from '@vercel/functions';
import { drizzle } from 'drizzle-orm/neon-serverless';

function pooledConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Pull it with `bunx vercel env pull .env.local`.');
  }
  const host = URL.parse(url)?.hostname;
  if (!host?.split('.')[0].endsWith('-pooler')) {
    throw new Error(
      'DATABASE_URL must point at the pooled Neon host (`-pooler`). Use DATABASE_URL_UNPOOLED only for migrations.',
    );
  }
  return url;
}

function connect() {
  const pool = new Pool({ connectionString: pooledConnectionString() });
  // Fluid Compute can suspend an instance with idle clients open; this closes them first.
  attachDatabasePool(pool);
  return drizzle({ client: pool });
}

type Db = ReturnType<typeof connect>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

let db: Db | undefined;

// Lazy so importing this module never reads env: `next build` evaluates route modules with no DATABASE_URL.
export function getDb() {
  return (db ??= connect());
}
