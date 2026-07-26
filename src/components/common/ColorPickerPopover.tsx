'use client';

import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import * as Tabs from '@radix-ui/react-tabs';
import { PALETTE } from '@/lib/palette';
import styles from './ColorPickerPopover.module.css';

interface ColorPickerPopoverProps {
  value: string;
  onChange: (hex: string) => void;
  ariaLabel: string;
}

export function ColorPickerPopover({ value, onChange, ariaLabel }: ColorPickerPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={styles.trigger}
          style={{ background: value }}
          aria-label={ariaLabel}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.content} align="start" sideOffset={6}>
          <Tabs.Root defaultValue="palette">
            <Tabs.List className={styles.tabs} aria-label="Color source">
              <Tabs.Trigger className={styles.tab} value="palette">
                Palette
              </Tabs.Trigger>
              <Tabs.Trigger className={styles.tab} value="custom">
                Custom
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="palette">
              <div className={styles.grid}>
                {PALETTE.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    className={`${styles.swatch} ${
                      hex.toLowerCase() === value.toLowerCase() ? styles.on : ''
                    }`}
                    style={{ background: hex }}
                    aria-label={hex}
                    aria-pressed={hex.toLowerCase() === value.toLowerCase()}
                    onClick={() => {
                      onChange(hex);
                      setOpen(false);
                    }}
                  />
                ))}
              </div>
            </Tabs.Content>

            <Tabs.Content value="custom" className={styles.custom}>
              <label className={styles.customLabel}>
                Custom hex
                <input
                  type="color"
                  value={value}
                  aria-label="Custom color"
                  onChange={(e) => onChange(e.target.value)}
                />
              </label>
            </Tabs.Content>
          </Tabs.Root>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
