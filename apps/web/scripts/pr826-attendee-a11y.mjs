#!/usr/bin/env node
/**
 * PR #826 axe-core on attendee home @390/@1280 (motion + reduced-motion).
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { motionContextOptions, runAxeOnPage } from './lib/axe-run.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function die(msg, code = 1) {
  console.error(`pr826-attendee-a11y: ${msg}`);
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

const VIEWPORTS = [
  { id: '390', width: 390, height: 844 },
  { id: '1280', width: 1280, height: 900 },
];

async function main() {
  const base = process.argv[2]?.replace(/\/$/, '');
  const sha = process.argv[3];
  if (!base || !sha) {
    die('usage: node pr826-attendee-a11y.mjs <baseUrl> <sha>');
  }
  const outDir = resolve(join(ROOT, 'docs/reviews/assets/PR826'), `a11y-${sha.slice(0, 12)}`);
  mkdirSync(outDir, { recursive: true });

  const shell = findCachedHeadlessShell();
  if (!shell) die('Playwright headless shell not found');
  const browser = await chromium.launch({
    executablePath: shell,
    headless: true,
    args: ['--disable-dev-shm-usage'],
  });
  const reports = [];

  try {
    for (const motion of ['default', 'reduce']) {
      for (const vp of VIEWPORTS) {
        const context = await browser.newContext(motionContextOptions(motion));
        const page = await context.newPage();
        await page.setViewportSize({ width: vp.width, height: vp.height });
        const res = await page.goto(`${base}/`, {
          waitUntil: 'domcontentloaded',
          timeout: 120_000,
        });
        if (!res?.ok()) die(`navigation failed ${vp.id}`);
        await page.waitForSelector('[data-testid="site-header"]');
        const { violationCount, seriousCritical } = await runAxeOnPage(page);
        const label = `${vp.id}-${motion}`;
        reports.push({ label, violationCount, seriousCritical });
        if (seriousCritical.length > 0) {
          die(`axe serious/critical ${label}: ${JSON.stringify(seriousCritical)}`);
        }
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  const out = { sha, reports };
  writeFileSync(join(outDir, 'axe-summary.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
