import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '@/store/useAppStore';
import { resetStore, seedStore } from '@/test/fixtures';
import { routerMock } from '@/test/router';
import { TransactionTable } from './TransactionTable';

const bodyRows = () => within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');
const highlighted = () => bodyRows().filter((r) => r.getAttribute('aria-current') === 'true');
const selectedIds = () => useAppStore.getState().selectedIds;
const search = () => screen.getByLabelText('Search description');

beforeEach(async () => {
  await resetStore();
  await seedStore();
});

function setup() {
  const user = userEvent.setup();
  render(<TransactionTable />);
  return user;
}

describe('table keyboard shortcuts', () => {
  it('focuses the search field on / without typing it, selecting what is there', async () => {
    const user = setup();
    await user.type(search(), 'lowes');
    await user.click(document.body);

    await user.keyboard('/');

    expect(search()).toHaveFocus();
    expect(search()).toHaveValue('lowes');
    expect((search() as HTMLInputElement).selectionStart).toBe(0);
    expect((search() as HTMLInputElement).selectionEnd).toBe(5);
  });

  it('does not act on letters typed into the search field', async () => {
    const user = setup();
    await user.click(search());
    await user.keyboard('acrl ?/');

    expect(search()).toHaveValue('acrl ?/');
    expect(selectedIds().size).toBe(0);
    expect(highlighted()).toHaveLength(0);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it('l highlights the first row', async () => {
    const user = setup();
    await user.keyboard('l');
    expect(highlighted()).toEqual([bodyRows()[0]]);
  });

  it('moves the highlight with the arrows and j/k, clamping at the ends', async () => {
    const user = setup();
    await user.keyboard('{ArrowDown}');
    expect(highlighted()).toEqual([bodyRows()[0]]);

    await user.keyboard('{ArrowUp}');
    expect(highlighted()).toEqual([bodyRows()[0]]);

    await user.keyboard('{ArrowDown}j');
    expect(highlighted()).toEqual([bodyRows()[2]]);

    await user.keyboard('k');
    expect(highlighted()).toEqual([bodyRows()[1]]);

    await user.keyboard('{ArrowDown>10/}');
    expect(highlighted()).toEqual([bodyRows().at(-1)]);
  });

  it('starts at the last row on ArrowUp with nothing highlighted', async () => {
    const user = setup();
    await user.keyboard('{ArrowUp}');
    expect(highlighted()).toEqual([bodyRows().at(-1)]);
  });

  it('drops a highlight that filtering removed', async () => {
    const user = setup();
    await user.keyboard('l');
    await user.type(search(), 'lowes');
    expect(highlighted()).toHaveLength(0);

    await user.click(document.body);
    await user.keyboard('{ArrowDown}');
    expect(highlighted()).toEqual([bodyRows()[0]]);
    expect(bodyRows()[0]).toHaveTextContent('LOWES');
  });

  it('toggles selection of the highlighted row with Space', async () => {
    const user = setup();
    await user.keyboard('l ');
    expect(selectedIds().size).toBe(1);
    await user.keyboard(' ');
    expect(selectedIds().size).toBe(0);
  });

  it('leaves Space alone when no row is highlighted', async () => {
    const user = setup();
    const event = new KeyboardEvent('keydown', { code: 'Space', key: ' ', cancelable: true });
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    await user.keyboard(' ');
    expect(selectedIds().size).toBe(0);
  });

  it('does not double-toggle when Space lands on a focused button', async () => {
    const user = setup();
    await user.keyboard('l');
    const pill = within(bodyRows()[1]).getByTitle('Change category');
    pill.focus();

    await user.keyboard(' ');

    expect(selectedIds().size).toBe(0);
    expect(screen.getByRole('dialog', { name: 'Choose category' })).toBeInTheDocument();
  });

  it('does not double-toggle when Space lands on a row checkbox', async () => {
    const user = setup();
    await user.keyboard('l');
    within(bodyRows()[0]).getByRole('checkbox').focus();

    await user.keyboard(' ');

    expect(selectedIds().size).toBe(1);
  });

  it('keeps shortcuts live after clicking a row checkbox', async () => {
    const user = setup();
    await user.click(within(bodyRows()[0]).getByRole('checkbox'));
    await user.keyboard('a');
    expect(selectedIds().size).toBe(6);
  });

  it('a selects only the rows the filter leaves', async () => {
    const user = setup();
    await user.type(search(), 'lowes');
    await user.click(document.body);

    await user.keyboard('a');

    expect(selectedIds().size).toBe(1);
  });

  it('ignores modified keys so Cmd+A and friends keep working', async () => {
    const user = setup();
    await user.keyboard('l');
    await user.keyboard('{Meta>}a{/Meta}');
    await user.keyboard('{Control>}a{/Control}');
    await user.keyboard('{Meta>}c{/Meta}');
    await user.keyboard('{Alt>}r{/Alt}');
    await user.keyboard('{Meta>}{ArrowDown}{/Meta}');

    expect(selectedIds().size).toBe(0);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(highlighted()).toEqual([bodyRows()[0]]);
  });

  it('c opens the picker for the highlighted row and reassigns just that row', async () => {
    const user = setup();
    await user.keyboard('jj');
    await user.keyboard('c');
    expect(screen.getByRole('dialog', { name: 'Choose category' })).toBeInTheDocument();

    await user.keyboard('pets{Enter}');

    const overrides = useAppStore.getState().overrides;
    expect(Object.values(overrides)).toEqual(['pets']);
    expect(within(bodyRows()[1]).getByTitle('Change category')).toHaveTextContent('Pets');
  });

  it('c on a highlighted row inside a multi-selection reassigns the whole selection', async () => {
    const user = setup();
    await user.click(within(bodyRows()[0]).getByRole('checkbox'));
    await user.click(within(bodyRows()[1]).getByRole('checkbox'));
    await user.keyboard('l');
    await user.keyboard('c');

    await user.keyboard('pets{Enter}');

    expect(Object.values(useAppStore.getState().overrides)).toEqual(['pets', 'pets']);
    expect(selectedIds().size).toBe(0);
  });

  it('c with only a selection targets the selection', async () => {
    const user = setup();
    await user.click(within(bodyRows()[0]).getByRole('checkbox'));
    await user.click(within(bodyRows()[1]).getByRole('checkbox'));
    await user.click(document.body);

    await user.keyboard('c');
    await user.keyboard('pets{Enter}');

    expect(Object.values(useAppStore.getState().overrides)).toEqual(['pets', 'pets']);
  });

  it('c with a highlighted row outside the selection targets that row alone', async () => {
    const user = setup();
    await user.click(within(bodyRows()[0]).getByRole('checkbox'));
    await user.click(document.body);
    await user.keyboard('jjc');
    await user.keyboard('pets{Enter}');

    expect(Object.keys(useAppStore.getState().overrides)).toHaveLength(1);
    expect(selectedIds().size).toBe(1);
  });

  it('c and r do nothing with no row and no selection', async () => {
    const user = setup();
    await user.keyboard('cr');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it('r starts a rule from the highlighted row', async () => {
    const user = setup();
    await user.keyboard('jr');

    const { ruleSources } = useAppStore.getState();
    expect(ruleSources).toHaveLength(1);
    expect(routerMock.push).toHaveBeenCalledWith('/rules/new');
  });

  it('r starts a rule from the selection when it contains the highlighted row', async () => {
    const user = setup();
    await user.click(within(bodyRows()[0]).getByRole('checkbox'));
    await user.click(within(bodyRows()[1]).getByRole('checkbox'));
    await user.keyboard('lr');

    const { ruleSources, selectedIds: selected } = useAppStore.getState();
    expect(ruleSources).toEqual([...selected]);
    expect(ruleSources).toHaveLength(2);
    expect(routerMock.push).toHaveBeenCalledWith('/rules/new');
  });

  it('Esc clears the selection first, then the highlight', async () => {
    const user = setup();
    await user.keyboard('l ');
    expect(selectedIds().size).toBe(1);

    await user.keyboard('{Escape}');
    expect(selectedIds().size).toBe(0);
    expect(highlighted()).toHaveLength(1);

    await user.keyboard('{Escape}');
    expect(highlighted()).toHaveLength(0);
  });

  it('Esc closes the picker without touching the selection or highlight', async () => {
    const user = setup();
    await user.keyboard('l ');
    await user.keyboard('c');
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(selectedIds().size).toBe(1);
    expect(highlighted()).toHaveLength(1);
  });

  it('scrolls the highlighted row into view', async () => {
    const user = setup();
    const calls: Element[] = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element) {
      calls.push(this);
    };
    try {
      await user.keyboard('j');
      expect(calls).toEqual([bodyRows()[0]]);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });
});
