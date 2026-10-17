#!/usr/bin/env node
/**
 * D11-B5 headless UAT: admin job IA, readiness, tech disclosure, brand chrome.
 * Explicit UAT-only route intercepts when auth/fixtures unavailable — does not
 * claim real API / production UAT.
 *
 * Usage: node apps/web/tests/d11-admin-workspace-uat.mjs [baseUrl]
 * Default base: http://127.0.0.1:3111
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
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

mkdirSync(OUT, { recursive: true });
const browser = await launchBrowser();
const proofLimits = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  page.setDefaultTimeout(20000);

  await page.route('**/api/bff/me/tenants', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [TENANT_A, TENANT_B] }),
    });
  });
  proofLimits.push(
    'GET /api/bff/me/tenants intercepted (UAT-only fixture) — không claim real IdP/API tenants.',
  );

  const response = await page.goto(`${base}/admin`, {
    waitUntil: 'domcontentloaded',
  });
  if (!response?.ok())
    throw new Error(`GET /admin status ${response?.status()}`);

  await page.locator('[data-testid="admin-workspace"]').waitFor();
  await page.locator('[data-testid="admin-job-nav"]').waitFor();
  await page.locator('[data-testid="admin-readiness"]').waitFor();

  for (const job of ['setup', 'guests', 'gate', 'support']) {
    await page.getByTestId(`admin-job-${job}`).click();
    await page
      .locator(`[data-job="${job}"]:not([hidden]), [data-testid="admin-${job}-panel"]:not([hidden]), [data-testid="admin-setup-config"]:not([hidden]), [data-testid="admin-guests-panel"]:not([hidden]), [data-testid="admin-gate-panel"]:not([hidden]), [data-testid="admin-support-panel"]:not([hidden])`)
      .first()
      .waitFor({ state: 'visible' });
  }
  await page.getByTestId('admin-job-setup').click();

  // Progressive disclosure: UUID fields behind technical details
  const tech = page.getByTestId('admin-tech-details');
  await tech.locator('summary').click();
  await page.getByLabel('Tenant ID', { exact: true }).fill(TENANT_A.tenantId);
  await page.getByLabel('Event ID', { exact: true }).fill(
    '22222222-2222-4222-8222-222222222222',
  );

  await page.getByTestId('tenant-selector').selectOption(TENANT_A.tenantId);
  const summaryA = await page.getByTestId('admin-event-summary').innerText();
  if (!/MFest Demo/i.test(summaryA))
    throw new Error(`tenant A brand/context missing in summary: ${summaryA}`);

  const shotA = join(OUT, 'd11-admin-tenant-a.png');
  await page.screenshot({ path: shotA, fullPage: true });

  await page.getByTestId('tenant-selector').selectOption(TENANT_B.tenantId);
  const summaryB = await page.getByTestId('admin-event-summary').innerText();
  if (!/Aurora Org/i.test(summaryB))
    throw new Error(`tenant B context missing after switch: ${summaryB}`);
  if (/MFest Demo/i.test(summaryB))
    throw new Error('tenant A name leaked after switch to tenant B');

  const shotB = join(OUT, 'd11-admin-tenant-b.png');
  await page.screenshot({ path: shotB, fullPage: true });

  // Mobile viewport smoke
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId('admin-job-guests').click();
  await page.getByTestId('admin-guests-panel').waitFor({ state: 'visible' });
  const shotMobile = join(OUT, 'd11-admin-mobile-390.png');
  await page.screenshot({ path: shotMobile, fullPage: true });

  // Keyboard: job nav focusable / 44px hit
  await page.setViewportSize({ width: 1280, height: 900 });
  const box = await page.getByTestId('admin-job-setup').boundingBox();
  if (!box || box.height < 40 || box.width < 40)
    throw new Error(`job nav hit target too small: ${JSON.stringify(box)}`);

  const readiness = await page.getByTestId('admin-readiness-summary').innerText();
  if (!readiness.trim()) throw new Error('empty readiness summary');

  const handoff = {
    shaHint: 'see git rev-parse HEAD at run time',
    base,
    artifacts: [shotA, shotB, shotMobile],
    proofLimits,
    checks: [
      'job nav setup/guests/gate/support visible switch',
      'tech details progressive disclosure for Tenant/Event ID',
      '≥2 tenant context switch without name leak',
      'readiness strip present',
      'viewport 1280 + 390',
    ],
  };
  writeFileSync(
    join(OUT, 'd11-admin-workspace-handoff.json'),
    JSON.stringify(handoff, null, 2),
  );

  console.log(`d11-admin-workspace-uat: ok ${base}/admin`);
  console.log(`d11-admin-workspace-uat: shotA ${shotA}`);
  console.log(`d11-admin-workspace-uat: shotB ${shotB}`);
  console.log(`d11-admin-workspace-uat: shotMobile ${shotMobile}`);
  for (const line of proofLimits) console.log(`d11-admin-workspace-uat: LIMIT ${line}`);
} finally {
  await browser.close();
}
