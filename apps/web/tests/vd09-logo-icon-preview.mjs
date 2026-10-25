/**
 * Export isolated neon V mark PNGs from live marketing page (gradients + scope).
 * Usage: node apps/web/tests/vd09-logo-icon-preview.mjs [baseUrl] [outDir]
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3000';
const OUT =
  process.argv[3] ??
  join(dirname(fileURLToPath(import.meta.url)), 'evidence-vd09-neon');
mkdirSync(OUT, { recursive: true });

const sizes = [
  { name: 'logo-mark-34px', px: 34 },
  { name: 'logo-mark-102px-3x', px: 102 },
];

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ deviceScaleFactor: 1 });
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/marketing`, { waitUntil: 'networkidle' });
await page.waitForSelector('.mkt-neon-wordmark-mark', { timeout: 30_000 });

for (const { name, px } of sizes) {
  await page.evaluate((sizePx) => {
    const el = document.querySelector('.mkt-neon-wordmark-mark');
    if (!el) return;
    el.style.width = `${sizePx}px`;
    el.style.height = `${sizePx}px`;
  }, px);
  const file = join(OUT, `${name}.png`);
  await page.locator('.mkt-neon-wordmark-mark').first().screenshot({ path: file });
  console.log(JSON.stringify({ file, px, kind: 'mark-preview' }));
}

await browser.close();
