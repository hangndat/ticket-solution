/**
 * VD-09 neon marketing evidence — full-page screenshots.
 * Usage: pnpm --filter @ticket/web start & node apps/web/tests/vd09-neon-evidence.mjs http://127.0.0.1:3000
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3000';
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'evidence-vd09-neon');
mkdirSync(OUT, { recursive: true });

const SHOTS = [
  { name: 'marketing-vi-1440-full', path: '/marketing', width: 1440, height: 900, fullPage: true },
  { name: 'marketing-vi-390-full', path: '/marketing', width: 390, height: 844, fullPage: true },
  { name: 'marketing-en-1440-full', path: '/marketing/en', width: 1440, height: 900, fullPage: true },
  { name: 'marketing-en-390-full', path: '/marketing/en', width: 390, height: 844, fullPage: true },
  { name: 'marketing-vi-768-overflow', path: '/marketing', width: 768, height: 1024, fullPage: false },
  { name: 'marketing-vi-320-overflow', path: '/marketing', width: 320, height: 568, fullPage: false },
];

/** Header lockup crops — aligned with UI/UX review evidence names. */
const LOGO_SHOTS = [
  {
    name: 'logo-1440-wordmark',
    path: '/marketing',
    width: 1440,
    height: 900,
    selector: '[data-testid="mkt-wordmark"]',
  },
  {
    name: 'logo-390-wordmark',
    path: '/marketing',
    width: 390,
    height: 844,
    selector: '[data-testid="mkt-wordmark"]',
  },
  {
    name: 'logo-1440-mark-only',
    path: '/marketing',
    width: 1440,
    height: 900,
    selector: '[data-testid="mkt-wordmark"] .mkt-neon-wordmark-mark',
  },
  {
    name: 'logo-320-wordmark',
    path: '/marketing',
    width: 320,
    height: 568,
    selector: '[data-testid="mkt-wordmark"]',
  },
];

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();

for (const shot of SHOTS) {
  await page.setViewportSize({ width: shot.width, height: shot.height });
  await page.goto(`${BASE}${shot.path}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="marketing-neon-hero"]', { timeout: 30_000 });
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(doc.scrollWidth - doc.clientWidth, 0);
  });
  const file = join(OUT, `${shot.name}.png`);
  await page.screenshot({ path: file, fullPage: shot.fullPage ?? false });
  console.log(JSON.stringify({ file, width: shot.width, overflowPx: overflow }));
}

for (const shot of LOGO_SHOTS) {
  await page.setViewportSize({ width: shot.width, height: shot.height });
  await page.goto(`${BASE}${shot.path}`, { waitUntil: 'networkidle' });
  await page.waitForSelector(shot.selector, { timeout: 30_000 });
  const file = join(OUT, `${shot.name}.png`);
  await page.locator(shot.selector).screenshot({ path: file });
  console.log(JSON.stringify({ file, width: shot.width, kind: 'logo-crop' }));
}

await browser.close();
console.log(`Evidence written to ${OUT}`);
