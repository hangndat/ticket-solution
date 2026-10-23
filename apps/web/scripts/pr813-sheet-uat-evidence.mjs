#!/usr/bin/env node
/**
 * Issue #813 F01 — Sheet mobile nav screenshots for UAT matrix.
 * Usage:
 *   pnpm --filter @ticket/web build && pnpm --filter @ticket/web start --port 3013 &
 *   node apps/web/scripts/pr813-sheet-uat-evidence.mjs http://127.0.0.1:3013
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { waitForAnimationsSettled } from './lib/axe-run.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT_DIR = join(ROOT, 'docs/reviews/assets/PR813');

const CAPTURES = [
  {
    file: 'marketing-vi-mobile-390-menu-closed.png',
    path: '/marketing',
    width: 390,
    height: 844,
    host: 'vemoki.com',
    openMenu: false,
  },
  {
    file: 'marketing-vi-mobile-390-menu-open.png',
    path: '/marketing',
    width: 390,
    height: 844,
    host: 'vemoki.com',
    openMenu: true,
    menuTestId: 'mkt-nav-menu-toggle',
  },
  {
    file: 'marketing-en-mobile-390-menu-closed.png',
    path: '/marketing/en',
    width: 390,
    height: 844,
    host: 'vemoki.com',
    openMenu: false,
  },
  {
    file: 'marketing-en-mobile-390-menu-open.png',
    path: '/marketing/en',
    width: 390,
    height: 844,
    host: 'vemoki.com',
    openMenu: true,
    menuTestId: 'mkt-nav-menu-toggle',
  },
  {
    file: 'marketing-vi-desktop-1280-menu-closed.png',
    path: '/marketing',
    width: 1280,
    height: 900,
    host: 'vemoki.com',
    openMenu: false,
  },
  {
    file: 'attendee-vi-mobile-390-menu-closed.png',
    path: '/',
    width: 390,
    height: 844,
    openMenu: false,
  },
  {
    file: 'attendee-vi-mobile-390-menu-open.png',
    path: '/',
    width: 390,
    height: 844,
    openMenu: true,
    menuTestId: 'nav-menu-toggle',
    sheetTestId: 'nav-mobile-menu',
  },
  {
    file: 'attendee-vi-desktop-1280-menu-closed.png',
    path: '/',
    width: 1280,
    height: 900,
    openMenu: false,
  },
];

function die(msg, code = 1) {
  console.error(`pr813-sheet-uat-evidence: ${msg}`);
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
  if (!shell) die('Playwright headless shell not found');
  return chromium.launch({
    executablePath: shell,
    headless: true,
    args: ['--disable-dev-shm-usage'],
  });
}

async function shot(page, file) {
  const out = join(OUT_DIR, file);
  await page.screenshot({ path: out, fullPage: false });
  const md5 = createHash('md5').update(readFileSync(out)).digest('hex');
  writeFileSync(`${out}.md5.txt`, `${md5}\n`);
  console.log(`captured ${file} md5=${md5}`);
  return md5;
}

async function captureOne(browser, base, spec) {
  const context = await browser.newContext(
    spec.host ? { extraHTTPHeaders: { 'x-forwarded-host': spec.host } } : {},
  );
  const page = await context.newPage();
  try {
    await page.setViewportSize({ width: spec.width, height: spec.height });
    const res = await page.goto(`${base}${spec.path}`, {
      waitUntil: 'domcontentloaded',
      timeout: 120_000,
    });
    if (!res || !res.ok()) die(`navigation failed ${spec.path} status=${res?.status()}`);

    const readySelector = spec.path.startsWith('/marketing')
      ? '[data-testid="marketing-surface"]'
      : '[data-testid="site-header"]';
    await page.waitForSelector(readySelector, { timeout: 60_000 });
    await page.evaluate(() => document.fonts?.ready);
    await waitForAnimationsSettled(page, { extraSettleMs: 1000 });

    if (spec.openMenu && spec.menuTestId) {
      const toggle = page.getByTestId(spec.menuTestId);
      if ((await toggle.count()) === 0) die(`menu toggle missing: ${spec.menuTestId}`);
      await toggle.click();
      const sheetId = spec.sheetTestId ?? 'mkt-nav-mobile-menu';
      await page.waitForSelector(`[data-testid="${sheetId}"]`, {
        state: 'visible',
        timeout: 15_000,
      });
      await waitForAnimationsSettled(page, { extraSettleMs: 500 });
    }

    return await shot(page, spec.file);
  } finally {
    await context.close();
  }
}

async function main() {
  const base = process.argv[2]?.replace(/\/$/, '');
  if (!base) die('usage: node pr813-sheet-uat-evidence.mjs <baseUrl>');
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await launchBrowser();
  const md5s = [];
  try {
    for (const spec of CAPTURES) {
      md5s.push(await captureOne(browser, base, spec));
    }
  } finally {
    await browser.close();
  }

  const unique = new Set(md5s);
  if (unique.size < md5s.length) {
    die(`duplicate md5 among ${md5s.length} captures — states must differ`);
  }
  console.log(`done ${OUT_DIR} (${md5s.length} images, ${unique.size} unique md5)`);
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
