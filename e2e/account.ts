import { existsSync } from 'node:fs';
import { test as base, type BrowserContext } from '@playwright/test';
import { betterAuth } from 'better-auth';
import { testUtils } from 'better-auth/plugins';
import type { TestHelpers } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';
import { authOptions } from '@/auth';
import { getDb } from '@/db';
import { category, categoryRule, rule, statementRow, user as userTable } from '@/db/schema';
import type { RuleGroup } from '@/lib/rules/types';

// The server under test reads .env.local itself; minting sessions here needs the same database and
// BETTER_AUTH_SECRET. loadEnvFile never overrides what CI already exported.
if (existsSync('.env.local')) process.loadEnvFile('.env.local');

interface LegacyCategoryRule {
  id: string;
  name: string;
  color: string;
  conditions: RuleGroup;
  builtin?: boolean;
}

interface Account {
  signIn: (context?: BrowserContext) => Promise<void>;
  /** What the server holds, for waiting on a write the page has no visible signal for. */
  rowCount: () => Promise<number>;
  exists: () => Promise<boolean>;
  /**
   * Replaces the seeded `category`/`rule` rows with rows in the pre-split `category_rule` table,
   * simulating an account that signed up before the split and has never been read since.
   */
  seedLegacyCategoryRules: (rows: LegacyCategoryRule[]) => Promise<void>;
  categoryIds: () => Promise<string[]>;
  ruleIds: () => Promise<string[]>;
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
      exists: async () => (await getDb().$count(userTable, eq(userTable.id, user.id))) > 0,
      seedLegacyCategoryRules: async (rows) => {
        const db = getDb();
        await db.delete(rule).where(eq(rule.userId, user.id));
        await db.delete(category).where(eq(category.userId, user.id));
        await db.insert(categoryRule).values(
          rows.map((r, position) => ({
            userId: user.id,
            id: r.id,
            name: r.name,
            color: r.color,
            conditions: r.conditions,
            builtin: r.builtin ?? false,
            position,
          })),
        );
      },
      categoryIds: async () =>
        (
          await getDb()
            .select({ id: category.id })
            .from(category)
            .where(eq(category.userId, user.id))
            .orderBy(category.position)
        ).map((c) => c.id),
      ruleIds: async () =>
        (
          await getDb()
            .select({ id: rule.id })
            .from(rule)
            .where(eq(rule.userId, user.id))
            .orderBy(rule.position)
        ).map((r) => r.id),
    });
    await helpers.deleteUser(user.id);
  },
});

export { expect } from '@playwright/test';
