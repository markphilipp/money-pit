import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SaveStatus } from '@/lib/saveStatus';
import { SaveStatusToast } from './SaveStatusToast';

const show = (status: SaveStatus) => render(<SaveStatusToast status={status} />);

describe('SaveStatusToast', () => {
  it('renders an empty polite live region when idle', () => {
    show({ kind: 'idle' });
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toBeEmptyDOMElement();
  });

  it.each([
    [{ kind: 'saving' }, 'Saving…'],
    [{ kind: 'saved' }, 'Saved'],
    [{ kind: 'retrying', attempt: 2, of: 3 }, 'Couldn’t save. Retrying (2 of 3)…'],
  ] as const)('announces %o', (status, text) => {
    show(status);
    expect(screen.getByRole('status')).toHaveTextContent(text);
  });

  it('offers reload when the account is unreachable', () => {
    show({ kind: 'failed', reverted: false });
    expect(screen.getByRole('button', { name: 'Reload' })).toBeVisible();
  });

  it('lets a reverted failure be dismissed', async () => {
    show({ kind: 'failed', reverted: true });
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});
