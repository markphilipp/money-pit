'use client';

import { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { RulesManagerModal } from '@/components/rules/RulesManagerModal';
import styles from './UserMenu.module.css';

export function UserMenu() {
  const [rulesOpen, setRulesOpen] = useState(false);

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className={styles.avatar} aria-label="Account menu">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <circle cx="12" cy="8.5" r="3.6" />
              <path d="M4.6 20c.9-4 3.8-6 7.4-6s6.5 2 7.4 6" />
            </svg>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className={styles.menu} align="end" sideOffset={8}>
            <DropdownMenu.Item className={styles.item} onSelect={() => setRulesOpen(true)}>
              Category rules…
            </DropdownMenu.Item>
            <DropdownMenu.Separator className={styles.separator} />
            <DropdownMenu.Item className={styles.item} disabled>
              Sign in <span className={styles.soon}>coming soon</span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <RulesManagerModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </>
  );
}
