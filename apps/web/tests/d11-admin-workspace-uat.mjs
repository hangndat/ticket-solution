#!/usr/bin/env node
/**
 * D11-B5 headless UAT: admin job IA, readiness, tech disclosure, brand chrome.
 * Prefers live GET /api/bff/me/tenants when the session can return ≥2 tenants.
 * Intercept only as explicit fallback — recorded as known gap, never fake PASS.
 *
 * Usage: node apps/web/tests/d11-admin-workspace-uat.mjs [baseUrl]
 * Default base: http://127.0.0.1:3111
 * Env: WEB_UAT_BASE, WEB_UAT_FORCE_TENANT_INTERCEPT=1, WEB_UAT_EXECUTABLE
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = join(ROOT, 'apps/web/.uat-artifacts');
const base = (process.argv[2] || process.env.WEB_UAT_BASE || 'http://127.0.0.1:3111').replace(
  /\/*$/,
  '',
);
const TENANT_A = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  slug: 'mfest',
  name: 'MFest Demo',
  status: 'ACTIVE',
  tenantPermissions: ['event.write', 'event.read'],
  role: 'Owner',
};
const TENANT_B = {
  tenantId: 'a2222222-2222-4222-8222-222222222222',
  slug: 'aurora',
  name: 'Aurora Org',
  status: 'ACTIVE',
  tenantPermissions: ['event.write', 'event.read'],
  role: 'Manager',
};

function gitSha() {
  try {
    return execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
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
  const args = ['--disable-dev-shm-usage'];
  const shell = findCachedHeadlessShell();
  const attempts = [];
  if (shell) attempts.push({ executablePath: shell, headless: true, args });
  attempts.push({ headless: true, args });
  attempts.push({ channel: 'chrome', headless: true, args });
  let lastErr;
  for (const opts of attempts) {
    try {
      return await chromium.launch(opts);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error('could not launch headless Chromium');
}

function parseTenantItems(json) {
  if (!json || typeof json !== 'object') return [];
  const items = Array.isArray(json.items)
    ? json.items
    : Array.isArray(json)
      ? json
      : [];
  return items.filter(
    (t) =>
      t &&
      typeof t === 'object' &&
      typeof t.tenantId === 'string' &&
      (typeof t.name === 'string' || typeof t.slug === 'string'),
  );
}

mkdirSync(OUT, { recursive: true });
const sha = gitSha();
const browser = await launchBrowser();
const proofLimits = [];
const checks = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  page.setDefaultTimeout(20000);

  const forceIntercept = process.env.WEB_UAT_FORCE_TENANT_INTERCEPT === '1';
  let usedIntercept = false;
  let liveTenants = [];

  if (!forceIntercept) {
    // Probe live tenants without navigating (no intercept). Cookie session may be absent.
    try {
      const probe = await page.request.get(`${base}/api/bff/me/tenants`, {
        timeout: 8000,
      });
      if (probe.ok()) {
        liveTenants = parseTenantItems(await probe.json());
      } else {
        proofLimits.push(
          `GET /api/bff/me/tenants live status ${probe.status()} — không đủ credential/session cho brand UAT thật.`,
        );
      }
    } catch (err) {
      proofLimits.push(
        `GET /api/bff/me/tenants live probe failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const canUseLive = !forceIntercept && liveTenants.length >= 2;
  if (!canUseLive) {
    usedIntercept = true;
    await page.route('**/api/bff/me/tenants', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [TENANT_A, TENANT_B] }),
      });
    });
    proofLimits.push(
      forceIntercept
        ? 'WEB_UAT_FORCE_TENANT_INTERCEPT=1 — intercepted /me/tenants (explicit).'
        : 'GET /api/bff/me/tenants intercepted (UAT-only fixture) — thiếu ≥2 tenant live / session; known gap, không claim real IdP/API tenants.',
    );
  } else {
    checks.push(`live /me/tenants ok (${liveTenants.length} tenants) — no intercept`);
  }

  const response = await page.goto(`${base}/admin`, {
    waitUntil: 'domcontentloaded',
  });
  if (!response?.ok())
    throw new Error(`GET /admin status ${response?.status()}`);

  await page.locator('[data-testid="admin-workspace"]').waitFor();
  await page.locator('[data-testid="admin-job-nav"]').waitFor();
  await page.locator('[data-testid="admin-readiness"]').waitFor();
  checks.push('job nav + readiness strip present');

  // Title / copy chrome
  const h1 = await page.locator('h1').first().innerText();
  if (!/Không gian quản trị sự kiện/.test(h1))
    throw new Error(`unexpected admin h1: ${h1}`);
  checks.push('admin title Không gian quản trị sự kiện');

  for (const job of ['setup', 'guests', 'gate', 'support']) {
    await page.getByTestId(`admin-job-${job}`).click();
    await page
      .locator(`[data-job="${job}"]:not([hidden]), [data-testid="admin-${job}-panel"]:not([hidden]), [data-testid="admin-setup-config"]:not([hidden]), [data-testid="admin-guests-panel"]:not([hidden]), [data-testid="admin-gate-panel"]:not([hidden]), [data-testid="admin-support-panel"]:not([hidden])`)
      .first()
      .waitFor({ state: 'visible' });
  }
  await page.getByTestId('admin-job-setup').click();
  checks.push('job nav setup/guests/gate/support visible switch');

  // Progressive disclosure: UUID fields + jargon behind technical details
  const tech = page.getByTestId('admin-tech-details');
  await tech.locator('summary').click();
  await page.getByLabel('Tenant ID', { exact: true }).fill(
    canUseLive ? liveTenants[0].tenantId : TENANT_A.tenantId,
  );
  await page.getByLabel('Event ID', { exact: true }).fill(
    '22222222-2222-4222-8222-222222222222',
  );
  checks.push('tech details progressive disclosure for Tenant/Event ID');

  // Publish gating: without checklist, button disabled
  const publishBtn = page.getByTestId('config-publish-button');
  await publishBtn.waitFor({ state: 'visible' });
  if (!(await publishBtn.isDisabled())) {
    throw new Error('Publish should be disabled when checklist not ready');
  }
  checks.push('publish gated disabled when !publishReady');

  const visibleCreateHelp = await page
    .locator('#create-event-heading')
    .locator('xpath=following-sibling::p[1]')
    .innerText();
  if (/Idempotency-Key|CSRF/.test(visibleCreateHelp)) {
    throw new Error(`create help still exposes jargon: ${visibleCreateHelp}`);
  }
  checks.push('create help plain (jargon in details)');

  const tenantA = canUseLive ? liveTenants[0] : TENANT_A;
  const tenantB = canUseLive ? liveTenants[1] : TENANT_B;
  const nameA = tenantA.name || tenantA.slug;
  const nameB = tenantB.name || tenantB.slug;

  await page.getByTestId('tenant-selector').selectOption(tenantA.tenantId);
  const summaryA = await page.getByTestId('admin-event-summary').innerText();
  if (!new RegExp(nameA.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(summaryA))
    throw new Error(`tenant A brand/context missing in summary: ${summaryA}`);

  const shotA = join(OUT, 'd11-admin-tenant-a.png');
  await page.screenshot({ path: shotA, fullPage: true });

  await page.getByTestId('tenant-selector').selectOption(tenantB.tenantId);
  const summaryB = await page.getByTestId('admin-event-summary').innerText();
  if (!new RegExp(nameB.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(summaryB))
    throw new Error(`tenant B context missing after switch: ${summaryB}`);
  if (new RegExp(nameA.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(summaryB))
    throw new Error('tenant A name leaked after switch to tenant B');

  const shotB = join(OUT, 'd11-admin-tenant-b.png');
  await page.screenshot({ path: shotB, fullPage: true });
  checks.push('≥2 tenant context switch without name leak');

  // Mobile viewport smoke
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId('admin-job-guests').click();
  await page.getByTestId('admin-guests-panel').waitFor({ state: 'visible' });
  const shotMobile = join(OUT, 'd11-admin-mobile-390.png');
  await page.screenshot({ path: shotMobile, fullPage: true });
  checks.push('viewport 1280 + 390');

  // Keyboard: job nav focusable / 44px hit
  await page.setViewportSize({ width: 1280, height: 900 });
  const box = await page.getByTestId('admin-job-setup').boundingBox();
  if (!box || box.height < 40 || box.width < 40)
    throw new Error(`job nav hit target too small: ${JSON.stringify(box)}`);

  const readiness = await page.getByTestId('admin-readiness-summary').innerText();
  if (!readiness.trim()) throw new Error('empty readiness summary');

  const handoff = {
    sha: sha ?? 'unknown',
    shaHint: sha ? undefined : 'see git rev-parse HEAD at run time',
    base,
    usedTenantIntercept: usedIntercept,
    liveTenantCount: canUseLive ? liveTenants.length : 0,
    artifacts: [shotA, shotB, shotMobile],
    proofLimits,
    checks,
    verdictNote: usedIntercept
      ? 'PASS with known gap — UI/job IA verified; /me/tenants fixture intercept (no real session credential).'
      : 'PASS — live /me/tenants used; UI/job IA + publish gating verified.',
  };
  writeFileSync(
    join(OUT, 'd11-admin-workspace-handoff.json'),
    JSON.stringify(handoff, null, 2),
  );

  console.log(`d11-admin-workspace-uat: ok ${base}/admin`);
  console.log(`d11-admin-workspace-uat: sha ${sha ?? 'unknown'}`);
  console.log(`d11-admin-workspace-uat: shotA ${shotA}`);
  console.log(`d11-admin-workspace-uat: shotB ${shotB}`);
  console.log(`d11-admin-workspace-uat: shotMobile ${shotMobile}`);
  console.log(
    `d11-admin-workspace-uat: tenants ${usedIntercept ? 'intercept' : 'live'}`,
  );
  for (const line of proofLimits)
    console.log(`d11-admin-workspace-uat: LIMIT ${line}`);
  for (const line of checks) console.log(`d11-admin-workspace-uat: CHECK ${line}`);
} finally {
  await browser.close();
}
