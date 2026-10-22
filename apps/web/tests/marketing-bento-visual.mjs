#!/usr/bin/env node
/**
 * Epic #770 slice 4 — marketing bento screenshots (PR #776 evidence).
 *
 *   node apps/web/tests/marketing-bento-visual.mjs [baseUrl] [outDir]
 *
 * Viewports: desktop 1280×720, mobile 390×844.
 * Locales: VI (/), EN (/en) via x-forwarded-host + Accept-Language cookie pattern.
 */
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const DEFAULT_OUT = join(
  ROOT,
  'docs/reviews/assets/PR776-marketing-screenshots',
);

const VIEWPORTS = [
  { id: 'desktop-1280', width: 1280, height: 720 },
  { id: 'mobile-390', width: 390, height: 844 },
];

const LOCALES = [
  { id: 'vi', path: '/', host: 'vemoki.com' },
  { id: 'en', path: '/en', host: 'vemoki.com' },
];

function die(msg, code = 1) {
  console.error(`marketing-bento-visual: ${msg}`);
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

async function captureBento(page, base, outDir, locale, vp, reducedMotion) {
  const suffix = reducedMotion === 'reduce' ? '-reduced-motion' : '';
  const file = join(
    outDir,
    `bento-${locale.id}__${vp.id}${suffix}.png`,
  );
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.emulateMedia({ reducedMotion });
  await page.goto(`${base}${locale.path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 120_000,
  });
  await page.waitForSelector('[data-testid="marketing-bento"]', {
    timeout: 60_000,
  });
  const bento = page.locator('[data-testid="marketing-bento"]');
  await bento.scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(600);
  await bento.screenshot({ path: file });
  console.log(`captured ${file}`);
}

async function main() {
  const base =
    process.argv[2] ?? process.env.MARKETING_BENTO_UAT_BASE ?? 'http://127.0.0.1:3000';
  const outDir = resolve(process.argv[3] ?? DEFAULT_OUT);
  mkdirSync(outDir, { recursive: true });

  const browser = await launchBrowser();
  const context = await browser.newContext({
    extraHTTPHeaders: { 'x-forwarded-host': 'vemoki.com' },
  });
  const page = await context.newPage();
  try {
    for (const locale of LOCALES) {
      for (const vp of VIEWPORTS) {
        await captureBento(page, base, outDir, locale, vp, 'no-preference');
        await captureBento(page, base, outDir, locale, vp, 'reduce');
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => die(err?.message ?? String(err)));
