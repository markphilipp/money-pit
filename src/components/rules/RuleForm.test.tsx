import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OTHER_ID } from '@/lib/types';
import { useAppStore } from '@/store/useAppStore';
import { resetStore } from '@/test/fixtures';
import { routerMock } from '@/test/router';
import { RuleForm } from './RuleForm';

describe('RuleForm', () => {
  beforeEach(resetStore);

  it('edits an existing rule and returns to the list', async () => {
    const user = userEvent.setup();
    render(<RuleForm ruleId="grocery" />);

    const name = await screen.findByLabelText('Category name');
    expect(name).toHaveValue('Groceries');

    await user.clear(name);
    await user.type(name, 'Food');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(useAppStore.getState().rules.find((r) => r.id === 'grocery')?.name).toBe('Food');
    expect(routerMock.push).toHaveBeenCalledWith('/rules');
  });

  it('creates a rule when no id is given', async () => {
    const user = userEvent.setup();
    render(<RuleForm />);

    await user.type(await screen.findByLabelText('Category name'), 'Travel');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(useAppStore.getState().rules.some((r) => r.id === 'travel')).toBe(true);
  });

  it('deletes the rule it is editing', async () => {
    const user = userEvent.setup();
    render(<RuleForm ruleId="grocery" />);

    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(useAppStore.getState().rules.some((r) => r.id === 'grocery')).toBe(false);
    expect(routerMock.push).toHaveBeenCalledWith('/rules');
  });

  it('reduces the fallback to name and color', async () => {
    render(<RuleForm ruleId={OTHER_ID} />);

    expect(await screen.findByText(/Fallback/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('explains an id that matches no rule rather than rendering a blank form', async () => {
    render(<RuleForm ruleId="nope" />);

    expect(await screen.findByRole('heading', { name: 'Rule not found' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Category name')).not.toBeInTheDocument();
  });
});
