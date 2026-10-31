'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { discoverProposals, type RuleProposal } from '@/lib/rules/discover';
import { useAppState, useTransactions } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import styles from './SuggestionsStrip.module.css';

const MAX_SHOWN = 5;

export function SuggestionsStrip() {
  const { overrides, dismissedSuggestions } = useAppState();
  const txns = useTransactions();
  const setRuleSources = useAppStore((s) => s.setRuleSources);
  const dismissSuggestion = useAppStore((s) => s.dismissSuggestion);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

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
    // the card holding focus is about to unmount
    toggleRef.current?.focus();
  };

  const shown = proposals.slice(0, MAX_SHOWN);
  const count = proposals.length;

  return (
    <section className={styles.strip} aria-label="Rule suggestions">
      <button
        ref={toggleRef}
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
      >
        <span>
          <strong>{count}</strong> rule {count === 1 ? 'suggestion' : 'suggestions'} for Other
        </span>
        <svg
          className={styles.chevron}
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3.5 6l4.5 4.5L12.5 6" />
        </svg>
      </button>

      {open && (
        <div id={listId} className={styles.body}>
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
          {count > MAX_SHOWN && (
            <p className={styles.more}>
              Showing the {MAX_SHOWN} largest of {count}.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
