import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="wrap">
      <section className="card">
        <h2>Page not found</h2>
        <p className="sub">That URL doesn’t exist in The Money Pit.</p>
        <Link href="/">← Back to the dashboard</Link>
      </section>
    </main>
  );
}
