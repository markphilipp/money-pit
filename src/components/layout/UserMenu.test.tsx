import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignedInContext, useAppStore } from '@/store/useAppStore';
import { csvFile, resetStore, SECOND_CSV, seedStore } from '@/test/fixtures';
import { UserMenu } from './UserMenu';

beforeEach(async () => {
  await resetStore();
});

describe('UserMenu', () => {
  it('links to the rules route from the menu', async () => {
    const user = userEvent.setup();
    render(<UserMenu />);

    await user.click(screen.getByLabelText('Account menu'));
    expect(screen.getByRole('menuitem', { name: 'Sign in…' })).toHaveAttribute('href', '/sign-in');

    expect(screen.getByRole('menuitem', { name: 'Category rules…' })).toHaveAttribute(
      'href',
      '/rules',
    );
  });

  it('hides the statement actions until there is data', async () => {
    const user = userEvent.setup();
    render(<UserMenu />);

    await user.click(screen.getByLabelText('Account menu'));

    expect(screen.queryByRole('menuitem', { name: 'Add statement' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Start over' })).not.toBeInTheDocument();
  });

  it('adds another statement from the menu', async () => {
    await seedStore();
    const user = userEvent.setup();
    render(<UserMenu />);

    await user.upload(
      screen.getByLabelText('Add statement CSV files'),
      csvFile(SECOND_CSV, 'july.csv'),
    );

    await waitFor(() => expect(useAppStore.getState().rawRows).toHaveLength(8));
  });

  it('requires two clicks to start over', async () => {
    await seedStore();
    const user = userEvent.setup();
    render(<UserMenu />);

    await user.click(screen.getByLabelText('Account menu'));
    await user.click(screen.getByRole('menuitem', { name: 'Start over' }));
    expect(useAppStore.getState().rawRows).toHaveLength(7);

    await user.click(screen.getByRole('menuitem', { name: 'Confirm reset' }));
    expect(useAppStore.getState().rawRows).toHaveLength(0);
  });

  it('can back out of starting over', async () => {
    await seedStore();
    const user = userEvent.setup();
    render(<UserMenu />);

    await user.click(screen.getByLabelText('Account menu'));
    await user.click(screen.getByRole('menuitem', { name: 'Start over' }));
    await user.click(screen.getByRole('menuitem', { name: 'Cancel' }));

    expect(useAppStore.getState().rawRows).toHaveLength(7);

    await user.click(screen.getByLabelText('Account menu'));
    expect(screen.getByRole('menuitem', { name: 'Start over' })).toBeInTheDocument();
  });

  it('surfaces upload errors until dismissed', async () => {
    await seedStore();
    const user = userEvent.setup();
    render(<UserMenu />);

    await user.upload(
      screen.getByLabelText('Add statement CSV files'),
      csvFile('nope', 'broken.csv'),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('broken.csv');

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('offers sign-out and names the account deletion when signed in', async () => {
    await seedStore();
    const user = userEvent.setup();
    render(
      <SignedInContext value={true}>
        <UserMenu />
      </SignedInContext>,
    );

    await user.click(screen.getByLabelText('Account menu'));
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Sign in/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Delete account data' }));
    await user.click(screen.getByRole('menuitem', { name: 'Confirm: delete everything' }));
    expect(useAppStore.getState().rawRows).toHaveLength(0);
  });
});
