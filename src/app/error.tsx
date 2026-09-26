'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="wrap">
      <section className="card">
        <h2>Something went wrong</h2>
        {/* No error-reporting service by design: the app makes no third-party calls. */}
        <p className="sub">{error.message}</p>
        <button type="button" className="btn-clear" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
