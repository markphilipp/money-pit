'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './UndoToast.module.css';

export const UNDO_TOAST_MS = 6000;

interface UndoToastProps {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
}

/** Mount it with a fresh `key` per toast so the timer restarts. */
export function UndoToast({ message, onUndo, onDismiss }: UndoToastProps) {
  const [held, setHeld] = useState(false);
  // The parent passes a new callback every render; the timer must not restart for that.
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (held) return;
    const timer = setTimeout(() => dismissRef.current(), UNDO_TOAST_MS);
    return () => clearTimeout(timer);
  }, [held]);

  return (
    <div
      className={styles.toast}
      role="status"
      aria-live="polite"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <span>{message}</span>
      <button className={styles.action} onClick={onUndo}>
        Undo
      </button>
      <button className={styles.dismiss} aria-label="Dismiss" onClick={onDismiss}>
        ×
      </button>
    </div>
  );
}
