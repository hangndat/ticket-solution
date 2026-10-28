#!/usr/bin/env node
/**
 * Slice G — gate chrome screenshots vs mockup layout (desktop 1280 + mobile 390).
 * Usage: node apps/web/tests/fe-refactor-gate-chrome-uat.mjs [baseUrl]
 */
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = join(ROOT, 'docs/reviews/assets/fe-refactor-gate-2026-10-21');
const BASE = (process.argv[2] || process.env.WEB_BASE_URL || 'http://127.0.0.1:3000').replace(
  /\/$/,
  '',
);

function findCachedHeadlessShell() {
  if (process.env.WEB_UAT_EXECUTABLE) return process.env.WEB_UAT_EXECUTABLE;
  const cache = join(homedir(), 'Library/Caches/ms-playwright');
  if (!existsSync(cache)) return null;
  const dirs = readdirSync(cache)
    .filter((d) => d.startsWith('chromium_headless_shell-'))
    .sort()
    .reverse();
  for (const dir of dirs) {
    for (const arch of ['chrome-headless-shell-mac-arm64', 'chrome-headless-shell-mac-x64']) {
      const candidate = join(cache, dir, arch, 'chrome-headless-shell');
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

async function launchBrowser() {
  const shell = findCachedHeadlessShell();
  const attempts = [];
  if (shell) attempts.push({ executablePath: shell, headless: true });
  attempts.push({ headless: true });
  let last;
  for (const opts of attempts) {
    try {
      return await chromium.launch(opts);
    } catch (err) {
      last = err;
    }
  }
  throw last ?? new Error('chromium launch failed');
}

mkdirSync(OUT, { recursive: true });
const browser = await launchBrowser();

try {
  for (const [name, width, height] of [
    ['gate-desktop', 1280, 800],
    ['gate-mobile', 390, 844],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const res = await page.goto(`${BASE}/gate`, { waitUntil: 'domcontentloaded' });
    if (!res || res.status() >= 500) {
      throw new Error(`GET /gate failed: ${res?.status()}`);
    }
    await page.locator('main#main').first().waitFor({ state: 'visible', timeout: 20_000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    const tabs = page.getByTestId('gate-tabs');
    const hasChrome = await tabs.isVisible().catch(() => false);
    await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
    if (hasChrome) {
      await page.getByTestId('gate-tab-manual').click();
      await page.screenshot({ path: join(OUT, `${name}-manual.png`), fullPage: true });
      await page.getByTestId('gate-tab-history').click();
      await page.screenshot({ path: join(OUT, `${name}-history.png`), fullPage: true });
    } else {
      console.warn(
        `fe-refactor-gate-chrome-uat: gate tabs hidden at ${page.url()} (auth/API) — landing only`,
      );
    }
    await page.close();
  }
  console.log(`fe-refactor-gate-chrome-uat: ok → ${OUT}`);
} finally {
  await browser.close();
}
