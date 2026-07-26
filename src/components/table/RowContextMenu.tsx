'use client';

import { useRef } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import styles from './RowContextMenu.module.css';

interface RowContextMenuProps {
  children: React.ReactNode;
  selected: boolean;
  onCreateRule: () => void;
  onChangeCategory: (anchor: { x: number; y: number }) => void;
  onToggleSelect: () => void;
}

export function RowContextMenu({
  children,
  selected,
  onCreateRule,
  onChangeCategory,
  onToggleSelect,
}: RowContextMenuProps) {
  // The picker is positioned from the pointer, so capture where the menu was summoned.
  const anchor = useRef({ x: 0, y: 0 });

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger
        asChild
        onContextMenu={(e) => {
          anchor.current = { x: e.clientX, y: e.clientY };
        }}
      >
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className={styles.menu}>
          <ContextMenu.Item className={styles.item} onSelect={onCreateRule}>
            Create rule from transaction
          </ContextMenu.Item>
          <ContextMenu.Item
            className={styles.item}
            onSelect={() => onChangeCategory(anchor.current)}
          >
            Change category…
          </ContextMenu.Item>
          <ContextMenu.Separator className={styles.separator} />
          <ContextMenu.Item className={styles.item} onSelect={onToggleSelect}>
            {selected ? 'Deselect row' : 'Select row'}
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
