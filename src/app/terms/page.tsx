import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/legal/LegalPage';

export const metadata: Metadata = { title: 'Terms of service' };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" updated="September 26, 2026">
      <p>By using The Money Pit you agree to these terms. If you don’t agree, don’t use it.</p>

      <h2>The service</h2>
      <p>
        The Money Pit is a free personal project that charts spending from statement files you
        upload. It is provided as is, without warranties of any kind. Categories and totals are
        worked out automatically and can be wrong. Nothing here is financial advice.
      </p>

      <h2>Your data</h2>
      <p>
        Only upload statements you have the right to use. Your data stays yours. How it’s handled is
        described in the <Link href="/privacy">privacy policy</Link>.
      </p>

      <h2>Your account</h2>
      <p>
        An account is optional. You can delete it at any time from the account menu. Don’t try to
        access other people’s data, overload the service, or use it for anything unlawful. Accounts
        that do may be removed.
      </p>

      <h2>Changes and availability</h2>
      <p>
        The service may change, be unavailable, or shut down. If it shuts down, stored account data
        will be deleted. Keep your own copies of your statement files. These terms may be updated,
        and the date at the top shows when they last were.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent the law allows, the service’s operator isn’t liable for any loss that comes
        from using it or from not being able to use it.
      </p>
    </LegalPage>
  );
}
