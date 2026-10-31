'use client';

import { useHotkeys } from 'react-hotkeys-hook';
import { isShortcutBlocked, shortcutFor, type ShortcutId } from '@/lib/shortcuts';

interface Options {
  enabled?: boolean;
  /** Evaluated per key press, before the handler runs. */
  preventDefault?: boolean | (() => boolean);
  /** Extra per-press exclusion on top of `isShortcutBlocked`. */
  ignoreWhen?: (e: KeyboardEvent) => boolean;
  /** Keep firing while the key is held. Off by default so a held `r` or Space acts once. */
  repeat?: boolean;
}

/**
 * Binds a registry shortcut. Modifier combos never match (the library compares ctrl/meta/alt/shift
 * exactly), so Cmd+A and Cmd+C keep working. Form-tag blocking is switched off in the library and
 * redone in `isShortcutBlocked`, which is finer-grained.
 */
export function useShortcut(
  id: ShortcutId,
  handler: (e: KeyboardEvent) => void,
  { enabled = true, preventDefault = false, ignoreWhen, repeat = false }: Options = {},
) {
  const { hotkey, useKey } = shortcutFor(id);
  useHotkeys(hotkey, handler, {
    useKey,
    enabled,
    preventDefault,
    enableOnFormTags: true,
    ignoreEventWhen: (e) =>
      (e.repeat && !repeat) || isShortcutBlocked(e.target) || (ignoreWhen?.(e) ?? false),
  });
}
