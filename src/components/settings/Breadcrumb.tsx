import Link from 'next/link';
import styles from './Breadcrumb.module.css';

interface BreadcrumbProps {
  parent: { label: string; href: string };
  current: string;
  onNavigate?: () => void;
}

/** Location trail for a settings sub-page. The parent is always a section root. */
export function Breadcrumb({ parent, current, onNavigate }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className={styles.trail}>
        <li>
          <Link href={parent.href} className={styles.parent} onClick={onNavigate}>
            {parent.label}
          </Link>
        </li>
        <li aria-current="page" className={styles.current}>
          {current}
        </li>
      </ol>
    </nav>
  );
}
