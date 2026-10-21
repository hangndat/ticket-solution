#!/usr/bin/env node
/**
 * P0 wallet grid — login, redeem (unique code), assert wallet-ticket-grid.
 * Desktop 1280 + mobile 390; separate redeem codes per viewport.
 *
 * Usage:
 *   WEB_BASE_URL=http://localhost:3000 node apps/web/tests/fe-p0-wallet-grid-uat.mjs
 *
 * Env:
 *   WEB_UAT_REDEEM_CODE_DESKTOP / WEB_UAT_REDEEM_CODE_MOBILE — DEMO-MFEST-xxx (one-time each)
 *   WEB_UAT_OUT_DIR — screenshot output (default docs/reviews/assets/fe-p0-wallet-grid-uat)
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT =
  process.env.WEB_UAT_OUT_DIR ||
  join(ROOT, 'docs/reviews/assets/fe-p0-wallet-grid-uat');
const BASE = (
  process.argv[2] ||
  process.env.WEB_BASE_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');
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

async function launchBrowser() {
  const shell = findCachedHeadlessShell();
  const opts = shell
    ? { executablePath: shell, headless: true, args: ['--disable-dev-shm-usage'] }
    : { headless: true, args: ['--disable-dev-shm-usage'] };
  return chromium.launch(opts);
}

async function loginKeycloak(page, base) {
  await page.goto(`${base}/api/auth/login?return=/wallet`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForURL(/openid-connect\/auth|login-actions/, { timeout: 30_000 });
  const userField = page.locator('#username').first();
  const passField = page.locator('#password').first();
  await userField.waitFor({ state: 'visible', timeout: 20_000 });
  await userField.fill(USER);
  await passField.fill(PASS);
  await page.locator('#kc-login').first().click();
  const baseUrl = new URL(base);
  await page.waitForURL(
    (url) =>
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
      url.port === baseUrl.port &&
      !url.pathname.startsWith('/api/auth/login'),
    { timeout: 45_000 },
  );
}

const TENANT_ID =
  process.env.WEB_UAT_TENANT_ID ||
  'd9d9f001-0001-4000-8000-000000000001';
const EVENT_ID =
  process.env.WEB_UAT_EVENT_ID ||
  'd9d9f001-0002-4000-8000-000000000001';

async function redeemCode(page, base, code) {
  const redeemUrl =
    `${base}/redeem?tenantId=${encodeURIComponent(TENANT_ID)}` +
    `&eventId=${encodeURIComponent(EVENT_ID)}` +
    '&tenantSlug=mfest-demo&eventSlug=mfest';
  await page.goto(redeemUrl, { waitUntil: 'networkidle' });
  await page.locator('input[name="code"]').fill(code);
  const submit = page.getByRole('button', {
    name: /Đổi mã/i,
  }).first();
  await submit.click();
  await page
    .locator('.redeem-ticket, [data-testid="redeem-ticket-card"]')
    .first()
    .waitFor({ state: 'visible', timeout: 45_000 });
}

async function assertWalletGrid(page, base, label) {
  await page.goto(`${base}/wallet`, { waitUntil: 'networkidle' });
  await page.getByTestId('site-nav').waitFor({ state: 'visible' });
  const grid = page.getByTestId('wallet-ticket-grid');
  await grid.waitFor({ state: 'visible', timeout: 30_000 });
  const count = await grid.locator('[data-testid^="wallet-ticket-"]').count();
  if (count < 1) {
    const empty = await page.getByTestId('wallet-empty').count();
    const unreachable = await page.getByTestId('wallet-unreachable').count();
    throw new Error(
      `wallet grid empty (${label}): cards=${count} empty=${empty} unreachable=${unreachable} url=${page.url()}`,
    );
  }
  await page.screenshot({
    path: join(OUT, `wallet-${label}.png`),
    fullPage: true,
  });
  return count;
}

mkdirSync(OUT, { recursive: true });
const browser = await launchBrowser();
const results = [];

try {
  const viewports = [
    ['desktop', 1280, 800, process.env.WEB_UAT_REDEEM_CODE_DESKTOP],
    ['mobile', 390, 844, process.env.WEB_UAT_REDEEM_CODE_MOBILE],
  ];

  for (const [name, width, height, codeEnv] of viewports) {
    const code = codeEnv?.trim();
    if (!code) {
      results.push({ viewport: name, skipped: true, reason: 'missing redeem code env' });
      continue;
    }
    const context = await browser.newContext({
      viewport: { width, height },
    });
    const page = await context.newPage();
    try {
      await loginKeycloak(page, BASE);
      await redeemCode(page, BASE, code);
      const cards = await assertWalletGrid(page, BASE, name);
      results.push({ viewport: name, verdict: 'PASS', cards, code });
    } catch (err) {
      await page.screenshot({
        path: join(OUT, `wallet-${name}-fail.png`),
        fullPage: true,
      });
      results.push({
        viewport: name,
        verdict: 'FAIL',
        error: String(err),
        code,
      });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const payload = { base: BASE, results };
writeFileSync(join(OUT, 'uat-results.json'), JSON.stringify(payload, null, 2));
console.log(JSON.stringify(payload, null, 2));

const failed = results.some((r) => r.verdict === 'FAIL');
process.exit(failed ? 1 : 0);
