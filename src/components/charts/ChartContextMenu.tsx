'use client';

import { useState } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import type { Checklist } from '@/lib/checklist';
import styles from './ChartContextMenu.module.css';

export interface ChartMenuTarget {
  id: string;
  name: string;
  excluded: boolean;
}

interface ChartContextMenuProps {
  children: React.ReactNode;
  /** Maps the right-click to the slice or bar under it, or null for empty space. */
  hitTest: (e: MouseEvent) => ChartMenuTarget | null;
  checklist: Checklist;
  onToggleExclusion: (id: string) => void;
  onShowAll: () => void;
  showAllLabel: string;
}

export function ChartContextMenu({
  children,
  hitTest,
  checklist,
  onToggleExclusion,
  onShowAll,
  showAllLabel,
}: ChartContextMenuProps) {
  const [target, setTarget] = useState<ChartMenuTarget | null>(null);

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger
        asChild
        onContextMenu={(e) => {
          const hit = hitTest(e.nativeEvent);
          setTarget(hit);
          // Radix skips opening when the event is already default-prevented.
          if (!hit) e.preventDefault();
        }}
      >
        {children}
      </ContextMenu.Trigger>
      {target && (
        <ContextMenu.Portal>
          <ContextMenu.Content className={styles.menu} onCloseAutoFocus={(e) => e.preventDefault()}>
            <ContextMenu.Item className={styles.item} onSelect={() => onToggleExclusion(target.id)}>
              {target.excluded ? 'Include' : 'Exclude'} &ldquo;{target.name}&rdquo;
            </ContextMenu.Item>
            {checklist.values.length > 0 && (
              <>
                <ContextMenu.Separator className={styles.separator} />
                <ContextMenu.Item className={styles.item} onSelect={onShowAll}>
                  {showAllLabel}
                </ContextMenu.Item>
              </>
            )}
          </ContextMenu.Content>
        </ContextMenu.Portal>
      )}
    </ContextMenu.Root>
  );
}
