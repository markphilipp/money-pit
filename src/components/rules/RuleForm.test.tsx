import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '@/store/useAppStore';
import { resetStore } from '@/test/fixtures';
import { routerMock } from '@/test/router';
import { RuleForm } from './RuleForm';

describe('RuleForm', () => {
  beforeEach(resetStore);

  it('reassigns an existing rule to a different category and returns to the list', async () => {
    const user = userEvent.setup();
    render(<RuleForm ruleId="grocery" />);

    const select = await screen.findByLabelText('Category');
    expect(select).toHaveValue('grocery');

    await user.selectOptions(select, 'pets');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(useAppStore.getState().rules.find((r) => r.id === 'grocery')?.categoryId).toBe('pets');
    expect(routerMock.push).toHaveBeenCalledWith('/rules');
  });

  it('creates a rule and its category when no id is given', async () => {
    const user = userEvent.setup();
    render(<RuleForm />);

    await user.type(await screen.findByLabelText('Category name'), 'Travel');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const { categories, rules } = useAppStore.getState();
    expect(categories.some((c) => c.id === 'travel' && c.name === 'Travel')).toBe(true);
    expect(rules.some((r) => r.categoryId === 'travel')).toBe(true);
  });

  it('deletes the rule it is editing', async () => {
    const user = userEvent.setup();
    render(<RuleForm ruleId="grocery" />);

    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(useAppStore.getState().rules.some((r) => r.id === 'grocery')).toBe(false);
    expect(routerMock.push).toHaveBeenCalledWith('/rules');
  });

  it('fixes conditions and hides delete for a built-in rule', async () => {
    render(<RuleForm ruleId="payments" />);

    expect(await screen.findByText(/conditions are fixed/)).toBeInTheDocument();
    expect(screen.getByLabelText('Category')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('explains an id that matches no rule rather than rendering a blank form', async () => {
    render(<RuleForm ruleId="nope" />);

    expect(await screen.findByRole('heading', { name: 'Rule not found' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Category')).not.toBeInTheDocument();
  });
});
