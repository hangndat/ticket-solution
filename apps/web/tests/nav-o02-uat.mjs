#!/usr/bin/env node
/**
 * Headless UAT — O02 SiteNav capabilities + soft-redirect (#371).
 *
 * Usage: node apps/web/tests/nav-o02-uat.mjs [baseUrl]
 *
 * AC:
 * - Guest `/` and `/redeem` do not chrome Admin/Cổng/Platform as entitled
 * - Anonymous `/admin` soft-redirects to `/auth`
 * - `/gate` retired (D-6) → permanent redirect home
 */
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { existsSync, readdirSync } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = process.env.WEB_UAT_OUT_DIR || join(ROOT, 'apps/web/.uat-artifacts');
const BASE = (process.argv[2] || process.env.WEB_BASE_URL || 'http://127.0.0.1:3000').replace(
  /\/$/,
  '',
);

function die(msg, code = 1) {
  console.error(`nav-o02-uat: ${msg}`);
  process.exit(code);
}

function findCachedHeadlessShell() {
  if (process.env.WEB_UAT_EXECUTABLE) return process.env.WEB_UAT_EXECUTABLE;
  const cache = join(homedir(), 'Library/Caches/ms-playwright');
  if (!existsSync(cache)) return null;
  const dirs = readdirSync(cache)
    .filter((d) => d.startsWith('chromium_headless_shell-'))
    .sort()
    .reverse();
  for (const dir of dirs) {
    for (const arch of ['chrome-headless-shell-mac-arm64', 'chrome-headless-shell-mac-x64']) {
      const candidate = join(cache, dir, arch, 'chrome-headless-shell');
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

async function launchBrowser() {
  const headed = process.env.WEB_UAT_HEADED === '1';
  const args = headed ? [] : ['--disable-dev-shm-usage'];
  const shell = headed ? null : findCachedHeadlessShell();
  const attempts = [];
  if (shell) attempts.push({ executablePath: shell, headless: true, args });
  attempts.push({ headless: !headed, args });
  if (!headed) attempts.push({ channel: 'chrome', headless: true, args });
  let lastErr;
  for (const opts of attempts) {
    try {
      return await chromium.launch(opts);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error('chromium launch failed');
}

async function assertGuestChrome(page, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('site-nav').waitFor({ state: 'visible' });
  // Wait a tick for capability fetch to settle (deny-by-default must hold).
  await page.waitForTimeout(500);
  const admin = await page.getByTestId('nav-admin').count();
  const gate = await page.getByTestId('nav-gate').count();
  const platform = await page.getByTestId('nav-platform').count();
  if (admin > 0 || gate > 0 || platform > 0) {
    die(
      `${path}: guest chrome leaked staff links admin=${admin} gate=${gate} platform=${platform}`,
    );
  }
  const redeem = await page.getByTestId('nav-redeem').count();
  if (redeem < 1) die(`${path}: missing guest redeem link`);
}

async function assertSoftRedirect(page, path) {
  const res = await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
  const finalUrl = page.url();
  // Soft-redirect still starts at /auth?next=…; stub may land Home notice or PKCE.
  const viaAuthStub =
    finalUrl.includes('/auth') ||
    finalUrl.includes('notice=auth_') ||
    finalUrl.includes('/api/auth/login') ||
    finalUrl.includes('openid-connect');
  if (!viaAuthStub) {
    die(
      `${path}: expected soft-redirect via /auth stub, landed ${finalUrl} (status ${res?.status()})`,
    );
  }
  // First hop must carry next= (staff return). Final may be Home notice after stub.
  if (finalUrl.includes('/auth') && !finalUrl.includes('next=') && !finalUrl.includes('return=')) {
    die(`${path}: /auth missing next=/return=, landed ${finalUrl}`);
  }
}

mkdirSync(OUT, { recursive: true });
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(20000);

  await assertGuestChrome(page, '/');
  await page.screenshot({ path: join(OUT, 'o02-nav-home-guest.png'), fullPage: true });

  await assertGuestChrome(page, '/redeem');
  await page.screenshot({ path: join(OUT, 'o02-nav-redeem-guest.png'), fullPage: true });

  await assertSoftRedirect(page, '/admin');
  await page.screenshot({ path: join(OUT, 'o02-soft-redirect-admin.png'), fullPage: true });

  const gateRes = await page.goto(`${BASE}/gate`, { waitUntil: 'domcontentloaded' });
  const gateUrl = page.url();
  if (!gateUrl.replace(/\?.*$/, '').endsWith('/')) {
    die(`/gate: expected redirect to home, landed ${gateUrl} (status ${gateRes?.status()})`);
  }
  await page.screenshot({ path: join(OUT, 'o02-gate-redirect-home.png'), fullPage: true });

  console.log(`nav-o02-uat: ok ${BASE}`);
  console.log(`nav-o02-uat: artifacts ${OUT}/o02-nav-*.png o02-soft-redirect-*.png`);
} finally {
  await browser.close();
}
