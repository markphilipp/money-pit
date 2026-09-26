import assert from 'node:assert/strict';
import { betterAuth } from 'better-auth';
import { eq } from 'drizzle-orm';
import { testUtils } from 'better-auth/plugins';
import { authOptions, getAuth } from '@/auth';
import { getDb } from '@/db';
import { account } from '@/db/schema';

const { test } = await betterAuth({ ...authOptions(), plugins: [testUtils()] }).$context;
const auth = getAuth();
const user = test.createUser({ email: `session-check-${crypto.randomUUID()}@example.test` });
await test.saveUser(user);

try {
  const headers = await test.getAuthHeaders({ userId: user.id });
  const session = await auth.api.getSession({ headers });
  assert.equal(session?.user.id, user.id, 'signed session cookie reads back its user');
  console.log('valid cookie ->', { userId: session.user.id, email: session.user.email });

  const cookie = headers.get('cookie')!;
  const forged = cookie.replace(/=([^.;]+)\.[^;]+/, '=$1.forged');
  assert.notEqual(forged, cookie);
  for (const bogus of [forged, cookie.replace(/=[^;]+/, '=bogus')]) {
    const result = await auth.api.getSession({ headers: new Headers({ cookie: bogus }) });
    assert.equal(result, null, `bogus cookie is rejected: ${bogus.split('=')[1].slice(0, 12)}…`);
  }
  console.log('forged signature -> null, unknown token -> null');

  const tokens = {
    idToken: 'id-token',
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    accessTokenExpiresAt: new Date(),
    refreshTokenExpiresAt: new Date(),
  };
  const storedTokens = async (id: string) => {
    const [row] = await getDb().select().from(account).where(eq(account.id, id));
    return Object.fromEntries(
      Object.keys(tokens).map((key) => [key, row[key as keyof typeof row]]),
    );
  };
  const nulls = Object.fromEntries(Object.keys(tokens).map((key) => [key, null]));
  const { internalAdapter } = await auth.$context;
  const created = await internalAdapter.createAccount({
    userId: user.id,
    providerId: 'github',
    accountId: `session-check-${user.id}`,
    ...tokens,
  });
  assert.deepEqual(
    await storedTokens(created.id),
    nulls,
    'account create stores no provider tokens',
  );
  await internalAdapter.updateAccount(created.id, tokens);
  assert.deepEqual(
    await storedTokens(created.id),
    nulls,
    'account update stores no provider tokens',
  );
  console.log('account create/update -> tokens', await storedTokens(created.id));
} finally {
  await test.deleteUser(user.id);
  await getDb().$client.end();
}
console.log('ok');
