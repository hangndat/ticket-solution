/**
 * Independent VD10 violet review evidence @ prod server.
 * node docs/reviews/assets/vd10-violet-review/capture-reviewer.mjs http://127.0.0.1:3000
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = (process.argv[2] ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const OUT = dirname(fileURLToPath(import.meta.url));
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
  {
    id: 'ticket-qr',
    path: '/t/uat-device/tickets/97f77680-4d65-4b6d-baf3-b3f699a006a6',
    waitFor: 'main',
  },
  {
    id: 'event-detail',
    path: '/t/mfest-demo/events/mfest',
    waitFor: 'main',
  },
];

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function normalizeRgb(rgb) {
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return rgb;
  const hex = (n) => Number(n).toString(16).padStart(2, '0');
  return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`.toUpperCase();
}

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const manifest = [];
const probes = [];

for (const route of ROUTES) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle' });
    if (route.waitFor) {
      await page.waitForSelector(route.waitFor, { timeout: 45_000 }).catch(() => {});
    }
    const file = join(OUT, `${route.id}-${vp.tag}.png`);
    await page.screenshot({ path: file, fullPage: true });
    manifest.push({
      surface: route.id,
      viewport: vp.tag,
      file: `${route.id}-${vp.tag}.png`,
      sha256: sha256File(file),
    });
  }
}

await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`${BASE}/redeem`, { waitUntil: 'networkidle' });
const redeemBtn = page.locator('button, a').filter({ hasText: /Tiếp tục/i }).first();
if (await redeemBtn.count()) {
  const bg = await redeemBtn.evaluate((el) => getComputedStyle(el).backgroundColor);
  probes.push({ probe: 'redeem-tiep-tuc-bg', value: normalizeRgb(bg), expected: '#7C4DED' });
}

const primaryBtns = page.locator('[class*="bg-primary"], button.border-primary');
if (await primaryBtns.count()) {
  const bg = await primaryBtns.first().evaluate((el) => getComputedStyle(el).backgroundColor);
  probes.push({ probe: 'redeem-first-primary-bg', value: normalizeRgb(bg), expected: '#7C4DED' });
}

await page.goto(`${BASE}/account`, { waitUntil: 'networkidle' });
const avatar = page.locator('[data-testid="account-avatar"], img[alt*="avatar" i], .rounded-full').first();
if (await avatar.count()) {
  const ring = await avatar.evaluate((el) => {
    const s = getComputedStyle(el);
    return { border: s.borderColor, outline: s.outlineColor };
  });
  probes.push({ probe: 'account-avatar-chrome', value: ring });
}

const baselineMarketing = join(
  dirname(OUT),
  '../vd09-production/marketing-vi-desktop-1440.png',
);
let marketingCompare = null;
try {
  const current = join(OUT, 'marketing-neon-1440.png');
  marketingCompare = {
    baseline: baselineMarketing,
    baselineSha256: sha256File(baselineMarketing),
    currentSha256: sha256File(current),
    pixelUnchanged: sha256File(baselineMarketing) === sha256File(current),
  };
} catch {
  marketingCompare = { error: 'baseline missing' };
}

writeFileSync(
  join(OUT, 'manifest.json'),
  `${JSON.stringify(
    {
      base: BASE,
      capturedAt: new Date().toISOString(),
      reviewSha: 'e8eeb584ba4438f215c68741c4fa66e031555088',
      shots: manifest,
      probes,
      marketingCompare,
    },
    null,
    2,
  )}\n`,
);

await browser.close();
console.log(JSON.stringify({ ok: true, probes, marketingCompare }, null, 2));
