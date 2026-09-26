import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit runs under Node, which doesn't read .env.local; `bun --bun` would, but its migrate
// fails silently against Neon. loadEnvFile never overrides vars already set, so Vercel is unaffected.
if (existsSync('.env.local')) process.loadEnvFile('.env.local');

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/*.ts',
  out: './drizzle',
  // Migrations need a direct session; PgBouncer's transaction mode on the pooled host breaks them.
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED! },
});
