#!/usr/bin/env node
/**
 * #793 — before/after screenshot parity for dead CSS removal.
 *
 *   node apps/web/tests/uif-793-dead-css-visual.mjs capture <outDir> [baseUrl]
 *   node apps/web/tests/uif-793-dead-css-visual.mjs compare <beforeDir> <afterDir> <summaryJson>
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
  { id: 'marketing-home-vi', path: '/marketing', ready: '.mkt-footer, [data-testid="marketing-bento"]' },
  { id: 'marketing-home-en', path: '/marketing/en', ready: '.mkt-footer, [data-testid="marketing-bento"]' },
  { id: 'catalog-home', path: '/', ready: '[data-testid="site-footer"]' },
  {
    id: 'event-detail',
    path: '/t/mfest-demo/events/mfest',
    ready: '[data-testid="site-footer"]',
  },
  {
    id: 'ticket-detail',
    path: '/t/uat-device/tickets/97f77680-4d65-4b6d-baf3-b3f699a006a6',
    ready: '[data-testid="site-footer"]',
  },
  { id: 'wallet', path: '/wallet', ready: '[data-testid="site-footer"]' },
  { id: 'redeem', path: '/redeem', ready: '[data-testid="site-footer"]' },
  {
    id: 'account',
    path: '/account',
    ready: '[data-testid="site-footer"], main, .shell',
  },
  { id: 'privacy', path: '/privacy', ready: '[data-testid="site-footer"]' },
  { id: 'claim', path: '/claim', ready: '[data-testid="site-footer"]' },
  { id: 'invite', path: '/invite', ready: '[data-testid="site-footer"]' },
];

const VIEWPORTS = [
  { id: '1280', width: 1280, height: 720 },
  { id: '390', width: 390, height: 844 },
];

function die(msg, code = 1) {
  console.error(`uif-793-dead-css-visual: ${msg}`);
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

async function capture(outDir, baseUrl) {
  mkdirSync(outDir, { recursive: true });
  const browser = await launchBrowser();
  const context = await browser.newContext();
  for (const vp of VIEWPORTS) {
    const page = await context.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const route of ROUTES) {
      const url = `${baseUrl.replace(/\/$/, '')}${route.path}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await page.waitForSelector(route.ready, { timeout: 60_000 });
      await page.evaluate(() => document.fonts?.ready);
      await page.waitForTimeout(route.id === 'account' ? 1200 : 500);
      const file = join(outDir, `${route.id}-${vp.id}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`captured ${file}`);
    }
    await page.close();
  }
  await browser.close();
}

async function compare(beforeDir, afterDir, summaryPath) {
  const { PNG } = await import('pngjs');
  const pixelmatch = (await import('pixelmatch')).default;
  const results = [];
  for (const vp of VIEWPORTS) {
    for (const route of ROUTES) {
      const name = `${route.id}-${vp.id}.png`;
      const beforePath = join(beforeDir, name);
      const afterPath = join(afterDir, name);
      if (!existsSync(beforePath) || !existsSync(afterPath)) {
        die(`missing pair for ${name}`);
      }
      const a = PNG.sync.read(readFileSync(beforePath));
      const b = PNG.sync.read(readFileSync(afterPath));
      if (a.width !== b.width || a.height !== b.height) {
        results.push({
          file: name,
          diffPixels: -1,
          note: `size mismatch ${a.width}x${a.height} vs ${b.width}x${b.height}`,
        });
        continue;
      }
      const diff = new PNG({ width: a.width, height: a.height });
      const diffPixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
        threshold: 0.1,
      });
      results.push({ file: name, diffPixels, width: a.width, height: a.height });
      if (diffPixels > 0) {
        const diffPath = join(dirname(summaryPath), `diff-${name}`);
        writeFileSync(diffPath, PNG.sync.write(diff));
      }
    }
  }
  writeFileSync(summaryPath, JSON.stringify({ comparedAt: new Date().toISOString(), results }, null, 2));
  const total = results.reduce((s, r) => s + (r.diffPixels > 0 ? r.diffPixels : 0), 0);
  console.log(`total diff pixels: ${total}`);
  for (const r of results.filter((x) => x.diffPixels !== 0)) {
    console.log(`  ${r.file}: ${r.diffPixels}${r.note ? ` (${r.note})` : ''}`);
  }
}

const [mode, ...rest] = process.argv.slice(2);
if (mode === 'capture') {
  const [outDir, baseUrl = 'http://127.0.0.1:3000'] = rest;
  if (!outDir) die('usage: capture <outDir> [baseUrl]');
  await capture(resolve(outDir), baseUrl);
} else if (mode === 'compare') {
  const [beforeDir, afterDir, summaryPath] = rest;
  if (!beforeDir || !afterDir || !summaryPath) {
    die('usage: compare <beforeDir> <afterDir> <summaryJson>');
  }
  await compare(resolve(beforeDir), resolve(afterDir), resolve(summaryPath));
} else {
  die('usage: capture|compare …');
}
