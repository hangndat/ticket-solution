/**
 * VD-10 marketing DS-WEB evidence — neon CTAs, legal chrome, interest hash.
 * Usage: pnpm --filter @ticket/web start & node apps/web/tests/vd10-marketing-evidence.mjs http://127.0.0.1:3000
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3000';
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'evidence-vd10-marketing');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();

async function shot(name, path, width, height, opts = {}) {
  await page.setViewportSize({ width, height });
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 120_000 });
  if (opts.waitFor) {
    await page.waitForSelector(opts.waitFor, { timeout: 60_000 });
  }
  if (opts.hash) {
    await page.evaluate((hash) => {
      window.location.hash = hash;
    }, opts.hash);
    await page.waitForTimeout(400);
  }
  if (opts.click) {
    await page.locator(opts.click).click();
    await page.waitForTimeout(350);
  }
  const file = join(OUT, `${name}.png`);
  await page.screenshot({
    path: file,
    fullPage: opts.fullPage ?? false,
  });
  console.log('wrote', file);
}

await shot('marketing-vi-1440-demo', '/marketing#demo', 1440, 900, {
  waitFor: '[data-testid="cta-demo"]',
  fullPage: false,
});
await shot('marketing-vi-390-demo', '/marketing#demo', 390, 844, {
  waitFor: '[data-testid="cta-demo"]',
  fullPage: false,
});
await shot('marketing-vi-1440-interest', '/marketing#interest', 1440, 900, {
  waitFor: '[data-testid="marketing-interest"]',
});
await shot('marketing-vi-390-interest', '/marketing#interest', 390, 844, {
  waitFor: '[data-testid="marketing-interest"]',
});
await shot('privacy-vi-1440-chrome', '/marketing/privacy', 1440, 900, {
  waitFor: '[data-testid="mkt-chrome-demo"]',
});
await shot('support-vi-390-chrome', '/marketing/support', 390, 844, {
  waitFor: '[data-testid="mkt-chrome-demo"]',
});
await shot('marketing-vi-390-mobile-nav', '/marketing', 390, 844, {
  waitFor: '[data-testid="mkt-nav-menu-toggle"]',
  click: '[data-testid="mkt-nav-menu-toggle"]',
});

writeFileSync(
  join(OUT, 'README.md'),
  `# VD-10 marketing evidence\n\nBase: ${BASE}\nCaptured: ${new Date().toISOString()}\n`,
);

await browser.close();
console.log(`Evidence written to ${OUT}`);
