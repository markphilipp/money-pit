export type ShortcutScope = 'global' | 'transactions';

export type ShortcutId =
  | 'help'
  | 'search'
  | 'firstRow'
  | 'nextRow'
  | 'prevRow'
  | 'toggleRow'
  | 'selectAll'
  | 'changeCategory'
  | 'createRule'
  | 'clear';

export interface Shortcut {
  id: ShortcutId;
  /** react-hotkeys-hook syntax; comma separates alternatives. */
  hotkey: string;
  /** Bind to the produced character instead of the physical key, for punctuation. */
  useKey?: boolean;
  /** Key labels for the help dialog, one `<kbd>` each. */
  display: readonly string[];
  label: string;
  scope: ShortcutScope;
}

export const SCOPE_TITLES: Record<ShortcutScope, string> = {
  global: 'Anywhere',
  transactions: 'Transactions',
};

// The help dialog renders from this table, so it can't drift from the bindings.
export const SHORTCUTS: readonly Shortcut[] = [
  {
    id: 'help',
    // `?` needs Shift on most layouts and none on a few, so accept both.
    hotkey: 'shift+?,?',
    useKey: true,
    display: ['?'],
    label: 'Show keyboard shortcuts',
    scope: 'global',
  },
  {
    id: 'search',
    hotkey: '/,shift+/',
    useKey: true,
    display: ['/'],
    label: 'Search descriptions',
    scope: 'transactions',
  },
  {
    id: 'firstRow',
    hotkey: 'l',
    display: ['l'],
    label: 'Highlight first row',
    scope: 'transactions',
  },
  {
    id: 'nextRow',
    hotkey: 'down,j',
    display: ['↓', 'j'],
    label: 'Highlight next row',
    scope: 'transactions',
  },
  {
    id: 'prevRow',
    hotkey: 'up,k',
    display: ['↑', 'k'],
    label: 'Highlight previous row',
    scope: 'transactions',
  },
  {
    id: 'toggleRow',
    hotkey: 'space',
    display: ['Space'],
    label: 'Select or deselect highlighted row',
    scope: 'transactions',
  },
  {
    id: 'selectAll',
    hotkey: 'a',
    display: ['a'],
    label: 'Select all rows in view',
    scope: 'transactions',
  },
  {
    id: 'changeCategory',
    hotkey: 'c',
    display: ['c'],
    label: 'Change category',
    scope: 'transactions',
  },
  {
    id: 'createRule',
    hotkey: 'r',
    display: ['r'],
    label: 'Create rule',
    scope: 'transactions',
  },
  {
    id: 'clear',
    hotkey: 'esc',
    display: ['Esc'],
    label: 'Clear selection, then highlight',
    scope: 'transactions',
  },
];

export function shortcutFor(id: ShortcutId): Shortcut {
  const shortcut = SHORTCUTS.find((s) => s.id === id);
  if (!shortcut) throw new Error(`Unknown shortcut: ${id}`);
  return shortcut;
}

const NON_TEXT_INPUTS = new Set([
  'checkbox',
  'radio',
  'button',
  'submit',
  'reset',
  'image',
  'file',
]);
const KEY_TRAPPING_ROLES =
  '[role=dialog],[role=alertdialog],[role=menu],[role=listbox],[role=separator],[role=slider],[role=combobox]';

/**
 * True when the key press belongs to whatever has focus. The library's own form-tag check is too
 * coarse: row checkboxes and buttons keep focus after a click, so blocking every `input` would
 * kill shortcuts right after selecting a row. The charts-pane resize handle (`separator`) already
 * owns Arrow Up/Down, and Radix dialogs and menus plus `CategoryPicker` (`dialog`) trap keys.
 */
export function isShortcutBlocked(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest('[contenteditable]:not([contenteditable="false"])')) return true;
  if (target.closest(KEY_TRAPPING_ROLES)) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(target.type);
}

const SPACE_ACTIVATED_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset']);

/** Space natively clicks these, so a Space shortcut would fire on top of the native action. */
export function activatesOnSpace(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement) return true;
  return target instanceof HTMLInputElement && SPACE_ACTIVATED_INPUTS.has(target.type);
}

/**
 * Next highlighted id when stepping through `ids`. Nothing (or an id no longer listed) starts at
 * the first row going down and the last going up; the ends clamp rather than wrap.
 */
export function moveHighlight(
  ids: readonly string[],
  current: string | null,
  dir: 1 | -1,
): string | null {
  if (ids.length === 0) return null;
  const index = current === null ? -1 : ids.indexOf(current);
  if (index === -1) return dir === 1 ? ids[0] : ids[ids.length - 1];
  return ids[Math.min(Math.max(index + dir, 0), ids.length - 1)];
}

/**
 * Rows a row action applies to. Acting inside a selection applies to the whole selection,
 * otherwise to that row alone; with no row in play it is the selection, possibly empty.
 */
export function resolveActionTargets(
  rowId: string | null,
  selectedIds: ReadonlySet<string>,
): string[] {
  if (rowId === null || selectedIds.has(rowId)) return [...selectedIds];
  return [rowId];
}
