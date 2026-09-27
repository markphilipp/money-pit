import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getDb } from '@/db';
import { replaceCategorization } from '@/db/queries/categories';
import * as schema from '@/db/schema';
import { defaultCategorization } from '@/lib/defaultRules';

// No PII beyond the account email: providers' names and avatars are never stored.
const dropProfile = () => ({ name: '', image: '' });

function socialProvider(prefix: 'GOOGLE' | 'GITHUB') {
  const clientId = process.env[`${prefix}_CLIENT_ID`] ?? '';
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`] ?? '';
  return {
    clientId,
    clientSecret,
    enabled: Boolean(clientId && clientSecret),
    mapProfileToUser: dropProfile,
  };
}

// Only the provider-API endpoints (getAccessToken, refreshToken, accountInfo) read these back, and
// the app never calls them. Google's id_token also carries the user's name and picture.
const dropTokens = () =>
  Promise.resolve({
    data: {
      idToken: null,
      accessToken: null,
      refreshToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
    },
  });

// Better Auth records these on every session by default.
const dropClientInfo = () => Promise.resolve({ data: { ipAddress: null, userAgent: null } });

export function authOptions() {
  return {
    database: drizzleAdapter(getDb(), { provider: 'pg', schema }),
    socialProviders: {
      google: socialProvider('GOOGLE'),
      github: socialProvider('GITHUB'),
    },
    databaseHooks: {
      user: {
        create: {
          after: (user) =>
            getDb().transaction((tx) => replaceCategorization(tx, user.id, defaultCategorization)),
        },
      },
      account: { create: { before: dropTokens }, update: { before: dropTokens } },
      session: { create: { before: dropClientInfo }, update: { before: dropClientInfo } },
    },
    telemetry: { enabled: false },
  } satisfies BetterAuthOptions;
}

function createAuth() {
  return betterAuth(authOptions());
}

let auth: ReturnType<typeof createAuth> | undefined;

// Lazy for the same reason as getDb(): `next build` evaluates the auth route with no DB or auth env.
export function getAuth() {
  return (auth ??= createAuth());
}
