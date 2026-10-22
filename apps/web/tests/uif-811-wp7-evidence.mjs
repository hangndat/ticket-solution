#!/usr/bin/env node
/**
 * #811 UI evidence — marketing nav, locale, bento (per viewport).
 * Usage: node apps/web/tests/uif-811-wp7-evidence.mjs <baseUrl> <outDir>
 */
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = (process.argv[2] ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const OUT = resolve(process.argv[3] ?? 'docs/reviews/assets/uif-811-wp7/after');

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
  return chromium.launch(
    shell
      ? {
          executablePath: shell,
          headless: true,
          args: ['--disable-dev-shm-usage'],
        }
      : { headless: true, args: ['--disable-dev-shm-usage'] },
  );
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await launchBrowser();
  const context = await browser.newContext({
    extraHTTPHeaders: { 'x-forwarded-host': 'vemoki.com' },
  });

  const shots = [
    {
      file: 'marketing-vi-390-nav-closed.png',
      width: 390,
      height: 844,
      path: '/marketing',
      ready: '[data-testid="mkt-nav-menu-toggle"]',
    },
    {
      file: 'marketing-vi-390-nav-open.png',
      width: 390,
      height: 844,
      path: '/marketing',
      ready: '[data-testid="mkt-nav-menu-toggle"]',
      openNav: true,
    },
    {
      file: 'marketing-en-1280-header.png',
      width: 1280,
      height: 800,
      path: '/marketing/en',
      ready: '[data-testid="mkt-header"]',
    },
    {
      file: 'marketing-vi-1280-bento.png',
      width: 1280,
      height: 800,
      path: '/marketing',
      ready: '[data-testid="marketing-bento"]',
      scrollBento: true,
    },
    {
      file: 'attendee-claim-390-footer.png',
      width: 390,
      height: 844,
      path: '/claim',
      ready: '[data-testid="site-footer"]',
      fullPage: true,
    },
  ];

  for (const shot of shots) {
    const page = await context.newPage();
    await page.setViewportSize({ width: shot.width, height: shot.height });
    await page.goto(`${BASE}${shot.path}`, {
      waitUntil: 'domcontentloaded',
      timeout: 120_000,
    });
    await page.waitForSelector(shot.ready, {
      timeout: 60_000,
      state: shot.readyState ?? 'visible',
    });
    if (shot.openNav) {
      await page.getByTestId('mkt-nav-menu-toggle').click();
      await page.waitForSelector('[data-testid="mkt-nav-mobile-menu"]', {
        state: 'visible',
        timeout: 10_000,
      });
    }
    if (shot.scrollBento) {
      await page.locator('[data-testid="marketing-bento"]').scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
    }
    await page.evaluate(() => document.fonts?.ready);
    const outPath = join(OUT, shot.file);
    await page.screenshot({ path: outPath, fullPage: shot.fullPage ?? false });
    console.log('wrote', outPath);
    await page.close();
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
