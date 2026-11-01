import Link from 'next/link';
import { SETTINGS_SECTIONS } from './SettingsShell';
import styles from './SettingsHeading.module.css';

interface SettingsHeadingProps {
  /** `href` of the section this page lives under. */
  section: string;
  /** Label of a sub-page; makes the section a link back up. Omit on a section's own page. */
  current?: string;
  title: React.ReactNode;
  onNavigate?: () => void;
}

/** Trail from the dashboard down to this page, then the page title. The trail is the way out of settings. */
export function SettingsHeading({ section, current, title, onNavigate }: SettingsHeadingProps) {
  const sectionLabel = SETTINGS_SECTIONS.find((s) => s.href === section)?.label ?? section;

  return (
    <div className={styles.heading}>
      <nav aria-label="Breadcrumb">
        <ol className={styles.trail}>
          <li>
            <Link href="/" className={styles.link}>
              Dashboard
            </Link>
          </li>
          <li>
            <Link href="/settings" className={styles.link}>
              Settings
            </Link>
          </li>
          <li
            aria-current={current ? undefined : 'page'}
            className={current ? undefined : styles.here}
          >
            {current ? (
              <Link href={section} className={styles.link} onClick={onNavigate}>
                {sectionLabel}
              </Link>
            ) : (
              sectionLabel
            )}
          </li>
          {current && (
            <li aria-current="page" className={styles.here}>
              {current}
            </li>
          )}
        </ol>
      </nav>
      <h2 className={styles.title}>{title}</h2>
    </div>
  );
}
