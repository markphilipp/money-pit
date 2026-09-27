'use client';

import type { CategoryChoice } from '@/lib/categories';
import type { Category } from '@/lib/types';
import { nextPaletteColor } from '@/lib/palette';
import { ColorPickerPopover } from '@/components/common/ColorPickerPopover';
import screen from './RuleScreen.module.css';

const NEW = '__new__';

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
      <div className="field">
        <label htmlFor="rule-category">Category</label>
        <select
          id="rule-category"
          value={value.kind === 'new' ? NEW : value.id}
          disabled={disabled}
          onChange={(e) =>
            onChange(
              e.target.value === NEW
                ? { kind: 'new', name: '', color: nextPaletteColor(categories.map((c) => c.color)) }
                : { kind: 'existing', id: e.target.value },
            )
          }
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value={NEW}>New category…</option>
        </select>
      </div>
      {value.kind === 'new' && (
        <div className="field">
          <label htmlFor="rule-category-name">Category name</label>
          <input
            id="rule-category-name"
            type="text"
            value={value.name}
            placeholder={placeholder}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
