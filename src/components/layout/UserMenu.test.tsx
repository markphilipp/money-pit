import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetStore } from '@/test/fixtures';
import { UserMenu } from './UserMenu';

beforeEach(() => {
  resetStore();
});

describe('UserMenu', () => {
  it('opens the rules manager from the menu', async () => {
    const user = userEvent.setup();
    render(<UserMenu />);

    await user.click(screen.getByLabelText('Account menu'));
    expect(screen.getByRole('menuitem', { name: /Sign in/ })).toHaveAttribute('data-disabled', '');

    await user.click(screen.getByRole('menuitem', { name: 'Category rules…' }));

    expect(await screen.findByText('Category rules')).toBeInTheDocument();
    expect(screen.getByLabelText('Edit Groceries')).toBeInTheDocument();
  });
});
