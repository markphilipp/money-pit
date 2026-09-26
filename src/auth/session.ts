import { getSessionCookie } from 'better-auth/cookies';
import { headers } from 'next/headers';
import { getAuth } from '.';

/** Without a session cookie this never builds the auth instance, so signed-out renders need no DB. */
export async function currentUserId(): Promise<string | null> {
  const requestHeaders = await headers();
  if (!getSessionCookie(requestHeaders)) return null;
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  return session?.user.id ?? null;
}

export async function requireUserId(): Promise<string> {
  const userId = await currentUserId();
  if (!userId) throw new Error('Not signed in.');
  return userId;
}
