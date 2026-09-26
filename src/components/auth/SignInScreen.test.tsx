import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { authClient } from '@/auth/client';
import { SignInScreen } from './SignInScreen';

vi.mock('@/auth/client', () => ({ authClient: { signIn: { social: vi.fn() } } }));
const social = vi.mocked(authClient.signIn.social);

describe('SignInScreen', () => {
  it('says what signing in stores, and that it is optional', () => {
    render(<SignInScreen />);
    expect(screen.getByText(/saves your statements, rules and category fixes/)).toBeVisible();
    expect(screen.getByText(/never leave this browser tab/)).toBeVisible();
  });

  it('starts the provider flow back to the dashboard', async () => {
    social.mockResolvedValueOnce({ data: {}, error: null } as never);
    render(<SignInScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Continue with GitHub' }));
    expect(social).toHaveBeenCalledWith({ provider: 'github', callbackURL: '/' });
  });

  it('explains a provider that is not configured', async () => {
    social.mockResolvedValueOnce({ data: null, error: { status: 404 } } as never);
    render(<SignInScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Google sign-in isn’t set up yet.');
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
  });
});
