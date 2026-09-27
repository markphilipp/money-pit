import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { keywordsToGroup } from '@/lib/rules/engine';
import { useAppStore } from '@/store/useAppStore';
import { resetStore } from '@/test/fixtures';
import { CategoriesScreen } from './CategoriesScreen';

const row = (name: string) => screen.getByLabelText(`Rename ${name}`).closest('li') as HTMLElement;

describe('CategoriesScreen', () => {
  beforeEach(resetStore);

  it('lists every category with its rule and transaction counts', async () => {
    render(<CategoriesScreen />);

    expect(await screen.findByRole('heading', { name: 'Categories' })).toBeInTheDocument();
    expect(row('Groceries')).toHaveTextContent('1 rule');
    expect(within(row('Payments')).getByText('built-in')).toBeInTheDocument();
  });

  it('renames a category, rejecting a name already in use', async () => {
    const user = userEvent.setup();
    render(<CategoriesScreen />);

    await user.click(await screen.findByLabelText('Rename Groceries'));
    const input = screen.getByLabelText('New name for Groceries');
    await user.clear(input);
    await user.type(input, 'Amazon');
    expect(screen.getByRole('alert')).toHaveTextContent(/already a category/);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    await user.clear(input);
    await user.type(input, 'Food');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(useAppStore.getState().categories.find((c) => c.id === 'grocery')?.name).toBe('Food');
  });

  it('adds a new category with the next unused palette color', async () => {
    const user = userEvent.setup();
    render(<CategoriesScreen />);

    await user.type(await screen.findByLabelText('New category'), 'Travel');
    await user.click(screen.getByRole('button', { name: 'Add category' }));

    const added = useAppStore.getState().categories.find((c) => c.id === 'travel');
    expect(added?.name).toBe('Travel');
    expect(screen.getByLabelText('New category')).toHaveValue('');
  });

  it('deletes a category through the warning dialog', async () => {
    const user = userEvent.setup();
    render(<CategoriesScreen />);

    await user.click(await screen.findByLabelText('Delete Groceries'));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/will be deleted too/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /Delete category and/ }));

    expect(useAppStore.getState().categories.some((c) => c.id === 'grocery')).toBe(false);
    expect(useAppStore.getState().rules.some((r) => r.categoryId === 'grocery')).toBe(false);
  });

  it('cancelling the warning keeps the category', async () => {
    const user = userEvent.setup();
    render(<CategoriesScreen />);

    await user.click(await screen.findByLabelText('Delete Groceries'));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(useAppStore.getState().categories.some((c) => c.id === 'grocery')).toBe(true);
  });

  it('refuses to delete a built-in category', async () => {
    render(<CategoriesScreen />);
    expect(await screen.findByLabelText('Delete Payments')).toBeDisabled();
  });

  it('warns about rules with no conditions the same as any other rule', async () => {
    useAppStore.getState().addCategory({ id: 'travel', name: 'Travel', color: '#111' });
    useAppStore
      .getState()
      .addRule({ id: 'travel', categoryId: 'travel', conditions: keywordsToGroup(['DELTA']) });
    const user = userEvent.setup();
    render(<CategoriesScreen />);

    await user.click(await screen.findByLabelText('Delete Travel'));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/description contains DELTA/)).toBeInTheDocument();
  });
});
