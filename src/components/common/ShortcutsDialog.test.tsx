import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SHORTCUTS } from '@/lib/shortcuts';
import { UserMenu } from '@/components/layout/UserMenu';
import { resetStore } from '@/test/fixtures';

vi.mock('@/auth/client', () => ({ authClient: { signOut: vi.fn() } }));
vi.mock('@/app/actions/account', () => ({ deleteAccount: vi.fn() }));

beforeEach(async () => {
  await resetStore();
});

describe('ShortcutsDialog', () => {
  it('opens on ? and lists every registered shortcut', async () => {
    const user = userEvent.setup();
    render(<UserMenu />);

    await user.keyboard('?');

    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    for (const shortcut of SHORTCUTS) {
      expect(within(dialog).getByText(shortcut.label)).toBeInTheDocument();
    }
    expect(within(dialog).getByText('Anywhere')).toBeInTheDocument();
    expect(within(dialog).getByText('Transactions')).toBeInTheDocument();
    expect(within(dialog).getByText(/off while you’re typing in a field/)).toBeInTheDocument();
  });

  it('opens on Shift+? as a US keyboard sends it, but not with Cmd held', async () => {
    const user = userEvent.setup();
    render(<UserMenu />);

    await user.keyboard('{Meta>}{Shift>}?{/Shift}{/Meta}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.keyboard('{Shift>}?{/Shift}');
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
  });

  it('closes on Esc and on the Close button', async () => {
    const user = userEvent.setup();
    render(<UserMenu />);

    await user.keyboard('?');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.keyboard('?');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens from the account menu', async () => {
    const user = userEvent.setup();
    render(<UserMenu />);

    await user.click(screen.getByLabelText('Account menu'));
    await user.click(screen.getByRole('menuitem', { name: 'Keyboard shortcuts' }));

    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
  });

  it('stays closed when ? is typed into a field', async () => {
    const user = userEvent.setup();
    render(
      <>
        <UserMenu />
        <input aria-label="Search description" />
      </>,
    );

    await user.click(screen.getByLabelText('Search description'));
    await user.keyboard('what?');

    expect(screen.getByLabelText('Search description')).toHaveValue('what?');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
