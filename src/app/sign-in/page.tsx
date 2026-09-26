import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUserId } from '@/auth/session';
import { SignInScreen } from '@/components/auth/SignInScreen';

export const metadata: Metadata = { title: 'Sign in' };

export default async function SignInPage() {
  if (await currentUserId()) redirect('/');
  return <SignInScreen />;
}
