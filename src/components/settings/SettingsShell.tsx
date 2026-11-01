'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './SettingsShell.module.css';

interface SettingsSection {
  href: string;
  label: string;
}

/** One entry per settings page. A section owns every route beneath its `href`. */
export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  { href: '/settings/datasets', label: 'Uploaded files' },
  { href: '/settings/categories', label: 'Categories' },
  { href: '/settings/rules', label: 'Rules' },
];

const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <header className={styles.bar}>
        <div className={styles.barInner}>
          <h1 className={styles.title}>Settings</h1>
          <nav aria-label="Settings" className={styles.tabs}>
            {SETTINGS_SECTIONS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={styles.tab}
                aria-current={isActive(pathname, href) ? 'page' : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>
          <Link href="/" className={styles.done}>
            Done<span className={styles.hidden}> and back to the dashboard</span>
          </Link>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </>
  );
}
