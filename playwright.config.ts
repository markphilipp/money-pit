import { defineConfig, devices } from '@playwright/test';

// Set by the Vercel deployment gate to point the suite at a live deployment
// instead of a locally served `out/`.
const externalBaseURL = process.env.E2E_BASE_URL;

export default defineConfig({
  // testDir alone scopes discovery; don't add a '**/.worktrees/**' testIgnore —
  // Playwright matches it against absolute paths, so a checkout that itself sits
  // under .worktrees/ would silently find zero tests.
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: externalBaseURL ?? 'http://127.0.0.1:3210',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: externalBaseURL
    ? undefined
    : {
        command: 'bunx serve out -l 3210',
        url: 'http://127.0.0.1:3210',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
