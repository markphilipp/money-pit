import type { Metadata } from 'next';
import { Barlow_Condensed, IBM_Plex_Mono, Inter } from 'next/font/google';
import { currentUserId } from '@/auth/session';
import { AccountSync } from '@/components/layout/AccountSync';
import { UserMenu } from '@/components/layout/UserMenu';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
});
const condensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-condensed',
});
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: { default: 'The Money Pit', template: '%s · The Money Pit' },
  description:
    'Upload a credit-card statement CSV and see where the money went. Runs entirely in your browser.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const signedIn = (await currentUserId()) !== null;
  return (
    <html lang="en" className={`${inter.variable} ${condensed.variable} ${mono.variable}`}>
      <body>
        <AccountSync signedIn={signedIn}>
          <UserMenu />
          {children}
        </AccountSync>
      </body>
    </html>
  );
}
