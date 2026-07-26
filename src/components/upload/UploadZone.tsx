'use client';

import { useId, useRef, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import styles from './UploadZone.module.css';

interface Props {
  label?: string;
  hint?: string;
}

export function UploadZone({
  label = 'Drop statement CSVs here',
  hint = 'or click to browse — you can pick more than one',
}: Props) {
  const uploadFiles = useAppStore((s) => s.uploadFiles);
  const [over, setOver] = useState(false);
  const [errors, setErrors] = useState<{ file: string; message: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  async function handleFiles(list: FileList | null) {
    if (!list || !list.length) return;
    const result = await uploadFiles(Array.from(list));
    setErrors(result.errors);
  }

  return (
    <div>
      <label
        htmlFor={inputId}
        className={`${styles.zone} ${over ? styles.over : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
      >
        <span className={styles.title}>{label}</span>
        <span className={styles.hint} style={{ display: 'block' }}>
          {hint}
        </span>
        <input
          id={inputId}
          ref={inputRef}
          className={styles.input}
          type="file"
          accept=".csv,text/csv"
          multiple
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </label>

      {errors.length > 0 && (
        <ul className={styles.errors} role="alert">
          {errors.map((e) => (
            <li key={e.file}>
              <strong>{e.file}</strong> — {e.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
