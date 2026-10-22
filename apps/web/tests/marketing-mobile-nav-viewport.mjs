#!/usr/bin/env node
/**
 * #811 — mobile nav responsive behavior (computed visibility, not CSS file regex).
 *
 *   pnpm --filter @ticket/web start &
 *   node apps/web/tests/marketing-mobile-nav-viewport.mjs [baseUrl]
 */
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const BASE = (
  process.argv[2] ||
  process.env.FE_UAT_WEB_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');

function die(msg, code = 1) {
  console.error(`marketing-mobile-nav-viewport: ${msg}`);
  process.exit(code);
}

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
    ? {
        executablePath: shell,
        headless: true,
        args: ['--disable-dev-shm-usage'],
      }
    : { headless: true, args: ['--disable-dev-shm-usage'] };
  return chromium.launch(opts);
}

async function visibility(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { found: false, visible: false };
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const visible =
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      rect.width > 0 &&
      rect.height > 0;
    return { found: true, visible };
  }, selector);
}

async function main() {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await page.setExtraHTTPHeaders({ 'x-forwarded-host': 'vemoki.com' });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/marketing`, {
      waitUntil: 'domcontentloaded',
      timeout: 120_000,
    });
    await page.waitForSelector('[data-testid="mkt-nav-menu-toggle"]', {
      timeout: 60_000,
    });
    const mobileToggle = await visibility(page, '[data-testid="mkt-nav-menu-toggle"]');
    const mobileLinks = await visibility(page, '.mkt-header--sales .mkt-nav-links');
    if (!mobileToggle.found || !mobileToggle.visible) {
      die('mobile @390: menu toggle should be visible');
    }
    if (mobileLinks.visible) {
      die('mobile @390: desktop nav links should be hidden');
    }

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE}/marketing`, {
      waitUntil: 'domcontentloaded',
      timeout: 120_000,
    });
    await page.waitForSelector('[data-testid="mkt-header"]', { timeout: 60_000 });
    const desktopToggle = await visibility(page, '[data-testid="mkt-nav-menu-toggle"]');
    const desktopLinks = await visibility(page, '.mkt-header--sales .mkt-nav-links');
    if (desktopToggle.visible) {
      die('desktop @1280: menu toggle should be hidden');
    }
    if (!desktopLinks.found || !desktopLinks.visible) {
      die('desktop @1280: desktop nav links should be visible');
    }

    console.log('marketing-mobile-nav-viewport: PASS');
  } finally {
    await page.close();
    await browser.close();
  }
}

main().catch((err) => die(err?.message ?? String(err)));
