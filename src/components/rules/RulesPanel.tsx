'use client';

import { useId, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { RuleEditor } from './RuleEditor';
import styles from './Rules.module.css';

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'category'
  );
}

export function RulesPanel() {
  const rules = useAppStore((s) => s.rules);
  const addRule = useAppStore((s) => s.addRule);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [keywords, setKeywords] = useState('');
  const panelId = useId();

  const movable = rules.filter((r) => !r.builtin);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    let id = slugify(trimmed);
    while (rules.some((r) => r.id === id)) id = `${id}-1`;
    addRule({
      id,
      name: trimmed,
      color: '#3A7CA5',
      keywords: keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
    });
    setName('');
    setKeywords('');
  }

  return (
    <section className={styles.panel}>
      <button
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? '▾' : '▸'} Category rules ({rules.length})
      </button>

      {open && (
        <div className={`card ${styles.body}`} id={panelId}>
          <h2>Category rules</h2>
          <p className={styles.intro}>
            The first rule whose keyword appears in a description wins, so order matters. Manual
            corrections you made in the table always override these.
          </p>

          {rules.map((rule, i) => (
            <RuleEditor
              key={rule.id}
              rule={rule}
              canMoveUp={!rule.builtin && i > 0}
              canMoveDown={!rule.builtin && i < movable.length - 1}
            />
          ))}

          <form className={styles.addRow} onSubmit={submit}>
            <div className="field">
              <label htmlFor={`${panelId}-name`}>New category</label>
              <input
                id={`${panelId}-name`}
                type="text"
                value={name}
                placeholder="e.g. Travel"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor={`${panelId}-keywords`}>Keywords</label>
              <input
                id={`${panelId}-keywords`}
                type="text"
                value={keywords}
                placeholder="DELTA, MARRIOTT"
                onChange={(e) => setKeywords(e.target.value)}
              />
            </div>
            <button className={styles.addBtn} type="submit">
              Add rule
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
