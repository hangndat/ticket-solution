#!/usr/bin/env node
/**
 * Epic #715 nits — logged-in catalog owned strip + gate bar (D9 stack).
 * Usage: node apps/web/tests/fe-web-715-nits-evidence.mjs [baseUrl]
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = join(ROOT, 'apps/web/.uat-artifacts/fe-web-715-nits');
const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const USER = process.env.WEB_UAT_USER || 'attendee@example.com';
const PASS = process.env.WEB_UAT_PASS || 'attendee-demo';
const STAFF_USER = process.env.WEB_UAT_STAFF_USER || 'staff@example.com';
const STAFF_PASS = process.env.WEB_UAT_STAFF_PASS || 'staff-demo';

function findCachedHeadlessShell() {
  const cache = join(homedir(), 'Library/Caches/ms-playwright');
  if (!existsSync(cache)) return null;
  for (const dir of readdirSync(cache).filter((d) => d.startsWith('chromium_headless_shell-')).sort().reverse()) {
    for (const arch of ['chrome-headless-shell-mac-arm64', 'chrome-headless-shell-mac-x64']) {
      const candidate = join(cache, dir, arch, 'chrome-headless-shell');
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

async function launchBrowser() {
  const shell = findCachedHeadlessShell();
  const attempts = [];
  if (shell) attempts.push({ executablePath: shell, headless: true, args: ['--disable-dev-shm-usage'] });
  attempts.push({ headless: true, args: ['--disable-dev-shm-usage'] });
  attempts.push({ channel: 'chrome', headless: true, args: ['--disable-dev-shm-usage'] });
  for (const opts of attempts) {
    try {
      return await chromium.launch(opts);
    } catch {
      /* try next */
    }
  }
  throw new Error('chromium launch failed');
}

async function keycloakLogin(page, email, password, returnPath = '/') {
  await page.goto(`${BASE}/api/auth/login?return=${encodeURIComponent(returnPath)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.waitForURL(/openid-connect\/auth|login-actions/, { timeout: 30_000 });
  let prefer = process.env.KEYCLOAK_PUBLIC_HOST || '';
  if (!prefer) {
    try {
      const disc = await page.request.get(
        'http://127.0.0.1:8080/realms/ticket/.well-known/openid-configuration',
      );
      if (disc.ok()) prefer = new URL((await disc.json()).issuer).hostname;
    } catch {
      prefer = '';
    }
  }
  if (!prefer) prefer = '127.0.0.1';
  const u = new URL(page.url());
  if (u.port === '8080' && u.hostname !== prefer) {
    u.hostname = prefer;
    await page.goto(u.toString(), { waitUntil: 'networkidle' });
  }
  const userField = page.locator('#username').or(page.getByLabel(/username|email/i)).first();
  const passField = page.locator('#password').or(page.getByLabel(/password/i)).first();
  await userField.waitFor({ state: 'visible', timeout: 20_000 });
  await userField.fill(email);
  await passField.fill(password);
  await page.locator('#kc-login').or(page.getByRole('button', { name: /sign in|log in/i })).first().click();
  const baseUrl = new URL(BASE);
  const appHosts = new Set(['127.0.0.1', 'localhost', baseUrl.hostname]);
  await page.waitForURL(
    (url) =>
      appHosts.has(url.hostname) &&
      url.port === baseUrl.port &&
      !url.pathname.startsWith('/api/auth/login') &&
      url.pathname !== '/auth',
    { timeout: 60_000 },
  );
}

mkdirSync(OUT, { recursive: true });
const browser = await launchBrowser();
const context = await browser.newContext();
const page = await context.newPage();

await keycloakLogin(page, USER, PASS);
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.waitForSelector('[data-testid="home-catalog"]', { timeout: 30_000 });
await page.setViewportSize({ width: 1280, height: 900 });
await page.screenshot({ path: join(OUT, 'home-owned-desktop.png'), fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: join(OUT, 'home-owned-mobile.png'), fullPage: true });
await page.getByTestId('nav-menu-toggle').click();
await page.waitForSelector('[data-testid="nav-mobile-menu"]', { timeout: 10_000 });
await page.screenshot({ path: join(OUT, 'mobile-menu-open.png'), fullPage: true });
await page.getByTestId('nav-mobile-backdrop').click();
await page.waitForSelector('[data-testid="nav-mobile-menu"]', { state: 'detached', timeout: 10_000 });

await context.clearCookies();
await keycloakLogin(page, STAFF_USER, STAFF_PASS, '/gate');
await page.waitForSelector('[data-testid="gate-bar"], [data-testid="gate-workspace"]', {
  timeout: 60_000,
});
await page.setViewportSize({ width: 1280, height: 900 });
await page.screenshot({ path: join(OUT, 'gate-scope-desktop.png'), fullPage: true });

writeFileSync(
  join(OUT, 'report.json'),
  JSON.stringify({ base: BASE, out: OUT, at: new Date().toISOString() }, null, 2),
);
await browser.close();
console.log(`fe-web-715-nits-evidence: ok → ${OUT}`);
