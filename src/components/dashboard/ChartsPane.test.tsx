import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ChartsPane } from './ChartsPane';

describe('ChartsPane', () => {
  beforeEach(() => window.localStorage.clear());

  it('resizes with arrow keys within bounds', () => {
    render(
      <ChartsPane>
        <p>charts</p>
      </ChartsPane>,
    );
    const sep = screen.getByRole('separator');
    const start = Number(sep.getAttribute('aria-valuenow'));
    fireEvent.keyDown(sep, { key: 'ArrowDown' });
    expect(Number(sep.getAttribute('aria-valuenow'))).toBeGreaterThan(start);
    fireEvent.keyDown(sep, { key: 'Home' });
    expect(sep.getAttribute('aria-valuenow')).toBe(sep.getAttribute('aria-valuemin'));
    fireEvent.keyDown(sep, { key: 'End' });
    expect(sep.getAttribute('aria-valuenow')).toBe(sep.getAttribute('aria-valuemax'));
  });

  it('minimizes and restores the previous height', () => {
    render(
      <ChartsPane>
        <p>charts</p>
      </ChartsPane>,
    );
    const sep = screen.getByRole('separator');
    fireEvent.keyDown(sep, { key: 'Home' });
    const before = sep.getAttribute('aria-valuenow');
    fireEvent.click(screen.getByRole('button', { name: 'Hide charts' }));
    expect(sep.getAttribute('aria-valuenow')).toBe('0');
    fireEvent.click(screen.getByRole('button', { name: 'Show charts' }));
    expect(sep.getAttribute('aria-valuenow')).toBe(before);
  });

  it('persists across mounts', () => {
    const { unmount } = render(
      <ChartsPane>
        <p>c</p>
      </ChartsPane>,
    );
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'Home' });
    unmount();
    render(
      <ChartsPane>
        <p>c</p>
      </ChartsPane>,
    );
    const sep = screen.getByRole('separator');
    expect(sep.getAttribute('aria-valuenow')).toBe(sep.getAttribute('aria-valuemin'));
  });
});
