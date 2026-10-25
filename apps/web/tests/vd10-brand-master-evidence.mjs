/**
 * VD-10 brand master evidence — consumer chrome + marketing lockups (no ↗ on defaults).
 * Usage: pnpm --filter @ticket/web start & node apps/web/tests/vd10-brand-master-evidence.mjs http://127.0.0.1:3000
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = (process.argv[2] ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'evidence-vd10-brand-master');
const REPO = join(dirname(fileURLToPath(import.meta.url)), '../../..');
mkdirSync(OUT, { recursive: true });

for (const name of [
  'lockup.png',
  'og.png',
  'email-header.png',
  'app-icon.png',
  'mark.svg',
  'mark-mono.svg',
]) {
  copyFileSync(join(REPO, 'brand/vemoki', name), join(OUT, `brand-${name}`));
}
copyFileSync(
  join(REPO, 'apps/web/public/demo/banner.png'),
  join(OUT, 'demo-banner.png'),
);
copyFileSync(
  join(REPO, 'apps/web/public/demo/logo.png'),
  join(OUT, 'demo-logo.png'),
);

const VIEWPORTS = [
  { tag: '1440', width: 1440, height: 900 },
  { tag: '390', width: 390, height: 844 },
];

const CROPS = [
  {
    id: 'consumer-home-wordmark',
    path: '/',
    selector: '[data-testid="site-wordmark"]',
    waitFor: '[data-testid="attendee-home"]',
  },
  {
    id: 'marketing-wordmark',
    path: '/marketing',
    selector: '[data-testid="mkt-wordmark"]',
    waitFor: '[data-testid="marketing-neon-hero"]',
  },
];

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ deviceScaleFactor: 2 });
const manifest = [];

for (const crop of CROPS) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(`${BASE}${crop.path}`, { waitUntil: 'networkidle' });
    await page.waitForSelector(crop.waitFor, { timeout: 45_000 });
    await page.waitForSelector(crop.selector, { timeout: 30_000 });
    const text = await page.locator(crop.selector).innerText();
    if (text.includes('↗')) {
      throw new Error(`${crop.id}@${vp.tag} still shows signal arrow in wordmark chrome`);
    }
    const file = join(OUT, `${crop.id}-${vp.tag}.png`);
    await page.locator(crop.selector).screenshot({ path: file });
    manifest.push({
      surface: crop.id,
      viewport: vp.tag,
      file: `${crop.id}-${vp.tag}.png`,
      wordmarkText: text.replace(/\s+/g, ' ').trim(),
    });
    console.log(JSON.stringify({ file, text: text.trim() }));
  }
}

await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
const eventHref = await page
  .locator('[data-testid="home-catalog"], [data-testid="attendee-home"]')
  .locator('a[href*="/events/"]')
  .first()
  .getAttribute('href')
  .catch(() => null);

if (eventHref) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(`${BASE}${eventHref}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="site-wordmark"]', { timeout: 45_000 });
    const text = await page.locator('[data-testid="site-wordmark"]').innerText();
    if (text.includes('↗')) {
      throw new Error(`event-detail-wordmark@${vp.tag} still shows signal arrow`);
    }
    const file = join(OUT, `event-detail-wordmark-${vp.tag}.png`);
    await page.locator('[data-testid="site-wordmark"]').screenshot({ path: file });
    manifest.push({
      surface: 'event-detail-wordmark',
      viewport: vp.tag,
      file: `event-detail-wordmark-${vp.tag}.png`,
      href: eventHref,
      wordmarkText: text.replace(/\s+/g, ' ').trim(),
    });
    console.log(JSON.stringify({ file, href: eventHref, text: text.trim() }));
  }
}

writeFileSync(
  join(OUT, 'manifest.json'),
  `${JSON.stringify({ base: BASE, shots: manifest }, null, 2)}\n`,
);
await browser.close();
