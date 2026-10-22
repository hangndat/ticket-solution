#!/usr/bin/env node
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const OUT = dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.WEB_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const SHA = process.env.EVIDENCE_SHA || 'local';

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

async function probe(page) {
  return page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const card = document.querySelector(
      'html[data-surface="product"] .catalog-skeleton-card, .catalog-skeleton-card',
    );
    const mkt = document.querySelector('.mkt.mkt--uplift');
    return {
      ':root --line': root.getPropertyValue('--line').trim(),
      ':root --color-line': root.getPropertyValue('--color-line').trim(),
      ':root --space-4': root.getPropertyValue('--space-4').trim(),
      '.catalog-skeleton-card borderTopColor': card
        ? getComputedStyle(card).borderTopColor
        : null,
      '--line on .mkt.mkt--uplift': mkt
        ? getComputedStyle(mkt).getPropertyValue('--line').trim()
        : null,
    };
  });
}

const shell = findCachedHeadlessShell();
const browser = await chromium.launch(
  shell ? { executablePath: shell, headless: true } : { headless: true },
);
const page = await browser.newPage();

const shots = [
  { file: 'after-marketing-home-1280.png', path: '/marketing', width: 1280, height: 900 },
  { file: 'after-marketing-home-390.png', path: '/marketing', width: 390, height: 844 },
  { file: 'after-catalog-1280.png', path: '/', width: 1280, height: 900 },
  { file: 'after-wallet-1280.png', path: '/wallet', width: 1280, height: 900 },
];

const probeOut = { sha: SHA, servers: { after: `${BASE} next start` }, routes: {} };

for (const shot of shots) {
  await page.setViewportSize({ width: shot.width, height: shot.height });
  await page.goto(`${BASE}${shot.path}`, { waitUntil: 'networkidle' });
  if (shot.path === '/') {
    await page
      .locator('.catalog-skeleton-card')
      .first()
      .waitFor({ timeout: 15_000 })
      .catch(() => {});
  }
  await page.screenshot({ path: join(OUT, shot.file), fullPage: false });
  if (shot.path === '/' || shot.path === '/marketing') {
    probeOut.routes[shot.path] = await probe(page);
  }
}

writeFileSync(join(OUT, 'css-var-probe.json'), `${JSON.stringify(probeOut, null, 2)}\n`);
await browser.close();
