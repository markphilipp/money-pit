'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Category } from '@/lib/types';
import { categoryUsage, findCategoryByName, type CategoryUsage } from '@/lib/categories';
import { uniqueId } from '@/lib/rules/naming';
import { nextPaletteColor } from '@/lib/palette';
import { ColorPickerPopover } from '@/components/common/ColorPickerPopover';
import { useTransactions } from '@/store/hooks';
import { useAppStore, useHydrated } from '@/store/useAppStore';
import screen from '@/components/rules/RuleScreen.module.css';
import { DeleteCategoryDialog } from './DeleteCategoryDialog';
import styles from './CategoriesScreen.module.css';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** A name is free unless another category already answers to it, ignoring case. */
function nameError(categories: Category[], name: string, self?: string): string | null {
  const taken = findCategoryByName(categories, name);
  return taken && taken.id !== self ? `There is already a category called “${taken.name}”.` : null;
}

export function CategoriesScreen() {
  const hydrated = useHydrated();

  return (
    <main className={`wrap ${screen.screen}`}>
      <div className={screen.topBar}>
        <Link href="/" className={screen.back}>
          ← Back
        </Link>
        <h1 className={screen.title}>Categories</h1>
      </div>

      {hydrated ? (
        <CategoryList />
      ) : (
        <section className={`card ${screen.section}`}>
          <p className={screen.empty} aria-busy="true">
            Loading categories…
          </p>
        </section>
      )}

      <div className={screen.actions}>
        <Link href="/rules" className="btn-clear">
          Rules
        </Link>
        <span className={screen.spacer} />
        <Link href="/" className="btn-clear">
          Done
        </Link>
      </div>
    </main>
  );
}

function CategoryList() {
  const categories = useAppStore((s) => s.categories);
  const rules = useAppStore((s) => s.rules);
  const transactions = useTransactions();
  const [deleting, setDeleting] = useState<Category | null>(null);

  const usage = useMemo(
    () => categoryUsage({ categories, rules }, transactions),
    [categories, rules, transactions],
  );

  return (
    <>
      <section className={`card ${screen.section}`}>
        <p className="sub">
          Rules file transactions into categories. Payments and Other are built in, so they can be
          renamed and recolored but not deleted.
        </p>
        <ul className={styles.list}>
          {categories.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              usage={usage.get(category.id)!}
              onDelete={() => setDeleting(category)}
            />
          ))}
        </ul>
        <AddCategory />
      </section>
      {deleting && <DeleteCategoryDialog category={deleting} onClose={() => setDeleting(null)} />}
    </>
  );
}

function CategoryRow({
  category,
  usage,
  onDelete,
}: {
  category: Category;
  usage: CategoryUsage;
  onDelete: () => void;
}) {
  const categories = useAppStore((s) => s.categories);
  const setCategory = useAppStore((s) => s.setCategory);
  const [draft, setDraft] = useState<string | null>(null);

  const error = draft === null ? null : nameError(categories, draft, category.id);
  const canSave = draft !== null && !!draft.trim() && !error;

  function save() {
    if (!canSave) return;
    setCategory(category.id, { name: draft.trim() });
    setDraft(null);
  }

  return (
    <li className={styles.row}>
      <ColorPickerPopover
        value={category.color}
        onChange={(color) => setCategory(category.id, { color })}
        ariaLabel={`${category.name} color`}
      />
      {draft === null ? (
        <span className={styles.name}>
          {category.name}
          {category.builtin && <span className={styles.badge}>built-in</span>}
        </span>
      ) : (
        <form
          className={styles.rename}
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <input
            type="text"
            autoFocus
            aria-label={`New name for ${category.name}`}
            aria-invalid={!!error}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setDraft(null);
            }}
          />
          {error && (
            <span role="alert" className={styles.error}>
              {error}
            </span>
          )}
        </form>
      )}
      <span className={styles.usage}>
        {plural(usage.rules, 'rule')} · {plural(usage.transactions, 'transaction')}
      </span>
      <span className={styles.rowActions}>
        {draft === null ? (
          <>
            <button
              type="button"
              className={styles.iconBtn}
              aria-label={`Rename ${category.name}`}
              onClick={() => setDraft(category.name)}
            >
              Rename
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              disabled={category.builtin}
              aria-label={`Delete ${category.name}`}
              title={category.builtin ? 'Built-in categories cannot be deleted' : undefined}
              onClick={onDelete}
            >
              Delete
            </button>
          </>
        ) : (
          <>
            <button type="button" className={styles.iconBtn} onClick={() => setDraft(null)}>
              Cancel
            </button>
            <button type="button" className={styles.iconBtn} disabled={!canSave} onClick={save}>
              Save
            </button>
          </>
        )}
      </span>
    </li>
  );
}

function AddCategory() {
  const categories = useAppStore((s) => s.categories);
  const addCategory = useAppStore((s) => s.addCategory);
  const [name, setName] = useState('');
  const [color, setColor] = useState(() => nextPaletteColor(categories.map((c) => c.color)));

  const error = nameError(categories, name);
  const canAdd = !!name.trim() && !error;

  function add() {
    if (!canAdd) return;
    const trimmed = name.trim();
    addCategory({
      id: uniqueId(
        trimmed,
        categories.map((c) => c.id),
      ),
      name: trimmed,
      color,
    });
    setName('');
    setColor(nextPaletteColor([...categories.map((c) => c.color), color]));
  }

  return (
    <form
      className={styles.add}
      onSubmit={(e) => {
        e.preventDefault();
        add();
      }}
    >
      <ColorPickerPopover value={color} onChange={setColor} ariaLabel="New category color" />
      <div className="field">
        <label htmlFor="new-category-name">New category</label>
        <input
          id="new-category-name"
          type="text"
          value={name}
          placeholder="e.g. Travel"
          aria-invalid={!!error}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <button type="submit" className={screen.save} disabled={!canAdd}>
        Add category
      </button>
      {error && (
        <span role="alert" className={styles.error}>
          {error}
        </span>
      )}
    </form>
  );
}
