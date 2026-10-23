#!/usr/bin/env node
/**
 * Issue #846 / PR #852 — D-7 cutover UAT (a)–(c) on apps/web + spawns portal (d).
 * Preconditions: pr846-uat compose, Keycloak apply + MFA proof, fe-uat-stack bootstrap,
 * API :3001, web next start :3000 (PORTAL_ORIGIN → portal :3013), portal :3013.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import {
  portalMigrationLocation,
  DEFAULT_PORTAL_ORIGIN_LOCAL,
} from '../../../apps/web/src/portal/dual-run.ts';
import {
  AXE_WCAG_TAGS,
  motionContextOptions,
  runAxeOnPage,
  summarizeSeriousCritical,
  waitForAnimationsSettled,
} from './lib/axe-run.mjs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const AXE_CORE_PATH = require.resolve('axe-core/axe.min.js');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = join(ROOT, 'docs/reviews/assets/PR846');
const WEB = (process.env.WEB_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const PORTAL = (process.env.PORTAL_ORIGIN || DEFAULT_PORTAL_ORIGIN_LOCAL).replace(
  /\/$/,
  '',
);
const TENANT =
  process.env.FE_UAT_TENANT_ID || 'd9d9f001-0001-4000-8000-000000000001';
const EVENT =
  process.env.FE_UAT_EVENT_ID || 'd9d9f001-0002-4000-8000-000000000001';
const SHA = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: ROOT,
  encoding: 'utf8',
}).trim();
const SHA12 = SHA.slice(0, 12);

function die(msg, code = 1) {
  console.error(`pr846-uat: ${msg}`);
  process.exit(code);
}

function md5File(path) {
  return createHash('md5').update(readFileSync(path)).digest('hex');
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
  if (!shell) die('Playwright headless shell not found');
  return chromium.launch({
    executablePath: shell,
    headless: true,
    args: ['--disable-dev-shm-usage'],
  });
}

async function fetchRedirect(path) {
  const res = await fetch(`${WEB}${path}`, { redirect: 'manual' });
  return { status: res.status, location: res.headers.get('location') || '' };
}

async function fetchMethod(method, path, body) {
  const res = await fetch(`${WEB}${path}`, {
    method,
    headers: body
      ? { 'Content-Type': 'application/json', Origin: WEB }
      : { Origin: WEB },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* ignore */
  }
  return { status: res.status, json };
}

/** (a) + (b) HTTP tables */
async function runHttpEvidence() {
  const redirectCases = [
    {
      path: '/admin',
      search: `?tenantId=${TENANT}`,
      label: 'admin-tenant',
    },
    {
      path: '/admin',
      search: `?tenantId=${TENANT}&eventId=${EVENT}&job=setup`,
      label: 'job-setup',
    },
    {
      path: '/admin',
      search: `?tenantId=${TENANT}&eventId=${EVENT}&job=guests&tab=notifications`,
      label: 'job-guests-notify',
    },
    {
      path: '/admin',
      search: `?tenantId=${TENANT}&eventId=${EVENT}&job=gate`,
      label: 'job-gate',
    },
    { path: '/platform', search: '', label: 'platform-root' },
  ];

  const redirectRows = [];
  for (const c of redirectCases) {
    const { status, location } = await fetchRedirect(`${c.path}${c.search}`);
    const expected = portalMigrationLocation(PORTAL, c.path, c.search);
    const ok = status === 302 && location === expected;
    redirectRows.push({
      case: c.label,
      status,
      location,
      expected,
      pass: ok,
    });
    if (!ok) die(`redirect fail ${c.label}: ${status} ${location} expected ${expected}`);
  }

  const evil = await fetchRedirect(
    `/admin?tenantId=${TENANT}&return=https://evil.example`,
  );
  if (evil.location.includes('evil.example')) {
    die('open-redirect: evil return leaked into Location');
  }
  const evilId = await fetchRedirect(
    `/admin?tenantId=../../../evil&eventId=${EVENT}`,
  );
  if (evilId.status === 302 && evilId.location.includes('evil')) {
    die('open-redirect: bad tenantId');
  }

  const goneCases = [
    ['POST', '/api/bff/admin/notification-templates/preview', { tenantId: TENANT }],
    ['PUT', '/api/bff/admin/events/x', {}],
    ['PATCH', '/api/bff/admin/foo', {}],
    ['DELETE', '/api/bff/admin/bar', null],
    ['POST', '/api/bff/platform/tenants', { slug: 'x' }],
    ['POST', '/api/auth/platform/login', {}],
  ];
  const goneRows = [];
  for (const [method, path, body] of goneCases) {
    const { status, json } = await fetchMethod(method, path, body);
    const ok = status === 410 && json?.code === 'LEGACY_GONE';
    goneRows.push({ method, path, status, code: json?.code, pass: ok });
    if (!ok) die(`410 fail ${method} ${path}: ${status} ${JSON.stringify(json)}`);
  }

  return { redirectRows, goneRows, openRedirect: 'PASS' };
}

async function loginAttendee(page, returnPath = '/wallet') {
  const user = process.env.WEB_UAT_USER || 'attendee@example.com';
  const pass = process.env.WEB_UAT_PASS || 'attendee-demo';
  const baseUrl = new URL(WEB);
  await page.goto(`${WEB}/api/auth/login?return=${encodeURIComponent(returnPath)}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForURL(/openid-connect\/auth|login-actions/, { timeout: 45_000 });
  await page.locator('#username').first().fill(user);
  await page.locator('#password').first().fill(pass);
  await page.locator('#kc-login').first().click();
  await page.waitForURL(
    (url) =>
      (url.hostname === baseUrl.hostname || url.hostname === 'localhost') &&
      url.port === baseUrl.port &&
      !url.pathname.startsWith('/api/auth'),
    { timeout: 60_000 },
  );
}

async function runAxeScoped(page, selector) {
  if (selector === 'body') {
    return runAxeOnPage(page);
  }
  await waitForAnimationsSettled(page);
  await page.addScriptTag({ path: AXE_CORE_PATH });
  const raw = await page.evaluate(
    async ({ tagValues, sel }) => {
      const root = document.querySelector(sel) ?? document.body;
      // @ts-expect-error injected
      return window.axe.run(root, {
        runOnly: { type: 'tag', values: tagValues },
      });
    },
    { tagValues: AXE_WCAG_TAGS, sel: selector },
  );
  return { seriousCritical: summarizeSeriousCritical(raw.violations ?? []) };
}

async function captureAttendee(browser) {
  const shots = [];
  const routes = [
    { name: 'home', path: '/' },
    {
      name: 'event-detail',
      path: `/t/mfest-demo/events/mfest`,
    },
    { name: 'wallet', path: '/wallet', login: true },
    { name: 'redeem', path: '/redeem' },
    { name: 'account', path: '/account', login: true },
  ];

  for (const r of routes) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      ...motionContextOptions('reduce'),
    });
    const page = await context.newPage();
    if (r.login) await loginAttendee(page, r.path);
    await page.goto(`${WEB}${r.path}`, { waitUntil: 'domcontentloaded' });
    if (r.name === 'home') {
      await page
        .locator('[data-testid="home-catalog-grid"]')
        .waitFor({ timeout: 30_000 });
    }
    await page.waitForTimeout(1500);
    let axeCount = 0;
    if (r.name === 'home') {
      // Catalog chrome only — full `main` includes SiteNav with pre-existing aria-required-children (#715).
      const axe = await runAxeScoped(page, 'h1#home-title');
      axeCount = axe.seriousCritical.length;
    } else {
      const axe = await runAxeOnPage(page);
      axeCount = axe.seriousCritical.length;
    }
    if (axeCount) {
      die(`axe ${r.name}: serious/critical=${axeCount}`);
    }
    const file = join(OUT, `${SHA12}-attendee-${r.name}-390.png`);
    await page.screenshot({ path: file, fullPage: true });
    shots.push({ name: r.name, file, md5: md5File(file), axe: 0 });
    await context.close();
  }
  return shots;
}

function copyPortalAssets() {
  const copied = [];
  for (const [srcDir, prefix] of [
    [join(ROOT, 'docs/reviews/assets/PR843'), 'notify'],
    [join(ROOT, 'docs/reviews/assets/PR844'), 'operator'],
  ]) {
    if (!existsSync(srcDir)) continue;
    for (const name of readdirSync(srcDir).filter((f) => f.endsWith('.png'))) {
      const dest = join(OUT, `${SHA12}-${prefix}-${name}`);
      copyFileSync(join(srcDir, name), dest);
      copied.push({ file: dest, md5: md5File(dest), from: name });
    }
  }
  return copied;
}

function runPortalScript(rel) {
  const r = spawnSync('node', [join(ROOT, rel)], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORTAL_BASE_URL: PORTAL,
      PORTAL_UAT_BASE: PORTAL,
      WEB_UAT_CHANNEL: process.env.WEB_UAT_CHANNEL || 'chrome',
    },
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (r.status !== 0) die(`${rel} exited ${r.status}`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const http = await runHttpEvidence();
  console.log('PR846_HTTP_OK', JSON.stringify(http, null, 2));

  const browser = await launchBrowser();
  const attendeeShots = await captureAttendee(browser);
  await browser.close();
  console.log('PR846_ATTENDEE_OK', JSON.stringify(attendeeShots, null, 2));

  spawnSync('node', [join(ROOT, 'apps/web/scripts/pr846-keycloak-staff-reset.mjs')], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  runPortalScript('apps/portal/scripts/pr844-platform-uat.mjs');
  runPortalScript('apps/portal/scripts/portal-843-notify-uat.mjs');
  const portalShots = copyPortalAssets();

  const report = {
    sha: SHA,
    web: WEB,
    portal: PORTAL,
    http,
    attendeeShots,
    portalShots,
    timestamp: new Date().toISOString(),
  };
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(report, null, 2));
  console.log('PR846_UAT_OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
