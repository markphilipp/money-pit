import Link from 'next/link';
import styles from './LegalPage.module.css';

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="wrap">
      <article className={`card ${styles.page}`}>
        <h1>{title}</h1>
        <p className={styles.updated}>Last updated {updated}</p>
        {children}
        <p>
          <Link href="/">← Back to the dashboard</Link>
        </p>
      </article>
    </main>
  );
}
