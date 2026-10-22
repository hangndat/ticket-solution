#!/usr/bin/env node
/**
 * Slice A2 evidence — wallet / redeem / event detail (1280 + 390).
 * Requires fe-uat-stack (API :3001, Keycloak) + web on WEB_BASE_URL.
 *
 *   WEB_BASE_URL=http://127.0.0.1:3000 node docs/reviews/assets/ui-uplift-app-a2/capture-a2-screenshots.mjs
 */
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = HERE;
const BASE = (process.env.WEB_BASE_URL || 'http://127.0.0.1:3000').replace(
  /\/$/,
  '',
);
const USER = process.env.WEB_UAT_USER || 'attendee@example.com';
const PASS = process.env.WEB_UAT_PASS || 'attendee-demo';

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

async function login(page) {
  await page.goto(`${BASE}/api/auth/login?return=/wallet`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForURL(/openid-connect\/auth|login-actions/, { timeout: 30_000 });
  await page.locator('#username').first().fill(USER);
  await page.locator('#password').first().fill(PASS);
  await page.locator('#kc-login').first().click();
  await page.waitForURL(/\/wallet/, { timeout: 45_000 });
}

async function shot(page, name, viewport) {
  await page.setViewportSize(viewport);
  await page.screenshot({ path: join(OUT, `${name}-${viewport.width}.png`), fullPage: true });
}

mkdirSync(OUT, { recursive: true });

const shell = findCachedHeadlessShell();
const browser = await chromium.launch(
  shell
    ? { executablePath: shell, headless: true }
    : { headless: true },
);

const desktop = { width: 1280, height: 900 };
const mobile = { width: 390, height: 844 };

const guest = await browser.newContext();
const guestPage = await guest.newPage();
await guestPage.goto(`${BASE}/redeem`, { waitUntil: 'networkidle' });
await guestPage
  .locator('[data-testid="redeem-auth-gate"], aside.auth-unconfigured')
  .first()
  .waitFor({ timeout: 30_000 });
await shot(guestPage, 'redeem-gate', desktop);
await shot(guestPage, 'redeem-gate', mobile);
await guest.close();

const page = await browser.newPage();
await page.goto(`${BASE}/t/mfest-demo/events/mfest`, { waitUntil: 'networkidle' });
const sidebox = page.getByTestId('event-sidebox');
if (await sidebox.count()) {
  await sidebox.waitFor({ timeout: 30_000 });
  await shot(page, 'event-detail-sidebox', desktop);
  await shot(page, 'event-detail-sidebox', mobile);
} else {
  console.warn('skip event-detail: API/content unavailable');
}

await login(page);
await page.goto(`${BASE}/wallet`, { waitUntil: 'networkidle' });
await page.getByTestId('site-nav').waitFor({ timeout: 30_000 });
await shot(page, 'wallet-grid', desktop);
await shot(page, 'wallet-grid', mobile);

const firstTicket = page.locator('[data-testid^="wallet-ticket-"]').first();
if (await firstTicket.count()) {
  await firstTicket.click();
  await page.getByTestId('owner-ticket-qr-figure').waitFor({ timeout: 30_000 });
  await shot(page, 'ticket-qr-panel', desktop);
  await shot(page, 'ticket-qr-panel', mobile);
} else {
  console.warn('skip ticket-qr: no wallet tickets');
}

await browser.close();
console.log(`A2 screenshots → ${OUT}`);
