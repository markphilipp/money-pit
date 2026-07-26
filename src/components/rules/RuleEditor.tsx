'use client';

import { useState } from 'react';
import type { CategoryRule } from '@/lib/types';
import { useAppStore } from '@/store/useAppStore';
import styles from './Rules.module.css';

interface Props {
  rule: CategoryRule;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export function RuleEditor({ rule, canMoveUp, canMoveDown }: Props) {
  const setRule = useAppStore((s) => s.setRule);
  // Keeps the raw text while typing — normalizing straight back into the input would eat
  // the space after a comma and inside multi-word keywords.
  const [keywordDraft, setKeywordDraft] = useState(rule.keywords.join(', '));
  const deleteRule = useAppStore((s) => s.deleteRule);
  const reorderRules = useAppStore((s) => s.reorderRules);

  return (
    <div className={styles.rule}>
      <input
        className={styles.swatch}
        type="color"
        value={rule.color}
        aria-label={`Color for ${rule.name}`}
        onChange={(e) => setRule(rule.id, { color: e.target.value })}
      />
      <input
        type="text"
        value={rule.name}
        aria-label={`Name for ${rule.name}`}
        onChange={(e) => setRule(rule.id, { name: e.target.value })}
      />
      {rule.id === 'other' ? (
        <span className={styles.builtin}>Fallback — no keywords</span>
      ) : (
        <input
          type="text"
          className={styles.keywords}
          value={keywordDraft}
          aria-label={`Keywords for ${rule.name}`}
          placeholder="COMMA, SEPARATED, KEYWORDS"
          onChange={(e) => {
            setKeywordDraft(e.target.value);
            setRule(rule.id, {
              keywords: e.target.value
                .split(',')
                .map((k) => k.trim())
                .filter(Boolean),
            });
          }}
        />
      )}
      <div className={styles.actions}>
        <button
          className={styles.iconBtn}
          disabled={!canMoveUp}
          aria-label={`Move ${rule.name} up`}
          onClick={() => reorderRules(rule.id, -1)}
        >
          ▲
        </button>
        <button
          className={styles.iconBtn}
          disabled={!canMoveDown}
          aria-label={`Move ${rule.name} down`}
          onClick={() => reorderRules(rule.id, 1)}
        >
          ▼
        </button>
        <button
          className={styles.iconBtn}
          disabled={rule.builtin}
          aria-label={`Delete ${rule.name}`}
          title={rule.builtin ? 'Built-in categories cannot be deleted' : 'Delete category'}
          onClick={() => deleteRule(rule.id)}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
