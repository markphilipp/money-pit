'use client';

import Link from 'next/link';
import { describeGroup } from '@/lib/rules/engine';
import { useAppStore, useHydrated } from '@/store/useAppStore';
import screen from './RuleScreen.module.css';
import styles from './RulesScreen.module.css';

export function RulesScreen() {
  const hydrated = useHydrated();
  const rules = useAppStore((s) => s.rules);
  const reorderRules = useAppStore((s) => s.reorderRules);
  const deleteRule = useAppStore((s) => s.deleteRule);
  const setRuleSources = useAppStore((s) => s.setRuleSources);

  const movable = rules.filter((r) => !r.builtin);

  return (
    <main className={`wrap ${screen.screen}`}>
      <div className={screen.topBar}>
        <Link href="/" className={screen.back}>
          ← Back
        </Link>
        <h1 className={screen.title}>Category rules</h1>
      </div>

      <section className={`card ${screen.section}`}>
        <p className="sub">First matching rule wins — order matters.</p>

        {!hydrated ? (
          <p className={screen.empty} aria-busy="true">
            Loading rules…
          </p>
        ) : (
          <ul className={styles.list}>
            {rules.map((rule, i) => (
              <li key={rule.id} className={styles.row}>
                <span className={styles.dot} style={{ background: rule.color }} />
                <span className={styles.name}>{rule.name}</span>
                <span className={styles.summary}>{describeGroup(rule.conditions)}</span>
                <span className={styles.rowActions}>
                  <button
                    className={styles.iconBtn}
                    disabled={rule.builtin || i === 0}
                    aria-label={`Move ${rule.name} up`}
                    onClick={() => reorderRules(rule.id, -1)}
                  >
                    ▲
                  </button>
                  <button
                    className={styles.iconBtn}
                    disabled={rule.builtin || i >= movable.length - 1}
                    aria-label={`Move ${rule.name} down`}
                    onClick={() => reorderRules(rule.id, 1)}
                  >
                    ▼
                  </button>
                  <Link
                    className={styles.iconBtn}
                    href={`/rules/${encodeURIComponent(rule.id)}`}
                    aria-label={`Edit ${rule.name}`}
                  >
                    Edit
                  </Link>
                  <button
                    className={styles.iconBtn}
                    disabled={rule.builtin}
                    aria-label={`Delete ${rule.name}`}
                    title={rule.builtin ? 'Built-in categories cannot be deleted' : undefined}
                    onClick={() => deleteRule(rule.id)}
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className={screen.actions}>
        {/* A hand-written rule has no source transactions; drop any left over from the table. */}
        <Link href="/rules/new" className={screen.save} onClick={() => setRuleSources([])}>
          New rule
        </Link>
        <span className={screen.spacer} />
        <Link href="/" className="btn-clear">
          Done
        </Link>
      </div>
    </main>
  );
}
