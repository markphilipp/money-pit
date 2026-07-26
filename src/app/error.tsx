'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="wrap">
      <section className="card">
        <h2>Something went wrong</h2>
        {/* Statements never leave the browser, so there is nowhere to report this to. */}
        <p className="sub">{error.message}</p>
        <button type="button" className="btn-clear" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
