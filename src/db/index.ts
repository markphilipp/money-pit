import { Pool } from '@neondatabase/serverless';
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
  return drizzle({ client: new Pool({ connectionString: pooledConnectionString() }) });
}

let db: ReturnType<typeof connect> | undefined;

// Lazy so importing this module never reads env: `next build` evaluates route modules with no DATABASE_URL.
export function getDb() {
  return (db ??= connect());
}
