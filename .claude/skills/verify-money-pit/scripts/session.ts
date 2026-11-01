// Usage (from the repo root, reads .env.local, so always the dev branch):
//   bun .claude/skills/verify-money-pit/scripts/session.ts mint     -> {"userId","cookies"} JSON on stdout
//   bun .claude/skills/verify-money-pit/scripts/session.ts cookies <userId>  -> a fresh session's cookies
//   bun .claude/skills/verify-money-pit/scripts/session.ts state <userId>
//   bun .claude/skills/verify-money-pit/scripts/session.ts delete <userId>
//   bun .claude/skills/verify-money-pit/scripts/session.ts cleanup  -> deletes every verify-* test user
// Mints a throwaway user through Better Auth's testUtils, the same way e2e/account.ts does, so no
// OAuth provider is involved. Test users are always verify-<uuid>@example.test.
import { betterAuth } from 'better-auth';
import { testUtils } from 'better-auth/plugins';
import { asc, eq, like } from 'drizzle-orm';
import { authOptions } from '@/auth';
import { getDb } from '@/db';
import { category, dataset, preference, rule, session, statementRow, user } from '@/db/schema';

const [command, userId] = process.argv.slice(2);
const db = getDb();

async function state(id: string) {
  const [account] = await db.select({ id: user.id }).from(user).where(eq(user.id, id));
  return {
    exists: Boolean(account),
    rows: await db.$count(statementRow, eq(statementRow.userId, id)),
    overrides: await db
      .select({ description: statementRow.description, category: statementRow.categoryOverride })
      .from(statementRow)
      .where(eq(statementRow.userId, id))
      .then((rows) => rows.filter((r) => r.category)),
    datasets: await db
      .select({ id: dataset.id, name: dataset.name })
      .from(dataset)
      .where(eq(dataset.userId, id))
      .orderBy(asc(dataset.uploadedAt)),
    categories: await db
      .select({ id: category.id, name: category.name, builtin: category.builtin })
      .from(category)
      .where(eq(category.userId, id))
      .orderBy(asc(category.position)),
    rules: await db
      .select({ id: rule.id, categoryId: rule.categoryId, builtin: rule.builtin })
      .from(rule)
      .where(eq(rule.userId, id))
      .orderBy(asc(rule.position)),
    preference: (await db.select().from(preference).where(eq(preference.userId, id)))[0] ?? null,
    sessions: await db
      .select({ ipAddress: session.ipAddress, userAgent: session.userAgent })
      .from(session)
      .where(eq(session.userId, id)),
  };
}

try {
  if (command === 'mint' || (command === 'cookies' && userId)) {
    const { test } = await betterAuth({ ...authOptions(), plugins: [testUtils()] }).$context;
    let id = userId;
    if (command === 'mint') {
      const created = test.createUser({ email: `verify-${crypto.randomUUID()}@example.test` });
      await test.saveUser(created);
      id = created.id;
    }
    const cookies = await test.getCookies({ userId: id, domain: '127.0.0.1' });
    console.log(JSON.stringify({ userId: id, cookies }));
  } else if (command === 'state' && userId) {
    console.log(JSON.stringify(await state(userId)));
  } else if (command === 'delete' && userId) {
    await db.delete(user).where(eq(user.id, userId));
  } else if (command === 'cleanup') {
    const gone = await db
      .delete(user)
      .where(like(user.email, 'verify-%@example.test'))
      .returning({ id: user.id });
    console.log(`deleted ${gone.length} verify-* test users`);
  } else {
    console.error(
      'usage: session.ts mint | cookies <userId> | state <userId> | delete <userId> | cleanup',
    );
    process.exitCode = 2;
  }
} finally {
  await db.$client.end();
}
