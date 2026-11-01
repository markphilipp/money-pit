import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsHeading } from './SettingsHeading';

const trail = () => screen.getByRole('navigation', { name: 'Breadcrumb' });
const crumbs = () => Array.from(trail().querySelectorAll('li')).map((li) => li.textContent);

describe('SettingsHeading', () => {
  it('ends the trail at the section on its own page', () => {
    render(<SettingsHeading section="/settings/rules" title="Rules" />);

    expect(crumbs()).toEqual(['Dashboard', 'Settings', 'Rules']);
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
    expect(screen.queryByRole('link', { name: 'Rules' })).not.toBeInTheDocument();
    expect(trail().querySelector('[aria-current="page"]')).toHaveTextContent('Rules');
    expect(screen.getByRole('heading', { level: 2, name: 'Rules' })).toBeInTheDocument();
  });

  it('links the section back up from a sub-page', async () => {
    const onNavigate = vi.fn();
    render(
      <SettingsHeading
        section="/settings/rules"
        current="New rule"
        title="New rule"
        onNavigate={onNavigate}
      />,
    );

    expect(crumbs()).toEqual(['Dashboard', 'Settings', 'Rules', 'New rule']);
    const up = screen.getByRole('link', { name: 'Rules' });
    expect(up).toHaveAttribute('href', '/settings/rules');
    await userEvent.click(up);
    expect(onNavigate).toHaveBeenCalledOnce();
    expect(trail().querySelector('[aria-current="page"]')).toHaveTextContent('New rule');
  });
});
