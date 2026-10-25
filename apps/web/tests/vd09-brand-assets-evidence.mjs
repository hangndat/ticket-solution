/**
 * VD-09 brand asset evidence — OG, product BrandMark, attendee header lockups.
 * Usage: pnpm --filter @ticket/web start & node apps/web/tests/vd09-brand-assets-evidence.mjs http://127.0.0.1:3000
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3000';
const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'evidence-vd09-brand-assets');
mkdirSync(OUT, { recursive: true });

copyFileSync(
  join(WEB_ROOT, 'app/opengraph-image.png'),
  join(OUT, 'opengraph-preview.png'),
);

const HEADER_WIDTHS = [
  { name: 'header-1440', width: 1440, height: 900 },
  { name: 'header-390', width: 390, height: 844 },
  { name: 'header-320', width: 320, height: 568 },
];

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ deviceScaleFactor: 2 });

for (const shot of HEADER_WIDTHS) {
  await page.setViewportSize({ width: shot.width, height: shot.height });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="site-wordmark"]', { timeout: 30_000 });
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(doc.scrollWidth - doc.clientWidth, 0);
  });
  writeFileSync(
    join(OUT, `${shot.name}-overflow.json`),
    `${JSON.stringify({ overflowPx: overflow })}\n`,
  );
  await page.locator('[data-testid="site-wordmark"]').screenshot({
    path: join(OUT, `${shot.name}-wordmark.png`),
  });
  console.log(JSON.stringify({ shot: shot.name, overflowPx: overflow }));
}

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-testid="brand-mark-svg"]', { timeout: 30_000 });
const mark = page.locator('[data-testid="brand-mark-svg"]');

await page.evaluate(() => {
  document.body.style.background = '#F4F6F8';
});
await mark.screenshot({ path: join(OUT, 'product-brand-mark-light.png') });

await page.evaluate(() => {
  document.body.style.background = '#0B1220';
});
await mark.screenshot({ path: join(OUT, 'product-brand-mark-dark.png') });

const svgCount = await page.locator('[data-testid="site-wordmark"] svg').count();
writeFileSync(
  join(OUT, 'product-mark-count.json'),
  `${JSON.stringify({ svgCount })}\n`,
);

await browser.close();
console.log(JSON.stringify({ out: OUT, svgCount }));
