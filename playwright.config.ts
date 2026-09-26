import { defineConfig, devices } from '@playwright/test';

// Set by the Vercel deployment gate to point the suite at a live deployment
// instead of a locally run `next start`.
const externalBaseURL = process.env.E2E_BASE_URL;

// Per-deployment URLs sit behind Vercel SSO; this header is the automation
// bypass. The alias is exempt, but it still points at the previous build until
// promotion, so the gate has to hit the deployment URL itself.
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

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
    ...(bypassSecret && {
      extraHTTPHeaders: { 'x-vercel-protection-bypass': bypassSecret },
    }),
  },
  // Signed-in specs mint throwaway users straight into the database, so they need DATABASE_URL and
  // the server's BETTER_AUTH_SECRET. Locally that's .env.local (Neon dev); CI uses a per-run branch.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, grepInvert: /@signed-in/ },
    { name: 'signed-in', use: { ...devices['Desktop Chrome'] }, grep: /@signed-in/ },
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        // the real production server, not a static file host — routes are rendered, not pre-written
        command: 'bunx next start -p 3210',
        url: 'http://127.0.0.1:3210',
        reuseExistingServer: !process.env.CI,
        // Better Auth rejects sign-out from any origin but its own; .env.local points at dev's port.
        env: { BETTER_AUTH_URL: 'http://127.0.0.1:3210' },
        timeout: 60_000,
      },
});
