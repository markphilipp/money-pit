'use client';

import { useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { filterToRange } from '@/lib/dateRange';
import {
  describePeriod,
  optionToPeriod,
  periodOptions,
  searchPeriods,
  type PeriodOption,
} from '@/lib/periods';
import { useAppStore } from '@/store/useAppStore';
import styles from './PeriodFilter.module.css';

type Mode = 'list' | 'custom';

const PANEL_WIDTH = 340;

export function PeriodFilter() {
  const id = useId();
  const listId = `${id}-list`;
  const datasets = useAppStore((s) => s.datasets);
  const statementIds = useAppStore((s) => s.filters.statementIds);
  const dateFilter = useAppStore((s) => s.filters.columnFilters.date);
  const setPeriod = useAppStore((s) => s.setPeriod);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('list');
  const [query, setQuery] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  // "Today" is read when the panel opens, so a tab left open overnight doesn't offer yesterday.
  const [now, setNow] = useState(() => new Date());
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipOpenOnFocus = useRef(false);

  // The panel is wider than the field, so slide it left when it would run off the viewport.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!open || !root) return;
    const place = () => {
      const { left } = root.getBoundingClientRect();
      const room = document.documentElement.clientWidth - 12 - left;
      const shift = Math.max(0, Math.min(PANEL_WIDTH - room, left - 12));
      root.style.setProperty('--panel-shift', `${-shift}px`);
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open, mode]);

  const base = useMemo(() => periodOptions({ datasets, now }), [datasets, now]);
  const groups = useMemo(() => searchPeriods(base, query ?? '', now), [base, query, now]);
  const flat = useMemo(() => groups.flatMap((g) => g.options), [groups]);
  const display = describePeriod(datasets, statementIds, dateFilter);
  const range = filterToRange(dateFilter);
  const expanded = open && mode === 'list';
  const activeKey = expanded ? flat[highlight]?.key : undefined;
  const optionId = (key: string) => `${id}-option-${key}`;
  const noMatches = query !== null && !flat.some((o) => o.kind !== 'custom');

  const openPanel = () => {
    if (open) return;
    setNow(new Date());
    setMode('list');
    setHighlight(0);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setMode('list');
    setQuery(null);
  };

  const focusInput = () => {
    skipOpenOnFocus.current = true;
    inputRef.current?.focus();
  };

  const choose = (option: PeriodOption) => {
    if (option.kind === 'custom') {
      setMode('custom');
      return;
    }
    setPeriod(optionToPeriod(option));
    close();
  };

  const move = (to: number) => setHighlight(Math.max(0, Math.min(to, flat.length - 1)));

  const onKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!expanded) openPanel();
        else move(highlight + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (expanded) move(highlight - 1);
        break;
      case 'Home':
      case 'End':
        if (!expanded) break;
        e.preventDefault();
        move(e.key === 'Home' ? 0 : flat.length - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (expanded && flat[highlight]) choose(flat[highlight]);
        break;
      case 'Escape':
        if (!open) break;
        e.preventDefault();
        close();
        focusInput();
        break;
    }
  };

  const write = (from: string, to: string) => setPeriod({ from, to });

  const isCurrent = (option: PeriodOption): boolean => {
    if (option.kind === 'statement') return statementIds.includes(option.datasetId);
    if (option.kind === 'range') {
      return option.range.from === range.from && option.range.to === range.to && !!dateFilter;
    }
    return false;
  };

  return (
    <div
      ref={rootRef}
      className={`${styles.root} ${display ? styles.active : ''}`}
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node | null)) close();
      }}
      onKeyDown={(e) => {
        if (mode === 'custom' && e.key === 'Escape') onKeyDown(e);
      }}
    >
      <input
        ref={inputRef}
        className={styles.input}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-label="Filter by period"
        placeholder="All dates"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeKey ? optionId(activeKey) : undefined}
        value={query ?? display}
        onFocus={(e) => {
          if (skipOpenOnFocus.current) skipOpenOnFocus.current = false;
          else openPanel();
          e.target.select();
        }}
        onClick={openPanel}
        onChange={(e) => {
          openPanel();
          setMode('list');
          setQuery(e.target.value);
          setHighlight(0);
        }}
        onKeyDown={mode === 'list' ? onKeyDown : undefined}
      />
      {display && (
        <button
          type="button"
          className={styles.clear}
          aria-label="Clear date filter"
          onClick={() => {
            setPeriod(null);
            close();
          }}
        >
          ×
        </button>
      )}

      {expanded && (
        <div className={styles.panel}>
          <div
            id={listId}
            className={styles.list}
            role="listbox"
            aria-label="Periods"
            // Keeps focus in the input; otherwise some browsers blur it before the click lands.
            onMouseDown={(e) => e.preventDefault()}
          >
            {noMatches && <p className={styles.empty}>No matching period</p>}
            {groups.map((group) => {
              const rows = group.options.map((option) => {
                const i = flat.indexOf(option);
                const selected = isCurrent(option);
                return (
                  <div
                    key={option.key}
                    id={optionId(option.key)}
                    role="option"
                    aria-selected={selected}
                    className={`${styles.option} ${i === highlight ? styles.hl : ''} ${
                      selected ? styles.selected : ''
                    }`}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => choose(option)}
                  >
                    <span className={styles.name}>{option.label}</span>
                    {option.hint && <span className={styles.hint}>{option.hint}</span>}
                  </div>
                );
              });
              return group.heading ? (
                <div
                  key={group.id}
                  role="group"
                  aria-labelledby={`${id}-${group.id}`}
                  className={styles.group}
                >
                  <div id={`${id}-${group.id}`} className={styles.heading}>
                    {group.heading}
                  </div>
                  {rows}
                </div>
              ) : (
                rows
              );
            })}
          </div>
        </div>
      )}

      {open && mode === 'custom' && (
        <CustomRange
          className={styles.panel}
          from={range.from}
          to={range.to}
          onChange={write}
          onBack={() => {
            setMode('list');
            focusInput();
          }}
          onDone={() => {
            close();
            focusInput();
          }}
        />
      )}
    </div>
  );
}

function CustomRange({
  className,
  from,
  to,
  onChange,
  onBack,
  onDone,
}: {
  className: string;
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  onBack: () => void;
  onDone: () => void;
}) {
  return (
    <div className={className} role="group" aria-label="Custom date range">
      <div className={styles.custom}>
        <label className={styles.field}>
          From
          <input
            className={styles.date}
            type="date"
            autoFocus
            value={from}
            onChange={(e) => onChange(e.target.value, to)}
          />
        </label>
        <label className={styles.field}>
          To
          <input
            className={styles.date}
            type="date"
            value={to}
            onChange={(e) => onChange(from, e.target.value)}
          />
        </label>
        <div className={styles.actions}>
          <button type="button" className={styles.btn} onClick={onBack}>
            Back
          </button>
          <button type="button" className={styles.btn} onClick={onDone}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
