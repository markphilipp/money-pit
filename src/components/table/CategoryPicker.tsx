'use client';

import { useCallback } from 'react';
import { findCategoryByName } from '@/lib/categories';
import type { Category } from '@/lib/types';
import { PAYMENTS_ID } from '@/lib/types';
import { SearchableListbox } from '@/components/common/SearchableListbox';

export interface PickerAnchor {
  rect: DOMRect;
  currentCategoryId: string | null;
  onChoose: (categoryId: string) => void;
  onCreate: (name: string) => void;
}

interface Props extends PickerAnchor {
  categories: Category[];
  onClose: () => void;
}

export function CategoryPicker({
  rect,
  currentCategoryId,
  onChoose,
  onCreate,
  categories,
  onClose,
}: Props) {
  const search = useCallback(
    (query: string) => {
      const q = query.trim().toLowerCase();
      return categories
        .filter((c) => c.id !== PAYMENTS_ID && (!q || c.name.toLowerCase().includes(q)))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    [categories],
  );

  return (
    <SearchableListbox
      search={search}
      getKey={(c) => c.id}
      getColor={(c) => c.color}
      renderOption={(c) => c.name}
      isSelected={(c) => c.id === currentCategoryId}
      onChoose={(c) => onChoose(c.id)}
      emptyAction={(query) => {
        const name = query.trim();
        return name && !findCategoryByName(categories, name)
          ? { label: `Create category “${name}”`, onSelect: () => onCreate(name) }
          : null;
      }}
      label="Search categories"
      listLabel="Categories"
      placeholder="Search categories…"
      emptyText="No matching category"
      placement={{ kind: 'anchored', rect, dialogLabel: 'Choose category', onClose }}
    />
  );
}
