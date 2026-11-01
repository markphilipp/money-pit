import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '@/store/useAppStore';
import { resetStore } from '@/test/fixtures';
import { PreviewBanner } from './PreviewBanner';

beforeEach(resetStore);

describe('PreviewBanner', () => {
  it('names the branch and loads the sample statements on demand', async () => {
    render(<PreviewBanner branch="feat/x" />);

    expect(screen.getByText('feat/x')).toBeInTheDocument();
    expect(useAppStore.getState().datasets).toHaveLength(0);

    await userEvent.click(await screen.findByRole('button', { name: 'Load sample data' }));

    await waitFor(() => expect(useAppStore.getState().datasets).toHaveLength(3));
  });

  it('is a no-op the second time', async () => {
    render(<PreviewBanner />);
    const button = await screen.findByRole('button', { name: 'Load sample data' });

    await userEvent.click(button);
    await waitFor(() => expect(useAppStore.getState().datasets).toHaveLength(3));
    await userEvent.click(await screen.findByRole('button', { name: 'Load sample data' }));

    expect(useAppStore.getState().datasets).toHaveLength(3);
  });
});
