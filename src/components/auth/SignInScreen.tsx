'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authClient } from '@/auth/client';
import styles from './SignInScreen.module.css';

const providers = [
  { id: 'google', label: 'Google' },
  { id: 'github', label: 'GitHub' },
] as const;

type Provider = (typeof providers)[number];

export function SignInScreen() {
  const [pending, setPending] = useState<Provider['id'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signIn = async ({ id, label }: Provider) => {
    setPending(id);
    setError(null);
    // On success this navigates away to the provider, so only failures come back here.
    const { error } = await authClient.signIn.social({ provider: id, callbackURL: '/' });
    if (!error) return;
    setPending(null);
    setError(
      error.status === 404
        ? `${label} sign-in isn’t set up yet.`
        : `Couldn’t start ${label} sign-in. Try again.`,
    );
  };

  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.lede}>
          Signing in saves your statements, rules and category fixes to your account on this app’s
          server, so they’re here next time. The only thing kept about you is your email address.
        </p>
        <div className={styles.providers}>
          {providers.map((provider) => (
            <button
              key={provider.id}
              type="button"
              className={styles.provider}
              disabled={pending !== null}
              aria-busy={pending === provider.id}
              onClick={() => signIn(provider)}
            >
              Continue with {provider.label}
            </button>
          ))}
        </div>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <p className={styles.alt}>
          You don’t need an account. Without one, your statements never leave this browser tab.{' '}
          <Link href="/">Back to the dashboard</Link>
        </p>
      </section>
    </main>
  );
}
