import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchableListbox, type Placement } from './SearchableListbox';

interface Fruit {
  id: string;
  name: string;
}

const FRUIT: Fruit[] = [
  { id: 'apple', name: 'Apple' },
  { id: 'apricot', name: 'Apricot' },
  { id: 'banana', name: 'Banana' },
];

const search = (query: string) =>
  FRUIT.filter((f) => f.name.toLowerCase().includes(query.trim().toLowerCase()));

const rect = { left: 10, top: 10, bottom: 30, right: 50, width: 40, height: 20 } as DOMRect;

function setup(
  placement: Placement,
  extra: Partial<Parameters<typeof SearchableListbox<Fruit>>[0]> = {},
) {
  const onChoose = vi.fn();
  render(
    <SearchableListbox<Fruit>
      search={search}
      getKey={(f) => f.id}
      getColor={() => '#abcdef'}
      renderOption={(f) => f.name}
      isSelected={(f) => f.id === 'banana'}
      onChoose={onChoose}
      label="Fruit"
      listLabel="Fruits"
      placeholder="Search fruit…"
      emptyText="No matching fruit"
      placement={placement}
      {...extra}
    />,
  );
  return { onChoose, user: userEvent.setup() };
}

const box = () => screen.getByRole('combobox', { name: 'Fruit' });
const names = () => screen.queryAllByRole('option').map((o) => o.textContent);

const anchored = (onClose = vi.fn()): Placement => ({
  kind: 'anchored',
  rect,
  dialogLabel: 'Pick fruit',
  onClose,
});
const inline: Placement = { kind: 'inline', selectedLabel: '', autoFocus: true };

describe.each([
  ['anchored', () => anchored()],
  ['inline', () => inline],
] as const)('SearchableListbox (%s)', (_, placement) => {
  it('opens focused with every option, marking the selected one', () => {
    setup(placement());

    expect(box()).toHaveFocus();
    expect(screen.getByRole('listbox', { name: 'Fruits' })).toBeInTheDocument();
    expect(names()).toEqual(['Apple', 'Apricot', 'Banana✓']);
    expect(screen.getByRole('option', { name: /Banana/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('filters as you type and shows an empty state', async () => {
    const { user } = setup(placement());

    await user.type(box(), 'ap');
    expect(names()).toEqual(['Apple', 'Apricot']);

    await user.type(box(), 'x');
    expect(names()).toEqual([]);
    expect(screen.getByText('No matching fruit')).toBeInTheDocument();
  });

  it('tracks the active option with the arrow keys', async () => {
    const { user } = setup(placement());
    const activeName = () =>
      document.getElementById(box().getAttribute('aria-activedescendant')!)?.textContent;

    expect(activeName()).toBe('Apple');
    await user.keyboard('{ArrowDown}');
    expect(activeName()).toBe('Apricot');
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(activeName()).toBe('Banana✓');
    await user.keyboard('{ArrowUp}');
    expect(activeName()).toBe('Apricot');
  });

  it('chooses the highlighted option with Enter', async () => {
    const { user, onChoose } = setup(placement());

    await user.keyboard('{ArrowDown}{Enter}');

    expect(onChoose).toHaveBeenCalledWith(FRUIT[1]);
  });

  it('chooses an option by click', async () => {
    const { user, onChoose } = setup(placement());

    await user.click(screen.getByRole('option', { name: 'Banana' }));

    expect(onChoose).toHaveBeenCalledWith(FRUIT[2]);
  });

  it('offers the empty action when nothing matches, and Enter takes it', async () => {
    const onSelect = vi.fn();
    const { user, onChoose } = setup(placement(), {
      emptyAction: (query) => ({ label: `Create “${query}”`, onSelect }),
    });

    await user.type(box(), 'kiwi');
    expect(screen.getByRole('button', { name: /Create “kiwi”/ })).toBeInTheDocument();
    expect(screen.queryByText('No matching fruit')).not.toBeInTheDocument();

    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onChoose).not.toHaveBeenCalled();
  });
});

describe('SearchableListbox anchored placement', () => {
  it('is a labelled dialog that asks its owner to close on Escape and after a choice', async () => {
    const onClose = vi.fn();
    const { user } = setup(anchored(onClose));
    expect(screen.getByRole('dialog', { name: 'Pick fruit' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.keyboard('{Enter}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('asks its owner to close on an outside mousedown but not an inside one', async () => {
    const onClose = vi.fn();
    const { user } = setup(anchored(onClose));

    await user.click(box());
    expect(onClose).not.toHaveBeenCalled();

    await user.click(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('SearchableListbox inline placement', () => {
  it('closes itself on Escape and on blur, and reopens on typing', async () => {
    const { user } = setup({ kind: 'inline', selectedLabel: 'Banana', autoFocus: true });

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(box()).toHaveValue('Banana');
    expect(box()).toHaveAttribute('aria-expanded', 'false');

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.click(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('stays closed until focused when not asked to take focus', async () => {
    const { user } = setup({ kind: 'inline', selectedLabel: '' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    await user.click(box());
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('labels the field visibly', () => {
    setup(inline);
    expect(screen.getByText('Fruit', { selector: 'label' })).toBeInTheDocument();
  });
});
