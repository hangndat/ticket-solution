#!/usr/bin/env node
/**
 * Headless UAT — home catalog chrome (Epic #715 wave 2).
 *
 * Usage: node apps/web/tests/home-catalog-uat.mjs [baseUrl]
 *
 * AC (layout / chrome — catalog data optional when API down):
 * - Guest nav includes «Tài khoản»
 * - Footer product links on one row (desktop)
 * - Catalog grid columns: 1 @ 390, 2 @ 1024, 3 @ 1280 when grid present
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = process.env.WEB_UAT_OUT_DIR || join(ROOT, 'apps/web/.uat-artifacts');
const BASE = (process.argv[2] || process.env.WEB_BASE_URL || 'http://localhost:3000').replace(
  /\/$/,
  '',
);

function die(msg, code = 1) {
  console.error(`home-catalog-uat: ${msg}`);
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
  if (shell) attempts.push({ executablePath: shell, headless: true, args: ['--disable-dev-shm-usage'] });
  attempts.push({ headless: true, args: ['--disable-dev-shm-usage'] });
  attempts.push({ channel: 'chrome', headless: true, args: ['--disable-dev-shm-usage'] });
  let lastErr;
  for (const opts of attempts) {
    try {
      return await chromium.launch(opts);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error('chromium launch failed');
}

async function gridColumns(page) {
  const grid = page.locator('[data-testid="home-catalog-grid"]');
  if ((await grid.count()) === 0) return null;
  return page.evaluate(() => {
    const el = document.querySelector('[data-testid="home-catalog-grid"]');
    if (!el) return null;
    return getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length;
  });
}

async function runViewport(page, label, width, height) {
  await page.setViewportSize({ width, height });
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('[data-testid="site-nav"]', { timeout: 30_000 });

  const account = page.locator('[data-testid="nav-account"]');
  if ((await account.count()) === 0) die(`${label}: missing nav-account link`);
  const accountText = (await account.first().textContent())?.trim() ?? '';
  if (!accountText.includes('Tài khoản')) {
    die(`${label}: nav-account label expected «Tài khoản», got «${accountText}»`);
  }

  const footer = page.locator('[data-testid="site-footer"]');
  if ((await footer.count()) === 0) die(`${label}: missing site footer`);

  const footerWrap = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="site-footer"]');
    if (!el) return null;
    return getComputedStyle(el).flexWrap;
  });
  if (width >= 640 && footerWrap !== 'nowrap') {
    die(`${label}: footer flex-wrap expected nowrap on desktop, got ${footerWrap}`);
  }

  const cols = await gridColumns(page);
  if (cols !== null) {
    const expected = width >= 1280 ? 3 : width >= 640 ? 2 : 1;
    if (cols !== expected) {
      die(`${label}: catalog grid columns expected ${expected}, got ${cols}`);
    }
    const art = page.locator('[data-testid^="home-catalog-art-"]');
    const bannerImg = page.locator('[data-testid^="home-banner-img-"]');
    if ((await art.count()) > 0 && (await bannerImg.count()) > 0) {
      die(`${label}: catalog cards must not render marketing banner images`);
    }
  } else {
    console.warn(`${label}: catalog grid absent (API empty/unreachable) — chrome checks only`);
  }

  mkdirSync(OUT, { recursive: true });
  const shot = join(OUT, `home-catalog-${label}-${width}.png`);
  await page.screenshot({ path: shot, fullPage: true });
  return shot;
}

async function main() {
  const browser = await launchBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();
  const shots = [];
  try {
    shots.push(await runViewport(page, 'mobile-390', 390, 844));
    shots.push(await runViewport(page, 'desktop-1280', 1280, 900));
  } finally {
    await browser.close();
  }
  const report = {
    baseUrl: BASE,
    viewports: ['390x844', '1280x900'],
    screenshots: shots,
    at: new Date().toISOString(),
  };
  const reportPath = join(OUT, 'home-catalog-uat-report.json');
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`home-catalog-uat: PASS — report ${reportPath}`);
}

main().catch((err) => die(err instanceof Error ? err.message : String(err)));
