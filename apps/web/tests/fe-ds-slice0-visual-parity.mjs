#!/usr/bin/env node
/**
 * FE DS slice 0 — capture or compare prod-route screenshots (Epic #766).
 *
 *   node apps/web/tests/fe-ds-slice0-visual-parity.mjs capture <outDir> [baseUrl]
 *   node apps/web/tests/fe-ds-slice0-visual-parity.mjs compare <baselineDir> <candidateDir>
 *
 * Viewports: desktop 1280×720, mobile 390×844.
 * Routes: /, /t/mfest-demo/events/mfest, /redeem, /account, /privacy
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const ROUTES = [
  { id: 'home', path: '/', ready: '[data-testid="site-footer"]' },
  {
    id: 'event-mfest',
    path: '/t/mfest-demo/events/mfest',
    ready: '[data-testid="site-footer"]',
  },
  { id: 'redeem', path: '/redeem', ready: '[data-testid="site-footer"]' },
  {
    id: 'account',
    path: '/account',
    ready:
      '[data-testid="account-session-signed-in"], [data-testid="account-session-signed-out"]',
  },
  { id: 'privacy', path: '/privacy', ready: '[data-testid="site-footer"]' },
];

const VIEWPORTS = [
  { id: 'desktop-1280', width: 1280, height: 720 },
  { id: 'mobile-390', width: 390, height: 844 },
];

function die(msg, code = 1) {
  console.error(`fe-ds-slice0-visual-parity: ${msg}`);
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

function shotName(routeId, vpId) {
  return `${routeId}__${vpId}.png`;
}

async function captureAll(outDir, base) {
  mkdirSync(outDir, { recursive: true });
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  try {
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const route of ROUTES) {
        const url = `${base}${route.path}`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
        await page.waitForSelector(route.ready, { timeout: 60_000 });
        await page.evaluate(() => document.fonts?.ready);
        const settleMs = route.id === 'account' ? 1200 : 500;
        await page.waitForTimeout(settleMs);
        const file = join(outDir, shotName(route.id, vp.id));
        await page.screenshot({ path: file, fullPage: false });
        console.log(`captured ${file}`);
      }
    }
  } finally {
    await browser.close();
  }
}

function listPngs(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.png'))
    .sort();
}

async function compareDirs(baselineDir, candidateDir) {
  if (!existsSync(baselineDir)) die(`missing baseline: ${baselineDir}`);
  if (!existsSync(candidateDir)) die(`missing candidate: ${candidateDir}`);

  const baseFiles = listPngs(baselineDir);
  const candFiles = listPngs(candidateDir);
  if (baseFiles.length === 0) die(`no PNG in ${baselineDir}`);

  const onlyBase = baseFiles.filter((f) => !candFiles.includes(f));
  const onlyCand = candFiles.filter((f) => !baseFiles.includes(f));
  if (onlyBase.length || onlyCand.length) {
    die(
      `file set mismatch base-only=${onlyBase.join(',')} cand-only=${onlyCand.join(',')}`,
    );
  }

  let pixelmatchFn;
  let PNG;
  try {
    pixelmatchFn = (await import('pixelmatch')).default;
    PNG = (await import('pngjs')).PNG;
  } catch {
    die('install pixelmatch + pngjs at repo root for compare mode');
  }

  const rows = [];
  let failed = false;
  for (const name of baseFiles) {
    const a = PNG.sync.read(readFileSync(join(baselineDir, name)));
    const b = PNG.sync.read(readFileSync(join(candidateDir, name)));
    if (a.width !== b.width || a.height !== b.height) {
      rows.push({ name, diffPixels: -1, note: `size ${a.width}x${a.height} vs ${b.width}x${b.height}` });
      failed = true;
      continue;
    }
    const diff = new PNG({ width: a.width, height: a.height });
    const diffPixels = pixelmatchFn(a.data, b.data, diff.data, a.width, a.height, {
      threshold: 0,
    });
    rows.push({ name, diffPixels });
    if (diffPixels !== 0) failed = true;
  }

  const report = { baselineDir, candidateDir, rows, allZero: !failed };
  const reportPath = join(candidateDir, 'parity-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (failed) die('pixel diff > 0 for one or more screenshots');
  console.log('parity: all diffPixels=0');
}

const [mode, arg1, arg2, arg3] = process.argv.slice(2);
if (mode === 'capture') {
  const outDir = resolve(arg1 || die('capture requires outDir'));
  const base = (arg2 || process.env.FE_UAT_WEB_URL || 'http://localhost:3000').replace(
    /\/$/,
    '',
  );
  captureAll(outDir, base).catch((err) => die(err?.message || String(err)));
} else if (mode === 'compare') {
  const baselineDir = resolve(arg1 || die('compare requires baselineDir'));
  const candidateDir = resolve(arg2 || die('compare requires candidateDir'));
  compareDirs(baselineDir, candidateDir).catch((err) => die(err?.message || String(err)));
} else {
  die('usage: capture <outDir> [baseUrl] | compare <baselineDir> <candidateDir>');
}
