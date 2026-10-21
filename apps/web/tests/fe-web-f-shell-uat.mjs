#!/usr/bin/env node
/**
 * Slice F — shell chrome UAT (desktop 1280 + mobile 390) vs mockup baseline.
 * Usage: node apps/web/tests/fe-web-f-shell-uat.mjs [baseUrl]
 */
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { existsSync, readdirSync } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT =
  process.env.WEB_UAT_OUT_DIR ||
  join(ROOT, 'docs/reviews/assets');
const BASE = (
  process.argv[2] ||
  process.env.WEB_BASE_URL ||
  'http://127.0.0.1:3000'
).replace(/\/$/, '');

function findCachedHeadlessShell() {
  if (process.env.WEB_UAT_EXECUTABLE) return process.env.WEB_UAT_EXECUTABLE;
  const cache = join(homedir(), 'Library/Caches/ms-playwright');
  if (!existsSync(cache)) return null;
  const dirs = readdirSync(cache)
    .filter((d) => d.startsWith('chromium_headless_shell-'))
    .sort()
    .reverse();
  for (const dir of dirs) {
    for (const arch of [
      'chrome-headless-shell-mac-arm64',
      'chrome-headless-shell-mac-x64',
    ]) {
      const candidate = join(cache, dir, arch, 'chrome-headless-shell');
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

async function launchBrowser() {
  const shell = findCachedHeadlessShell();
  const opts = shell
    ? { executablePath: shell, headless: true, args: ['--disable-dev-shm-usage'] }
    : { headless: true, args: ['--disable-dev-shm-usage'] };
  return chromium.launch(opts);
}

mkdirSync(OUT, { recursive: true });
const browser = await launchBrowser();
try {
  for (const [name, width, height] of [
    ['desktop', 1280, 800],
    ['mobile', 390, 844],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
    });
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('site-nav').waitFor({ state: 'visible' });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: join(OUT, `fe-web-F-home-${name}.png`),
      fullPage: true,
    });
    if (name === 'mobile') {
      await page.getByTestId('nav-menu-toggle').click();
      await page.getByTestId('nav-mobile-menu').waitFor({ state: 'visible' });
      await page.screenshot({
        path: join(OUT, `fe-web-F-home-${name}-menu.png`),
        fullPage: true,
      });
    }
    await page.close();
  }
  console.log(`fe-web-f-shell-uat: ok ${BASE} → ${OUT}`);
} finally {
  await browser.close();
}
