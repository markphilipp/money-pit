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

  it('collapses to the header and restores the previous height', () => {
    render(
      <ChartsPane>
        <p>charts</p>
      </ChartsPane>,
    );
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'Home' });
    const before = screen.getByRole('separator').getAttribute('aria-valuenow');
    const toggle = screen.getByRole('button', { name: 'Charts' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('separator').getAttribute('aria-valuenow')).toBe(before);
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
