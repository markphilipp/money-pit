#!/usr/bin/env node
// Usage: node .claude/skills/verify-money-pit/scripts/drive.mjs <scenario.mjs> [port] [--signed-in]
// The scenario default-exports async ({ page, context, browser, shot, fixture, baseURL, log, account }) => void.
// --signed-in mints a throwaway dev-DB user before the scenario and deletes it afterwards; the
// scenario calls account.signIn() when it wants the cookies (claim flows upload signed out first).
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const signedIn = args.includes('--signed-in');
const [scenarioPath, port = '3310'] = args.filter((a) => a !== '--signed-in');
if (!scenarioPath) {
  console.error('usage: drive.mjs <scenario.mjs> [port] [--signed-in]');
  process.exit(2);
}

const root = path.resolve(import.meta.dirname, '../../../..');
const name = path.basename(scenarioPath, '.mjs');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(root, '.verify/evidence', `${stamp}-${name}`);
mkdirSync(outDir, { recursive: true });

const baseURL = `http://127.0.0.1:${port}`;
const lines = [];
const log = (msg) => {
  lines.push(`${new Date().toISOString()} ${msg}`);
  console.log(msg);
};
let step = 0;
const browser = await chromium.launch();
const context = await browser.newContext({ baseURL, viewport: { width: 1400, height: 1000 } });
const page = await context.newPage();
page.on('console', (m) => m.type() === 'error' && log(`console.error: ${m.text()}`));
page.on('pageerror', (e) => log(`pageerror: ${e.message}`));
const shot = async (label) => {
  // Chart.js animates for its default 1000ms and the app doesn't disable it; shoot settled charts.
  if (await page.locator('canvas').count()) await page.waitForTimeout(1100);
  const file = path.join(outDir, `${String(++step).padStart(2, '0')}-${label}.png`);
  await page.screenshot({ path: file, fullPage: true });
  log(`screenshot ${path.relative(root, file)}`);
};
const fixture = (file) => path.join(root, 'e2e/fixtures', file);
const session = (...cmd) =>
  execFileSync('bun', [path.join(import.meta.dirname, 'session.ts'), ...cmd], {
    cwd: root,
    encoding: 'utf8',
  });

let account;
let signIns = 0;
if (signedIn) {
  const { userId, cookies } = JSON.parse(session('mint'));
  log(`minted test user ${userId}`);
  account = {
    userId,
    // Signing out deletes the session row, so every call after the first mints a new session.
    signIn: async (target = context) => {
      const fresh = signIns++ ? JSON.parse(session('cookies', userId)).cookies : cookies;
      await target.addCookies(fresh);
    },
    // What the dev DB holds for this user: exists, rows, overrides, rules, preference, sessions.
    state: () => JSON.parse(session('state', userId)),
  };
}

let failed = false;
try {
  const { default: scenario } = await import(pathToFileURL(path.resolve(scenarioPath)).href);
  await scenario({ page, context, browser, shot, fixture, baseURL, log, account });
  log('RESULT: PASS');
} catch (error) {
  failed = true;
  log(`RESULT: FAIL ${error.stack ?? error}`);
  await shot('failure').catch(() => {});
} finally {
  if (account) {
    session('delete', account.userId);
    log(`deleted test user ${account.userId}`);
  }
  writeFileSync(path.join(outDir, 'log.txt'), lines.join('\n') + '\n');
  await browser.close();
  console.log(`evidence: ${path.relative(root, outDir)}`);
}
process.exit(failed ? 1 : 0);
