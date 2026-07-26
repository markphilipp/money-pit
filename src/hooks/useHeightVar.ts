'use client';

import { useLayoutEffect, useState } from 'react';

/**
 * Publishes an element's live height as a CSS var so later elements can stack their sticky offsets
 * on it. Returns a callback ref, so it also picks up nodes that mount after the first render.
 */
export function useHeightVar(name: string) {
  const [el, setEl] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!el) return;

    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      root.style.setProperty(name, `${el.getBoundingClientRect().height}px`);
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      root.style.removeProperty(name);
    };
  }, [el, name]);

  return setEl;
}
