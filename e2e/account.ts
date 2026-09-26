import { existsSync } from 'node:fs';
import { test as base, type BrowserContext } from '@playwright/test';
import { betterAuth } from 'better-auth';
import { testUtils } from 'better-auth/plugins';
import type { TestHelpers } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';
import { authOptions } from '@/auth';
import { getDb } from '@/db';
import { statementRow } from '@/db/schema';

// The server under test reads .env.local itself; minting sessions here needs the same database and
// BETTER_AUTH_SECRET. loadEnvFile never overrides what CI already exported.
if (existsSync('.env.local')) process.loadEnvFile('.env.local');

interface Account {
  signIn: (context?: BrowserContext) => Promise<void>;
  /** What the server holds, for waiting on a write the page has no visible signal for. */
  rowCount: () => Promise<number>;
}

/** Each test gets its own throwaway user, so signed-in specs stay parallel-safe; it's deleted after. */
export const test = base.extend<{ account: Account }, { helpers: TestHelpers }>({
  helpers: [
    async ({}, provide) => {
      const { test: helpers } = await betterAuth({ ...authOptions(), plugins: [testUtils()] })
        .$context;
      await provide(helpers);
      await getDb().$client.end();
    },
    { scope: 'worker' },
  ],
  account: async ({ helpers, context, baseURL }, provide) => {
    const user = helpers.createUser({ email: `e2e-${crypto.randomUUID()}@example.test` });
    await helpers.saveUser(user);
    const cookies = await helpers.getCookies({
      userId: user.id,
      domain: new URL(baseURL!).hostname,
    });
    await provide({
      signIn: (target = context) => target.addCookies(cookies),
      rowCount: () => getDb().$count(statementRow, eq(statementRow.userId, user.id)),
    });
    await helpers.deleteUser(user.id);
  },
});

export { expect } from '@playwright/test';
