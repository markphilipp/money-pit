import { describe, expect, it } from 'vitest';
import {
  activatesOnSpace,
  isShortcutBlocked,
  moveHighlight,
  resolveActionTargets,
  SHORTCUTS,
  shortcutFor,
} from './shortcuts';

const ids = ['a', 'b', 'c'];

function el(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  return host.firstElementChild as HTMLElement;
}

describe('moveHighlight', () => {
  it('starts at the first row going down and the last going up', () => {
    expect(moveHighlight(ids, null, 1)).toBe('a');
    expect(moveHighlight(ids, null, -1)).toBe('c');
  });

  it('steps and clamps at the ends without wrapping', () => {
    expect(moveHighlight(ids, 'a', 1)).toBe('b');
    expect(moveHighlight(ids, 'b', -1)).toBe('a');
    expect(moveHighlight(ids, 'c', 1)).toBe('c');
    expect(moveHighlight(ids, 'a', -1)).toBe('a');
  });

  it('treats an id that is no longer listed as nothing highlighted', () => {
    expect(moveHighlight(ids, 'gone', 1)).toBe('a');
    expect(moveHighlight(ids, 'gone', -1)).toBe('c');
  });

  it('has nowhere to go with no rows', () => {
    expect(moveHighlight([], null, 1)).toBeNull();
    expect(moveHighlight([], 'a', -1)).toBeNull();
  });
});

describe('resolveActionTargets', () => {
  it('uses the whole selection when the row is inside it', () => {
    expect(resolveActionTargets('a', new Set(['a', 'b']))).toEqual(['a', 'b']);
  });

  it('uses the row alone when it is outside the selection', () => {
    expect(resolveActionTargets('c', new Set(['a', 'b']))).toEqual(['c']);
    expect(resolveActionTargets('c', new Set())).toEqual(['c']);
  });

  it('falls back to the selection with no row, and to nothing without one', () => {
    expect(resolveActionTargets(null, new Set(['a', 'b']))).toEqual(['a', 'b']);
    expect(resolveActionTargets(null, new Set())).toEqual([]);
  });
});

describe('isShortcutBlocked', () => {
  it.each([
    ['text input', '<input type="text">'],
    ['input without a type', '<input>'],
    ['search input', '<input type="search">'],
    ['number input', '<input type="number">'],
    ['range input', '<input type="range">'],
    ['textarea', '<textarea></textarea>'],
    ['select', '<select></select>'],
    ['contenteditable', '<div contenteditable="true"></div>'],
    ['dialog', '<div role="dialog"><span tabindex="0"></span></div>'],
    ['alertdialog', '<div role="alertdialog"><button>x</button></div>'],
    ['menu', '<div role="menu"><div role="menuitem" tabindex="0"></div></div>'],
    ['listbox', '<div role="listbox"><button>x</button></div>'],
    ['separator', '<div role="separator" tabindex="0"></div>'],
    ['slider', '<div role="slider" tabindex="0"></div>'],
    ['combobox', '<div role="combobox" tabindex="0"></div>'],
  ])('blocks a %s', (_, html) => {
    const root = el(html);
    expect(isShortcutBlocked(root.firstElementChild ?? root)).toBe(true);
    expect(isShortcutBlocked(root)).toBe(true);
  });

  it.each([
    ['checkbox', '<input type="checkbox">'],
    ['radio', '<input type="radio">'],
    ['button input', '<input type="button">'],
    ['button', '<button>x</button>'],
    ['link', '<a href="/">x</a>'],
    ['plain div', '<div></div>'],
    ['non-editable island', '<div contenteditable="false"></div>'],
  ])('lets a %s through', (_, html) => {
    expect(isShortcutBlocked(el(html))).toBe(false);
  });

  it('lets through a null or non-element target', () => {
    expect(isShortcutBlocked(null)).toBe(false);
    expect(isShortcutBlocked(document)).toBe(false);
  });
});

describe('activatesOnSpace', () => {
  it('flags elements that Space natively clicks', () => {
    for (const html of [
      '<button>x</button>',
      '<a href="/">x</a>',
      '<input type="checkbox">',
      '<input type="radio">',
    ]) {
      expect(activatesOnSpace(el(html))).toBe(true);
    }
  });

  it('leaves everything else to the shortcut', () => {
    expect(activatesOnSpace(el('<div></div>'))).toBe(false);
    expect(activatesOnSpace(document.body)).toBe(false);
    expect(activatesOnSpace(null)).toBe(false);
  });
});

describe('SHORTCUTS', () => {
  it('has unique ids and hotkeys', () => {
    expect(new Set(SHORTCUTS.map((s) => s.id)).size).toBe(SHORTCUTS.length);
    expect(new Set(SHORTCUTS.map((s) => s.hotkey)).size).toBe(SHORTCUTS.length);
  });

  it('looks entries up by id', () => {
    expect(shortcutFor('help').display).toEqual(['?']);
  });
});
