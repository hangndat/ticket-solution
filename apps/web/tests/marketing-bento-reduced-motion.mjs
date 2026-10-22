#!/usr/bin/env node
/**
 * #811 — bento respects prefers-reduced-motion (computed transition, not CSS regex).
 *
 *   pnpm --filter @ticket/web start &
 *   node apps/web/tests/marketing-bento-reduced-motion.mjs [baseUrl]
 */
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = (
  process.argv[2] ||
  process.env.FE_UAT_WEB_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');

function die(msg, code = 1) {
  console.error(`marketing-bento-reduced-motion: ${msg}`);
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

async function cardMotion(page) {
  return page.evaluate(() => {
    const card = document.querySelector('.mkt-bento-card');
    if (!card) return { found: false };
    const style = getComputedStyle(card);
    return {
      found: true,
      transitionDuration: style.transitionDuration,
      animationDuration: style.animationDuration,
      animationName: style.animationName,
    };
  });
}

async function main() {
  const browser = await launchBrowser();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  try {
    await page.setExtraHTTPHeaders({ 'x-forwarded-host': 'vemoki.com' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${BASE}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 120_000,
    });
    await page.waitForSelector('[data-testid="marketing-bento"]', {
      timeout: 60_000,
    });
    await page.locator('[data-testid="marketing-bento"]').scrollIntoViewIfNeeded();

    const reduced = await cardMotion(page);
    if (!reduced.found) die('bento card not found');
    const transitionOff =
      reduced.transitionDuration === '0s' ||
      reduced.transitionDuration.startsWith('0.');
    const animationOff =
      reduced.animationDuration === '0s' ||
      reduced.animationName === 'none' ||
      reduced.animationDuration.startsWith('0.');
    if (!transitionOff && !animationOff) {
      die(
        `reduced-motion: expected disabled motion on .mkt-bento-card, got transition=${reduced.transitionDuration} animation=${reduced.animationDuration}/${reduced.animationName}`,
      );
    }

    console.log('marketing-bento-reduced-motion: PASS', reduced);
  } finally {
    await page.close();
    await browser.close();
  }
}

main().catch((err) => die(err?.message ?? String(err)));
