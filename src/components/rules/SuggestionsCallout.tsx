'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { discoverProposals, type RuleProposal } from '@/lib/rules/discover';
import { useAppState, useTransactions } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import styles from './SuggestionsCallout.module.css';

const MAX_SHOWN = 5;

interface Props {
  /** Where focus goes once the last proposal is dismissed and the dialog is gone. */
  onEmpty?: () => void;
}

export function SuggestionsCallout({ onEmpty }: Props) {
  const { overrides, dismissedSuggestions } = useAppState();
  const txns = useTransactions();
  const setRuleSources = useAppStore((s) => s.setRuleSources);
  const dismissSuggestion = useAppStore((s) => s.dismissSuggestion);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const proposals = useMemo(
    () => discoverProposals(txns, overrides, new Set(dismissedSuggestions)),
    [txns, overrides, dismissedSuggestions],
  );
  if (!proposals.length) return null;

  const createRule = (proposal: RuleProposal) => {
    setRuleSources(proposal.txnIds);
    router.push('/settings/rules/new');
  };

  const dismiss = (proposal: RuleProposal) => {
    dismissSuggestion(proposal.key);
    if (proposals.length === 1) {
      setOpen(false);
      setTimeout(() => onEmpty?.(), 0);
    } else contentRef.current?.focus();
  };

  const shown = proposals.slice(0, MAX_SHOWN);
  const count = proposals.length;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className={styles.pill} aria-haspopup="dialog">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="6" />
          <path d="M8 5.5v5M5.5 8h5" />
        </svg>
        <span>
          <strong>{count}</strong> rule {count === 1 ? 'suggestion' : 'suggestions'}
        </span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content ref={contentRef} className={styles.dialog}>
          <Dialog.Title className={styles.title}>Rule suggestions for Other</Dialog.Title>
          <Dialog.Description className={styles.description}>
            Rows left in Other that share a pattern. Create a rule to categorize them in one go.
          </Dialog.Description>
          <ul className={styles.list}>
            {shown.map((proposal) => (
              <li key={proposal.key} className={styles.card}>
                <div className={styles.label}>{proposal.label}</div>
                <div className={styles.meta}>Covers {proposal.txnIds.length} rows in Other</div>
                <ul className={styles.samples}>
                  {proposal.samples.map((sample) => (
                    <li key={sample} title={sample}>
                      {sample}
                    </li>
                  ))}
                </ul>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.primary}
                    aria-label={`Create rule for ${proposal.label}`}
                    onClick={() => createRule(proposal)}
                  >
                    Create rule
                  </button>
                  <button
                    type="button"
                    className={styles.secondary}
                    aria-label={`Dismiss ${proposal.label}`}
                    onClick={() => dismiss(proposal)}
                  >
                    Dismiss
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className={styles.footer}>
            {count > MAX_SHOWN ? (
              <p className={styles.more}>
                Showing the {MAX_SHOWN} largest of {count}.
              </p>
            ) : (
              <span />
            )}
            <Dialog.Close className={styles.close}>Close</Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
