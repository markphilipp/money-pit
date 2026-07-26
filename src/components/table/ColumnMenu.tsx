'use client';

import { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type {
  ColumnFilter,
  ColumnId,
  DateOperator,
  NumberOperator,
  TextOperator,
} from '@/lib/rules/types';
import styles from './ColumnMenu.module.css';

interface ColumnMenuProps {
  label: string;
  columnId: ColumnId;
  sort: { active: boolean; dir: 1 | -1 };
  onSort: (dir: 1 | -1) => void;
  filter: ColumnFilter | null;
  onFilter: (filter: ColumnFilter | null) => void;
  options?: { value: string; label: string; color?: string }[];
  align?: 'right';
}

const TEXT_OPERATORS: [TextOperator, string][] = [
  ['contains', 'Contains'],
  ['notContains', 'Does not contain'],
  ['equals', 'Equals'],
  ['beginsWith', 'Begins with'],
  ['endsWith', 'Ends with'],
  ['regex', 'Matches regex'],
  ['glob', 'Matches pattern'],
];

const NUMBER_OPERATORS: [NumberOperator, string][] = [
  ['eq', '='],
  ['neq', '≠'],
  ['lt', '<'],
  ['lte', '≤'],
  ['gt', '>'],
  ['gte', '≥'],
  ['between', 'Between'],
];

const DATE_OPERATORS: [DateOperator, string][] = [
  ['on', 'On'],
  ['before', 'Before'],
  ['after', 'After'],
  ['between', 'Between'],
];

const HINTS: Partial<Record<TextOperator, string>> = {
  glob: '* any run of characters, ? one character',
  regex: 'JS regex, case-insensitive',
};

export function ColumnMenu({
  label,
  columnId,
  sort,
  onSort,
  filter,
  onFilter,
  options,
  align,
}: ColumnMenuProps) {
  return (
    // Non-modal so the table stays visible (and live-updating) behind an open filter menu.
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          className={`${styles.trigger} ${align === 'right' ? styles.right : ''}`}
          aria-label={`${label} column menu`}
        >
          {label}
          <span className={styles.marks} aria-hidden="true">
            {sort.active && (sort.dir === 1 ? '▲' : '▼')}
            {filter && (
              <svg className={styles.funnel} viewBox="0 0 10 10">
                <path d="M0 1h10L6 5.5V10L4 8.5V5.5z" />
              </svg>
            )}
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={styles.menu}
          align={align === 'right' ? 'end' : 'start'}
          sideOffset={4}
        >
          <DropdownMenu.Item className={styles.item} onSelect={() => onSort(1)}>
            Sort ascending
          </DropdownMenu.Item>
          <DropdownMenu.Item className={styles.item} onSelect={() => onSort(-1)}>
            Sort descending
          </DropdownMenu.Item>
          <DropdownMenu.Separator className={styles.separator} />

          {/* Plain containers, not menu items: Radix would close the menu on every keystroke. */}
          <div className={styles.section} onKeyDown={(e) => e.stopPropagation()}>
            <FilterSection
              columnId={columnId}
              filter={filter}
              onFilter={onFilter}
              options={options}
            />
          </div>

          <DropdownMenu.Separator className={styles.separator} />
          <DropdownMenu.Item
            className={styles.item}
            disabled={!filter}
            onSelect={() => onFilter(null)}
          >
            Clear filter
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

type FilterSectionProps = Pick<ColumnMenuProps, 'columnId' | 'filter' | 'onFilter' | 'options'>;

function FilterSection({ columnId, filter, onFilter, options }: FilterSectionProps) {
  if (columnId === 'person' || columnId === 'category') {
    return <Checklist column={columnId} filter={filter} onFilter={onFilter} options={options} />;
  }
  if (columnId === 'amount') return <AmountFilter filter={filter} onFilter={onFilter} />;
  if (columnId === 'date') return <DateFilter filter={filter} onFilter={onFilter} />;
  return <TextFilter filter={filter} onFilter={onFilter} />;
}

function Checklist({
  column,
  filter,
  onFilter,
  options = [],
}: { column: 'person' | 'category' } & Omit<FilterSectionProps, 'columnId'>) {
  const values = filter && 'values' in filter ? filter.values : [];

  const toggle = (value: string) => {
    const next = values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
    onFilter(next.length ? { column, values: next } : null);
  };

  return (
    <div className={styles.checklist}>
      {options.length === 0 && <p className={styles.hint}>Nothing to filter yet.</p>}
      {options.map((option) => (
        <label key={option.value} className={styles.check}>
          <input
            type="checkbox"
            checked={values.includes(option.value)}
            onChange={() => toggle(option.value)}
          />
          {option.color && <span className={styles.dot} style={{ background: option.color }} />}
          {option.label}
        </label>
      ))}
    </div>
  );
}

function TextFilter({ filter, onFilter }: Omit<FilterSectionProps, 'columnId' | 'options'>) {
  const current = filter && filter.column === 'description' ? filter : null;
  const [operator, setOperator] = useState<TextOperator>(current?.operator ?? 'contains');
  const [value, setValue] = useState(current?.value ?? '');

  const emit = (nextOperator: TextOperator, nextValue: string) => {
    setOperator(nextOperator);
    setValue(nextValue);
    onFilter(
      nextValue ? { column: 'description', operator: nextOperator, value: nextValue } : null,
    );
  };

  return (
    <>
      <select
        className={styles.select}
        aria-label="Description filter operator"
        value={operator}
        onChange={(e) => emit(e.target.value as TextOperator, value)}
      >
        {TEXT_OPERATORS.map(([op, text]) => (
          <option key={op} value={op}>
            {text}
          </option>
        ))}
      </select>
      <input
        className={styles.input}
        type="text"
        aria-label="Description filter value"
        value={value}
        onChange={(e) => emit(operator, e.target.value)}
      />
      {HINTS[operator] && <p className={styles.hint}>{HINTS[operator]}</p>}
    </>
  );
}

function AmountFilter({ filter, onFilter }: Omit<FilterSectionProps, 'columnId' | 'options'>) {
  const current = filter && filter.column === 'amount' ? filter : null;
  const [operator, setOperator] = useState<NumberOperator>(current?.operator ?? 'gte');
  const [value, setValue] = useState(current ? String(current.value) : '');
  const [value2, setValue2] = useState(current?.value2 != null ? String(current.value2) : '');

  const emit = (nextOperator: NumberOperator, next: string, next2: string) => {
    setOperator(nextOperator);
    setValue(next);
    setValue2(next2);
    if (next === '' || Number.isNaN(Number(next))) return onFilter(null);
    onFilter({
      column: 'amount',
      operator: nextOperator,
      value: Number(next),
      ...(nextOperator === 'between' && next2 !== '' ? { value2: Number(next2) } : {}),
    });
  };

  return (
    <>
      <select
        className={styles.select}
        aria-label="Amount filter operator"
        value={operator}
        onChange={(e) => emit(e.target.value as NumberOperator, value, value2)}
      >
        {NUMBER_OPERATORS.map(([op, text]) => (
          <option key={op} value={op}>
            {text}
          </option>
        ))}
      </select>
      <div className={styles.pair}>
        <input
          className={styles.input}
          type="number"
          step="0.01"
          aria-label="Amount filter value"
          value={value}
          onChange={(e) => emit(operator, e.target.value, value2)}
        />
        {operator === 'between' && (
          <input
            className={styles.input}
            type="number"
            step="0.01"
            aria-label="Amount filter upper value"
            value={value2}
            onChange={(e) => emit(operator, value, e.target.value)}
          />
        )}
      </div>
    </>
  );
}

function DateFilter({ filter, onFilter }: Omit<FilterSectionProps, 'columnId' | 'options'>) {
  const current = filter && filter.column === 'date' ? filter : null;
  const [operator, setOperator] = useState<DateOperator>(current?.operator ?? 'on');
  const [value, setValue] = useState(current?.value ?? '');
  const [value2, setValue2] = useState(current?.value2 ?? '');

  const emit = (nextOperator: DateOperator, next: string, next2: string) => {
    setOperator(nextOperator);
    setValue(next);
    setValue2(next2);
    if (!next) return onFilter(null);
    onFilter({
      column: 'date',
      operator: nextOperator,
      value: next,
      ...(nextOperator === 'between' && next2 ? { value2: next2 } : {}),
    });
  };

  return (
    <>
      <select
        className={styles.select}
        aria-label="Date filter operator"
        value={operator}
        onChange={(e) => emit(e.target.value as DateOperator, value, value2)}
      >
        {DATE_OPERATORS.map(([op, text]) => (
          <option key={op} value={op}>
            {text}
          </option>
        ))}
      </select>
      <div className={styles.pair}>
        <input
          className={styles.input}
          type="date"
          aria-label="Date filter value"
          value={value}
          onChange={(e) => emit(operator, e.target.value, value2)}
        />
        {operator === 'between' && (
          <input
            className={styles.input}
            type="date"
            aria-label="Date filter upper value"
            value={value2}
            onChange={(e) => emit(operator, value, e.target.value)}
          />
        )}
      </div>
    </>
  );
}
