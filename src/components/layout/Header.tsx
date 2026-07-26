import Image from 'next/image';
import styles from './Header.module.css';

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <Image
          className={styles.mark}
          src="/money-pit-mark.png"
          alt=""
          width={320}
          height={246}
          priority
        />
        <h1 className={styles.lockup}>
          <span className={styles.script}>The</span>{' '}
          <span className={styles.wordmark}>
            <span className={styles.money}>Money</span> <span className={styles.pit}>Pit</span>
          </span>
        </h1>
      </div>
    </header>
  );
}
