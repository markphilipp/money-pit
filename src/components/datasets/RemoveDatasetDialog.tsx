'use client';

import { useMemo } from 'react';
import type { Dataset } from '@/lib/types';
import { datasetImpact } from '@/lib/datasets';
import { useAppStore } from '@/store/useAppStore';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function RemoveDatasetDialog({
  dataset,
  isLast,
  returnFocusTo,
  onClose,
}: {
  dataset: Dataset;
  isLast: boolean;
  returnFocusTo: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  const datasets = useAppStore((s) => s.datasets);
  const overrides = useAppStore((s) => s.overrides);
  const removeDataset = useAppStore((s) => s.removeDataset);

  const impact = useMemo(
    () => datasetImpact(datasets, overrides, dataset.id),
    [datasets, overrides, dataset.id],
  );

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Remove “${dataset.name}”?`}
      confirmLabel="Remove file"
      onConfirm={() => removeDataset(dataset.id)}
      returnFocusTo={returnFocusTo}
      description={
        <>
          <p>
            {impact.transactions > 0
              ? `Removes ${count(impact.transactions, 'transaction', 'transactions')}.`
              : 'Removes no transactions: every one also appears in another file.'}
            {impact.shared > 0 &&
              impact.transactions > 0 &&
              ` ${count(impact.shared, 'more also appears', 'more also appear')} in other files and ${impact.shared === 1 ? 'stays' : 'stay'}.`}
          </p>
          {impact.lostOverrides > 0 && (
            <p>
              {count(impact.lostOverrides, 'manual category change', 'manual category changes')}{' '}
              will be lost.
            </p>
          )}
          {isLast && (
            <p>
              This is your only file, so the dashboard will go back to the upload screen. Your
              categories and rules stay.
            </p>
          )}
        </>
      }
    />
  );
}
