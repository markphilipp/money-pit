'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CategoryRule } from '@/lib/types';
import { PAYMENTS_ID } from '@/lib/types';
import styles from './CategoryPicker.module.css';

const WIDTH = 240;
const MAX_HEIGHT = 300;

export interface PickerAnchor {
  rect: DOMRect;
  currentCategoryId: string | null;
  onChoose: (categoryId: string) => void;
}

interface Props extends PickerAnchor {
  rules: CategoryRule[];
  onClose: () => void;
}

export function CategoryPicker({ rect, currentCategoryId, onChoose, rules, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: rect.left, top: rect.bottom + 6 });

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rules.filter((r) => r.id !== PAYMENTS_ID && (!q || r.name.toLowerCase().includes(q)));
  }, [rules, query]);

  useLayoutEffect(() => {
    const height = Math.min(ref.current?.offsetHeight ?? MAX_HEIGHT, MAX_HEIGHT);
    let left = rect.left;
    let top = rect.bottom + 6;
    if (left + WIDTH > document.documentElement.clientWidth - 8) {
      left = document.documentElement.clientWidth - WIDTH - 8;
    }
    if (rect.bottom + height > window.innerHeight - 8) top = rect.top - height - 6;
    setPos({ left: Math.max(left, 8), top: Math.max(top, 8) });
  }, [rect]);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [onClose]);

  const choose = (id: string) => {
    onChoose(id);
    onClose();
  };

  return (
    <div
      ref={ref}
      className={styles.picker}
      style={{ left: pos.left, top: pos.top }}
      role="dialog"
      aria-label="Choose category"
    >
      <input
        className={styles.search}
        type="text"
        autoFocus
        autoComplete="off"
        placeholder="Search categories…"
        role="combobox"
        aria-label="Search categories"
        aria-expanded
        aria-controls="category-picker-list"
        aria-activedescendant={
          options[highlight] ? `category-option-${options[highlight].id}` : undefined
        }
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, options.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            const option = options[highlight];
            if (option) choose(option.id);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        }}
      />
      <div className={styles.list} id="category-picker-list" role="listbox" aria-label="Categories">
        {options.length === 0 && <p className={styles.empty}>No matching category</p>}
        {options.map((rule, i) => (
          <button
            key={rule.id}
            id={`category-option-${rule.id}`}
            type="button"
            role="option"
            aria-selected={rule.id === currentCategoryId}
            className={`${styles.item} ${i === highlight ? styles.hl : ''}`}
            onMouseEnter={() => setHighlight(i)}
            onClick={() => choose(rule.id)}
          >
            <span className={styles.dot} style={{ background: rule.color }} />
            {rule.name}
            {rule.id === currentCategoryId && (
              <span className={styles.check} aria-hidden="true">
                ✓
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
