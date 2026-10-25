/**
 * VD-09 interest CTA click-path — dialog/sheet must open after hydration.
 * Usage: pnpm --filter @ticket/web start & node apps/web/tests/vd09-neon-interest-click.mjs http://127.0.0.1:3000
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3000';

async function assertInterestOpens(page, testId) {
  await page.goto(`${BASE}/marketing`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="marketing-neon-hero"]', { timeout: 30_000 });
  await page.click(`[data-testid="${testId}"]`);
  const interest = page.getByTestId('marketing-interest');
  await interest.waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByTestId('interest-form').waitFor({ state: 'visible', timeout: 15_000 });
  const inputs = await interest.locator('input').count();
  if (inputs < 5) {
    throw new Error(`${testId}: expected >=5 inputs in interest UI, got ${inputs}`);
  }
  const hash = await page.evaluate(() => window.location.hash);
  if (hash !== '#interest') {
    throw new Error(`${testId}: expected hash #interest, got ${hash}`);
  }
  await page.keyboard.press('Escape');
  await interest.waitFor({ state: 'hidden', timeout: 5000 });
  const hashAfter = await page.evaluate(() => window.location.hash);
  if (hashAfter) {
    throw new Error(`${testId}: expected hash cleared after Escape, got ${hashAfter}`);
  }
}

async function assertDeepLink(page) {
  await page.goto(`${BASE}/marketing#interest`, { waitUntil: 'networkidle' });
  const interest = page.getByTestId('marketing-interest');
  await interest.waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByTestId('interest-form').waitFor({ state: 'visible', timeout: 15_000 });
  await page.keyboard.press('Escape');
  await interest.waitFor({ state: 'hidden', timeout: 5000 });
}

const browser = await chromium.launch({ channel: 'chrome' });

const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await assertInterestOpens(desktop, 'cta-interest');
await assertInterestOpens(desktop, 'cta-interest-final');
await assertInterestOpens(desktop, 'cta-interest-nav');
await assertDeepLink(desktop);
await desktop.close();

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await assertInterestOpens(mobile, 'cta-interest');
await assertInterestOpens(mobile, 'cta-interest-final');
await mobile.close();

await browser.close();
console.log('vd09-neon-interest-click: OK');
