import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/legal/LegalPage';

export const metadata: Metadata = { title: 'Privacy policy' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="September 26, 2026">
      <p>
        The Money Pit turns credit-card statement CSVs into spending charts. You can use it with or
        without an account, and what happens to your data depends on which.
      </p>

      <h2>Without an account</h2>
      <p>
        Your statements are read and charted in your browser. Nothing is sent to our server. The
        data is kept in this browser tab’s session storage and is gone when you close the tab.
      </p>

      <h2>With an account</h2>
      <p>
        You sign in with Google or GitHub. We store the following so your dashboard is there next
        time:
      </p>
      <ul>
        <li>Your email address, which identifies your account.</li>
        <li>
          The statement rows you upload, as they appear in the file: status, date, description,
          amounts and cardholder name.
        </li>
        <li>
          Your category rules, the categories you change by hand, and your chart and sort settings.
        </li>
        <li>A session cookie that keeps you signed in.</li>
      </ul>
      <p>
        We don’t keep your name, profile photo, or the access tokens Google or GitHub issue at
        sign-in, and we don’t record your IP address or browser on your session.
      </p>

      <h2>What we don’t do</h2>
      <p>
        No analytics, advertising or tracking, and no third-party scripts. We don’t sell your data
        or share it with anyone, and we use it only to show you your own dashboard.
      </p>

      <h2>Where it’s stored</h2>
      <p>
        The app runs on Vercel, and account data is kept in a Postgres database hosted by Neon. Both
        process it only to run the service. Vercel keeps short-lived request logs as part of hosting
        the app.
      </p>

      <h2>Deleting your data</h2>
      <p>
        <strong>Delete account…</strong> in the account menu deletes your account, your email
        address and everything saved to it, right away. It may stay in the database provider’s
        restore history for up to 6 hours before it is overwritten. <strong>Start over</strong>{' '}
        deletes your statements and resets your rules, but keeps your account.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes, the date at the top changes with it. See also the{' '}
        <Link href="/terms">terms of service</Link>.
      </p>
    </LegalPage>
  );
}
