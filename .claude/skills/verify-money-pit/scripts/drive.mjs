#!/usr/bin/env node
// Usage: node .claude/skills/verify-money-pit/scripts/drive.mjs <scenario.mjs> [port]
// The scenario default-exports async ({ page, shot, fixture, baseURL, log }) => void.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [scenarioPath, port = '3310'] = process.argv.slice(2);
if (!scenarioPath) {
  console.error('usage: drive.mjs <scenario.mjs> [port]');
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

let failed = false;
try {
  const { default: scenario } = await import(pathToFileURL(path.resolve(scenarioPath)).href);
  await scenario({ page, shot, fixture, baseURL, log });
  log('RESULT: PASS');
} catch (error) {
  failed = true;
  log(`RESULT: FAIL ${error.stack ?? error}`);
  await shot('failure').catch(() => {});
} finally {
  writeFileSync(path.join(outDir, 'log.txt'), lines.join('\n') + '\n');
  await browser.close();
  console.log(`evidence: ${path.relative(root, outDir)}`);
}
process.exit(failed ? 1 : 0);
