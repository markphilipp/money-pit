import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsShell } from './SettingsShell';

const pathnameMock = vi.hoisted(() => ({ value: '/settings/datasets' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathnameMock.value }));

const renderAt = (pathname: string) => {
  pathnameMock.value = pathname;
  render(
    <SettingsShell>
      <p>content</p>
    </SettingsShell>,
  );
};

const nav = () => screen.getByRole('navigation', { name: 'Settings' });
const current = () =>
  Array.from(nav().querySelectorAll('[aria-current="page"]')).map((el) => el.textContent);

beforeEach(() => {
  pathnameMock.value = '/settings/datasets';
});

describe('SettingsShell', () => {
  it('links every section', () => {
    renderAt('/settings/datasets');

    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Uploaded files' })).toHaveAttribute(
      'href',
      '/settings/datasets',
    );
    expect(screen.getByRole('link', { name: 'Categories' })).toHaveAttribute(
      'href',
      '/settings/categories',
    );
    expect(screen.getByRole('link', { name: 'Rules' })).toHaveAttribute('href', '/settings/rules');
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('marks only the section matching the pathname', () => {
    renderAt('/settings/categories');
    expect(current()).toEqual(['Categories']);
  });

  it.each(['/settings/rules/new', '/settings/rules/abc'])('keeps Rules active on %s', (path) => {
    renderAt(path);
    expect(current()).toEqual(['Rules']);
  });

  it('does not treat a sibling with a shared prefix as active', () => {
    renderAt('/settings/rulesets');
    expect(current()).toEqual([]);
  });
});
