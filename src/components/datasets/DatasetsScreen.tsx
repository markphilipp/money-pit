'use client';

import { useState } from 'react';
import type { Dataset } from '@/lib/types';
import { datasetSpan } from '@/lib/datasets';
import { UploadZone } from '@/components/upload/UploadZone';
import { useAppStore, useHydrated } from '@/store/useAppStore';
import screen from '@/components/rules/RuleScreen.module.css';
import { RemoveDatasetDialog } from './RemoveDatasetDialog';
import styles from './DatasetsScreen.module.css';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function describeDataset({ rows, uploadedAt }: Dataset): string {
  const span = datasetSpan(rows);
  return [
    plural(rows.length, 'transaction'),
    span && day.formatRange(span.from, span.to),
    `uploaded ${day.format(new Date(uploadedAt))}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function DatasetsScreen() {
  const hydrated = useHydrated();

  return (
    <div className={screen.screen}>
      <h2 className={screen.title}>Uploaded files</h2>

      {hydrated ? (
        <DatasetList />
      ) : (
        <section className={`card ${screen.section}`}>
          <p className={screen.empty} aria-busy="true">
            Loading files…
          </p>
        </section>
      )}
    </div>
  );
}

function DatasetList() {
  const datasets = useAppStore((s) => s.datasets);
  const [removing, setRemoving] = useState<{
    dataset: Dataset;
    trigger: HTMLButtonElement;
  } | null>(null);

  return (
    <>
      <section className={`card ${screen.section}`}>
        <p className="sub">
          Each file you upload is kept as its own entry, so a mistaken upload can be taken back.
          Transactions that appear in more than one file are only counted once.
        </p>
        {datasets.length === 0 ? (
          <p className={screen.empty}>No files uploaded yet.</p>
        ) : (
          <ul className={styles.list}>
            {datasets.map((dataset) => (
              <li key={dataset.id} className={styles.row}>
                <span className={styles.name}>{dataset.name}</span>
                <span className={styles.meta}>{describeDataset(dataset)}</span>
                <button
                  type="button"
                  className={styles.iconBtn}
                  aria-label={`Remove ${dataset.name}`}
                  onClick={(e) => setRemoving({ dataset, trigger: e.currentTarget })}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <UploadZone label="Drop more statement CSVs here" />
      </section>
      {removing && (
        <RemoveDatasetDialog
          dataset={removing.dataset}
          isLast={datasets.length === 1}
          returnFocusTo={{ current: removing.trigger }}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  );
}
