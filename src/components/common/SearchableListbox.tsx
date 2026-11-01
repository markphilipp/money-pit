'use client';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import styles from './SearchableListbox.module.css';

const WIDTH = 240;
const MAX_HEIGHT = 300;

/**
 * `anchored` floats a popover under a DOMRect and is dismissed by the owner (`onClose`, called on
 * Escape, an outside click, and after a choice). `inline` sits under its own field, opens when
 * focused and closes itself on blur or Escape.
 */
export type Placement =
  | { kind: 'anchored'; rect: DOMRect; dialogLabel: string; onClose: () => void }
  | { kind: 'inline'; selectedLabel: string; autoFocus?: boolean };

export interface EmptyAction {
  label: string;
  onSelect: () => void;
}

interface Props<T> {
  search: (query: string) => T[];
  getKey: (item: T) => string;
  getColor: (item: T) => string | undefined;
  renderOption: (item: T) => ReactNode;
  isSelected?: (item: T) => boolean;
  onChoose: (item: T) => void;
  /** Offered in place of the options when the search has none; Enter takes it too. */
  emptyAction?: (query: string) => EmptyAction | null;
  label: string;
  listLabel: string;
  placeholder: string;
  emptyText: string;
  placement: Placement;
}

function useAnchorPosition(ref: RefObject<HTMLElement | null>, rect: DOMRect | undefined) {
  const [pos, setPos] = useState({ left: rect?.left ?? 0, top: (rect?.bottom ?? 0) + 6 });

  useLayoutEffect(() => {
    if (!rect) return;
    const height = Math.min(ref.current?.offsetHeight ?? MAX_HEIGHT, MAX_HEIGHT);
    let left = rect.left;
    let top = rect.bottom + 6;
    if (left + WIDTH > document.documentElement.clientWidth - 8) {
      left = document.documentElement.clientWidth - WIDTH - 8;
    }
    if (rect.bottom + height > window.innerHeight - 8) top = rect.top - height - 6;
    setPos({ left: Math.max(left, 8), top: Math.max(top, 8) });
  }, [ref, rect]);

  return pos;
}

export function SearchableListbox<T>({
  search,
  getKey,
  getColor,
  renderOption,
  isSelected,
  onChoose,
  emptyAction,
  label,
  listLabel,
  placeholder,
  emptyText,
  placement,
}: Props<T>) {
  const id = useId();
  const listId = `${id}-list`;
  const anchored = placement.kind === 'anchored';
  const rect = anchored ? placement.rect : undefined;
  const onDismiss = anchored ? placement.onClose : undefined;
  const shouldFocus = anchored || !!placement.autoFocus;

  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [inlineOpen, setInlineOpen] = useState(shouldFocus);
  const open = anchored || inlineOpen;
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pos = useAnchorPosition(ref, rect);

  const options = useMemo(() => search(query), [search, query]);
  const action = open && options.length === 0 ? (emptyAction?.(query) ?? null) : null;
  const active = open ? options[highlight] : undefined;
  const activeId = active ? `${id}-option-${getKey(active)}` : undefined;

  // A context menu that opened the picker restores focus as it unmounts, so focus after it settles.
  useEffect(() => {
    if (!shouldFocus) return;
    inputRef.current?.focus();
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [shouldFocus]);

  useEffect(() => {
    if (!onDismiss) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onDismiss();
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [onDismiss]);

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeId]);

  const close = () => {
    if (onDismiss) onDismiss();
    else {
      setInlineOpen(false);
      setQuery('');
      setHighlight(0);
    }
  };

  const choose = (item: T) => {
    onChoose(item);
    close();
  };

  const selectAction = () => {
    action?.onSelect();
    close();
  };

  const input = (
    <input
      id={`${id}-input`}
      ref={inputRef}
      className={anchored ? styles.search : undefined}
      type="text"
      role="combobox"
      autoComplete="off"
      placeholder={placeholder}
      aria-label={anchored ? label : undefined}
      aria-expanded={open}
      aria-controls={listId}
      aria-autocomplete="list"
      aria-activedescendant={activeId}
      value={open ? query : placement.kind === 'inline' ? placement.selectedLabel : ''}
      onFocus={anchored ? undefined : () => setInlineOpen(true)}
      onClick={anchored ? undefined : () => setInlineOpen(true)}
      onBlur={anchored ? undefined : close}
      onChange={(e) => {
        setInlineOpen(true);
        setQuery(e.target.value);
        setHighlight(0);
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (!open) setInlineOpen(true);
          else setHighlight((h) => Math.min(h + 1, options.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setHighlight((h) => Math.max(h - 1, 0));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (options[highlight] && open) choose(options[highlight]);
          else if (action) selectAction();
        } else if (e.key === 'Escape' && open) {
          e.preventDefault();
          close();
        }
      }}
    />
  );

  const list = open && (
    <div
      id={listId}
      className={styles.list}
      role="listbox"
      aria-label={listLabel}
      onMouseDown={anchored ? undefined : (e) => e.preventDefault()}
    >
      {options.length === 0 && !action && <p className={styles.empty}>{emptyText}</p>}
      {action && (
        <button type="button" className={`${styles.item} ${styles.hl}`} onClick={selectAction}>
          <span className={styles.plus} aria-hidden="true">
            +
          </span>
          {action.label}
        </button>
      )}
      {options.map((item, i) => (
        <button
          key={getKey(item)}
          id={`${id}-option-${getKey(item)}`}
          type="button"
          role="option"
          tabIndex={anchored ? undefined : -1}
          aria-selected={!!isSelected?.(item)}
          className={`${styles.item} ${i === highlight ? styles.hl : ''}`}
          onMouseEnter={() => setHighlight(i)}
          onClick={() => choose(item)}
        >
          <span className={styles.dot} style={{ background: getColor(item) }} />
          {renderOption(item)}
          {isSelected?.(item) && (
            <span className={styles.check} aria-hidden="true">
              ✓
            </span>
          )}
        </button>
      ))}
    </div>
  );

  if (placement.kind === 'anchored') {
    return (
      <div
        ref={ref}
        className={styles.anchored}
        style={{ left: pos.left, top: pos.top }}
        role="dialog"
        aria-label={placement.dialogLabel}
      >
        {input}
        {list}
      </div>
    );
  }
  return (
    <div ref={ref} className={`field ${styles.inline}`}>
      <label htmlFor={`${id}-input`}>{label}</label>
      {input}
      {list}
    </div>
  );
}
