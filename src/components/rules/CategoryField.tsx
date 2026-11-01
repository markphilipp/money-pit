'use client';

import { useCallback } from 'react';
import type { CategoryChoice } from '@/lib/categories';
import type { Category } from '@/lib/types';
import { PAYMENTS_ID } from '@/lib/types';
import { nextPaletteColor } from '@/lib/palette';
import { ColorPickerPopover } from '@/components/common/ColorPickerPopover';
import { SearchableListbox } from '@/components/common/SearchableListbox';
import screen from './RuleScreen.module.css';

const NEW = '__new__';
const NEW_OPTION = { id: NEW, name: 'New category…', color: undefined };
type Option = { id: string; name: string; color: string | undefined };

/** Picks the category a rule files into, or names a new one to create when the rule is saved. */
export function CategoryField({
  categories,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  categories: Category[];
  value: CategoryChoice;
  onChange: (value: CategoryChoice) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const current = value.kind === 'existing' ? categories.find((c) => c.id === value.id) : undefined;

  const search = useCallback(
    (query: string): Option[] => {
      const q = query.trim().toLowerCase();
      const matches = categories
        .filter((c) => c.id !== PAYMENTS_ID && (!q || c.name.toLowerCase().includes(q)))
        .sort((a, b) => a.name.localeCompare(b.name));
      return [...matches, NEW_OPTION];
    },
    [categories],
  );

  return (
    <div className={screen.identity}>
      {value.kind === 'new' ? (
        <ColorPickerPopover
          value={value.color}
          onChange={(color) => onChange({ ...value, color })}
          ariaLabel="Category color"
        />
      ) : (
        <span className={screen.swatch} style={{ background: current?.color }} aria-hidden="true" />
      )}
      <SearchableListbox<Option>
        search={search}
        getKey={(o) => o.id}
        getColor={(o) => o.color}
        renderOption={(o) => o.name}
        isSelected={(o) => o.id === (value.kind === 'new' ? NEW : value.id)}
        onChoose={(o) =>
          onChange(
            o.id === NEW
              ? { kind: 'new', name: '', color: nextPaletteColor(categories.map((c) => c.color)) }
              : { kind: 'existing', id: o.id },
          )
        }
        label="Category"
        listLabel="Categories"
        placeholder="Search categories…"
        emptyText="No matching category"
        placement={{
          kind: 'inline',
          selectedLabel: value.kind === 'new' ? NEW_OPTION.name : (current?.name ?? ''),
        }}
        disabled={disabled}
      />
      {value.kind === 'new' && (
        <div className="field">
          <label htmlFor="rule-category-name">Category name</label>
          <input
            id="rule-category-name"
            type="text"
            autoFocus
            value={value.name}
            placeholder={placeholder}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
