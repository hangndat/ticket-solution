/**
 * VD-10 violet primary evidence — consumer + marketing regression at 1440/390.
 * Usage: pnpm --filter @ticket/web start & node apps/web/tests/vd10-violet-evidence.mjs http://127.0.0.1:3000
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = (process.argv[2] ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'evidence-vd10-violet');
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { tag: '1440', width: 1440, height: 900 },
  { tag: '390', width: 390, height: 844 },
];

const ROUTES = [
  { id: 'home', path: '/', waitFor: '[data-testid="attendee-home"]' },
  { id: 'redeem', path: '/redeem', waitFor: 'main' },
  { id: 'wallet', path: '/wallet', waitFor: 'main' },
  { id: 'account', path: '/account', waitFor: 'main' },
  { id: 'claim', path: '/claim', waitFor: 'main' },
  { id: 'invite', path: '/invite', waitFor: 'main' },
  { id: 'not-found', path: '/vd10-violet-404', waitFor: 'main' },
  {
    id: 'marketing-neon',
    path: '/marketing',
    waitFor: '[data-testid="marketing-neon-hero"]',
  },
];

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const manifest = [];

for (const route of ROUTES) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle' });
    if (route.waitFor) {
      await page.waitForSelector(route.waitFor, { timeout: 45_000 });
    }
    const file = join(OUT, `${route.id}-${vp.tag}.png`);
    await page.screenshot({ path: file, fullPage: true });
    manifest.push({ surface: route.id, viewport: vp.tag, file: `${route.id}-${vp.tag}.png` });
    console.log(JSON.stringify({ file, route: route.path, viewport: vp.tag }));
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
    await page.waitForSelector('main', { timeout: 45_000 });
    const file = join(OUT, `event-detail-${vp.tag}.png`);
    await page.screenshot({ path: file, fullPage: true });
    manifest.push({
      surface: 'event-detail',
      viewport: vp.tag,
      file: `event-detail-${vp.tag}.png`,
      href: eventHref,
    });
  }
}

writeFileSync(
  join(OUT, 'manifest.json'),
  `${JSON.stringify({ base: BASE, capturedAt: new Date().toISOString(), shots: manifest }, null, 2)}\n`,
);
await browser.close();
