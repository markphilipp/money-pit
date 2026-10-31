import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserMenu } from '@/components/layout/UserMenu';
import { useAppStore } from '@/store/useAppStore';
import { resetStore, seedStore } from '@/test/fixtures';
import { routerMock } from '@/test/router';
import { TransactionTable } from './TransactionTable';

vi.mock('@/auth/client', () => ({ authClient: { signOut: vi.fn() } }));
vi.mock('@/app/actions/account', () => ({ deleteAccount: vi.fn() }));

const bodyRows = () => [...document.querySelectorAll<HTMLElement>('tbody tr')];
const highlighted = () => bodyRows().filter((r) => r.getAttribute('aria-current') === 'true');
const selectedIds = () => useAppStore.getState().selectedIds;

beforeEach(async () => {
  await resetStore();
  await seedStore();
});

function setup() {
  const user = userEvent.setup();
  render(
    <>
      <UserMenu />
      <TransactionTable />
    </>,
  );
  return user;
}

describe('shortcuts while an overlay owns the keyboard', () => {
  it('ignores table keys while the shortcuts dialog is open', async () => {
    const user = setup();
    await user.keyboard('?');
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();

    await user.keyboard('lja');
    await user.keyboard('{ArrowDown} ');
    await user.keyboard('r');

    expect(highlighted()).toHaveLength(0);
    expect(selectedIds().size).toBe(0);
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it('Esc closes the shortcuts dialog without clearing the selection or highlight', async () => {
    const user = setup();
    await user.keyboard('l ');
    await user.keyboard('?');
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(selectedIds().size).toBe(1);
    expect(highlighted()).toHaveLength(1);
  });

  it('ignores table keys while the confirm dialog is open', async () => {
    const user = setup();
    await user.click(screen.getByLabelText('Account menu'));
    await user.click(screen.getByRole('menuitem', { name: 'Start over' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    await user.keyboard('la');
    await user.keyboard('{ArrowDown}');

    expect(highlighted()).toHaveLength(0);
    expect(selectedIds().size).toBe(0);
  });

  it('ignores table keys while the account menu is open', async () => {
    const user = setup();
    await user.click(screen.getByLabelText('Account menu'));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.keyboard('la');

    expect(highlighted()).toHaveLength(0);
    expect(selectedIds().size).toBe(0);
  });

  it('ignores table keys inside the category picker', async () => {
    const user = setup();
    await user.keyboard('jc');
    const picker = screen.getByRole('dialog', { name: 'Choose category' });

    await user.keyboard('lar');
    await user.keyboard('{ArrowDown}');

    expect(picker).toBeInTheDocument();
    expect(highlighted()).toEqual([bodyRows()[0]]);
    expect(selectedIds().size).toBe(0);
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it('leaves Arrow keys to the charts-pane resize handle', async () => {
    const user = setup();
    render(<div role="separator" tabIndex={0} aria-label="Resize charts" />);
    screen.getByRole('separator').focus();

    await user.keyboard('{ArrowDown}{ArrowUp}');

    expect(highlighted()).toHaveLength(0);
  });
});

describe('held keys', () => {
  const hold = (key: string, code: string) =>
    fireEvent.keyDown(document.body, { key, code, repeat: true });

  it('acts once for a held action key', async () => {
    const user = setup();
    await user.keyboard('lr');
    expect(routerMock.push).toHaveBeenCalledTimes(1);
    hold('r', 'KeyR');
    hold('r', 'KeyR');
    expect(routerMock.push).toHaveBeenCalledTimes(1);
  });

  it('does not keep toggling the row while Space is held', async () => {
    const user = setup();
    await user.keyboard('l ');
    expect(selectedIds().size).toBe(1);
    hold(' ', 'Space');
    hold(' ', 'Space');
    expect(selectedIds().size).toBe(1);
  });

  it('keeps stepping while an arrow is held', async () => {
    const user = setup();
    await user.keyboard('l');
    hold('ArrowDown', 'ArrowDown');
    hold('ArrowDown', 'ArrowDown');
    expect(highlighted()).toEqual([bodyRows()[2]]);
  });
});

describe('edge states', () => {
  it('does nothing and throws nothing on an empty table', async () => {
    const user = setup();
    await user.type(screen.getByLabelText('Search description'), 'zzzz-no-match');
    await user.click(document.body);

    await user.keyboard('l{ArrowDown}{ArrowUp}ja c r{Escape}');

    expect(screen.getByText('No transactions match these filters.')).toBeInTheDocument();
    expect(selectedIds().size).toBe(0);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it('a is idempotent and adds to a selection instead of replacing it', async () => {
    const user = setup();
    await user.keyboard('aa');
    expect(selectedIds().size).toBe(6);
  });

  it('a leaves rows selected earlier but now filtered out in place', async () => {
    const user = setup();
    await user.click(within(bodyRows()[0]).getByRole('checkbox'));
    const hiddenId = [...selectedIds()][0];
    await user.type(screen.getByLabelText('Search description'), 'lowes');
    await user.click(document.body);
    await user.keyboard('a');
    expect(selectedIds().has(hiddenId)).toBe(true);
    expect(selectedIds().size).toBe(2);
  });

  it('keeps the highlight on the same row when the sort order changes', async () => {
    const user = setup();
    await user.keyboard('jj');
    const text = bodyRows()[1].textContent;
    await user.click(screen.getByRole('button', { name: 'Amount column menu' }));
    await user.click(screen.getByRole('menuitem', { name: /ascending|low/i }));
    expect(bodyRows()[1].textContent).not.toBe(text);
    expect(highlighted()).toHaveLength(1);
    expect(highlighted()[0].textContent).toBe(text);
  });

  it('does not fire on Shift+letter', async () => {
    const user = setup();
    await user.keyboard('{Shift>}A{/Shift}{Shift>}L{/Shift}{Shift>}R{/Shift}');
    expect(selectedIds().size).toBe(0);
    expect(highlighted()).toHaveLength(0);
    expect(routerMock.push).not.toHaveBeenCalled();
  });
});
