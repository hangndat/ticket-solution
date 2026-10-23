#!/usr/bin/env node
/**
 * PR #844 — portal platform operator mutate UAT (local stack).
 * Requires: API :3001, portal :3013, Keycloak :8080, D9 bootstrap + platform operator bootstrap.
 *
 *   node apps/portal/scripts/pr844-platform-uat.mjs
 */
import { createHmac } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import axe from 'axe-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = join(ROOT, 'docs/reviews/assets/PR844');
const PORTAL = (process.env.PORTAL_UAT_BASE || 'http://127.0.0.1:3013').replace(
  /\/$/,
  '',
);
const username = process.env.PLATFORM_UAT_USER || 'staff@example.com';
const password = process.env.PLATFORM_UAT_PASS || 'staff-demo';
const TOTP_SECRET_CACHE = join(
  tmpdir(),
  process.env.PR844_TOTP_SECRET_FILE || 'pr844-platform-totp.secret',
);

function loadCachedTotpSecret() {
  if (!existsSync(TOTP_SECRET_CACHE)) return '';
  try {
    return readFileSync(TOTP_SECRET_CACHE, 'utf8').trim();
  } catch {
    return '';
  }
}

function saveCachedTotpSecret(secret) {
  if (!secret) return;
  writeFileSync(TOTP_SECRET_CACHE, secret, { mode: 0o600 });
}

function die(msg) {
  console.error(`pr844-uat: ${msg}`);
  process.exit(1);
}

function totpCounter(step = 30) {
  return Math.floor(Date.now() / 1000 / step);
}

async function waitForNextTotpWindow(step = 30) {
  const start = totpCounter(step);
  while (totpCounter(step) === start) {
    await new Promise((r) => setTimeout(r, 200));
  }
  await new Promise((r) => setTimeout(r, 300));
}

function totpFromSessionSecret(sessionSecret, step = 30, digits = 6) {
  const key = Buffer.from(sessionSecret, 'utf8');
  const counter = totpCounter(step);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** digits).padStart(digits, '0');
}

async function loadPlaywright() {
  const { chromium } = await import('playwright');
  const channel = process.env.WEB_UAT_CHANNEL || undefined;
  const exe =
    process.env.WEB_UAT_EXECUTABLE ||
    chromium.executablePath?.() ||
    undefined;
  return chromium.launch({
    headless: true,
    channel,
    executablePath: channel ? undefined : exe,
  });
}

/** Playwright platform login (Keycloak + portal cookies). */
async function platformLoginWithPlaywright(browser) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto(`${PORTAL}/api/auth/platform/login`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('#username', { timeout: 30_000 });
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('#kc-login');
  await page.waitForTimeout(800);

  let enrolledTotpSecret = loadCachedTotpSecret();
  const totpSecret = page.locator('input[name=totpSecret]');
  if (await totpSecret.count()) {
    enrolledTotpSecret = await totpSecret.inputValue();
    if (!enrolledTotpSecret) die('totpSecret empty on enroll');
    saveCachedTotpSecret(enrolledTotpSecret);
    await page.fill('input[name=totp]', totpFromSessionSecret(enrolledTotpSecret));
    await page.locator('input[type=submit], #kc-login').first().click();
    await page.waitForTimeout(1500);
  }

  const otp = page.locator('input[name=otp]');
  if (await otp.count()) {
    if (!enrolledTotpSecret) die('otp login without enrolled totp secret (cache missing)');
    await waitForNextTotpWindow();
    await otp.fill(totpFromSessionSecret(enrolledTotpSecret));
    await page.locator('input[type=submit], #kc-login').first().click();
    await page.waitForTimeout(2000);
  }

  await page
    .waitForURL((url) => url.origin === new URL(PORTAL).origin, {
      timeout: 45_000,
    })
    .catch(() => {});

  if (!page.url().startsWith(PORTAL)) {
    die(`platform login stuck at ${page.url()}`);
  }

  const cookies = await context.cookies();
  await page.close();
  return { context, cookies };
}

async function runAxe(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(500);
  const results = await page.evaluate(async () => {
    const root =
      document
        .querySelector('[data-testid="platform-grant-create-submit"]')
        ?.closest('.ant-space') ??
      document.querySelector('[data-testid="platform-provision-submit"]')?.closest(
        '.ant-space',
      ) ??
      document.body;
    // @ts-expect-error injected
    return await window.axe.run(root, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    });
  });
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  return serious;
}

const DEMO_TENANT_ID =
  process.env.PR844_UAT_TENANT_ID ||
  'd9d9f001-0001-4000-8000-000000000001';
const DEMO_EVENT_ID =
  process.env.PR844_UAT_EVENT_ID ||
  'd9d9f001-0002-4000-8000-000000000001';
const VIEWPORTS = [
  { tag: '1280', width: 1280, height: 900 },
  { tag: '390', width: 390, height: 844 },
];

async function confirmAntModal(page) {
  await page
    .locator('.ant-modal-confirm-btns .ant-btn-primary')
    .click({ timeout: 15_000 });
  await page.waitForTimeout(500);
}

/** Manage mutations reload detail and clear mutate-status alert — wait on detail row. */
async function waitForTenantDetailStatus(page, status) {
  await page
    .getByTestId('platform-tenant-detail')
    .getByText(status, { exact: true })
    .waitFor({ state: 'visible', timeout: 30_000 });
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const sha = (
    await import('node:child_process')
  ).execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
  const shaShort = sha.slice(0, 12);

  const browser = await loadPlaywright();
  const { context } = await platformLoginWithPlaywright(browser);
  const page = await context.newPage();
  await page.addInitScript(axe.source);

  const shots = [];
  const capture = async (name, action) => {
    if (action) await action();
    await page.waitForTimeout(400);
    const path = join(OUT, `${name}.png`);
    await page.screenshot({ path, fullPage: true });
    shots.push(name);
  };

  await page.goto(`${PORTAL}/platform`, { waitUntil: 'networkidle' });
  await page
    .getByRole('tab', { name: 'Tenants' })
    .waitFor({ state: 'visible', timeout: 45_000 });

  const TAB_KEYS = {
    Tenants: 'tenants',
    Provision: 'provision',
    Manage: 'manage',
    'Grant create': 'grant-create',
  };

  const clickTab = async (name) => {
    const tabKey = TAB_KEYS[name];
    await page.waitForTimeout(400);
    const narrow = (page.viewportSize()?.width ?? 1280) < 500;
    if (narrow && tabKey) {
      await page.evaluate((key) => {
        document.querySelector(`[id$="tab-${key}"]`)?.click();
      }, tabKey);
    } else {
      const tab = page.getByRole('tab', { name });
      try {
        await tab.click({ force: true, timeout: 5000 });
      } catch {
        if (tabKey) {
          await page.evaluate((key) => {
            document.querySelector(`[id$="tab-${key}"]`)?.click();
          }, tabKey);
        } else {
          await page.locator('.ant-tabs-nav-more').click({ timeout: 15_000 });
          await page
            .locator('.ant-tabs-dropdown')
            .getByText(name, { exact: true })
            .click();
        }
      }
    }
    await page.waitForTimeout(500);
  };

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(`${PORTAL}/platform`, { waitUntil: 'networkidle' });
    await clickTab('Tenants');
    await page
      .getByTestId('platform-tenants-table')
      .waitFor({ state: 'visible', timeout: 30_000 });
    const tag = vp.tag;
    const slug = `pr844-${tag}-${Date.now().toString(36)}`;

    await capture(`${shaShort}-provision-${tag}`, async () => {
      await clickTab('Provision');
      await page
        .getByTestId('platform-provision-slug')
        .waitFor({ state: 'visible', timeout: 30_000 });
      await page.getByTestId('platform-provision-slug').fill(slug);
      await page.getByTestId('platform-provision-name').fill(`PR844 ${tag}`);
      await page
        .getByTestId('platform-provision-owner-email')
        .fill('owner-pr844@example.com');
      await page.getByTestId('platform-provision-submit').click();
      await page
        .getByTestId('platform-provision-status')
        .waitFor({ state: 'visible', timeout: 30_000 });
    });

    await capture(`${shaShort}-manage-detail-${tag}`, async () => {
      await clickTab('Manage');
      await page
        .getByTestId('platform-manage-tenant-input')
        .waitFor({ state: 'visible', timeout: 30_000 });
      await page.getByTestId('platform-manage-tenant-input').fill(DEMO_TENANT_ID);
      await page.getByTestId('platform-manage-load').click();
      await page
        .getByTestId('platform-tenant-detail')
        .waitFor({ state: 'visible', timeout: 30_000 });
    });

    await capture(`${shaShort}-suspend-${tag}`, async () => {
      await page.getByTestId('platform-manage-suspend').click();
      await confirmAntModal(page);
      await waitForTenantDetailStatus(page, 'SUSPENDED');
    });

    await capture(`${shaShort}-activate-${tag}`, async () => {
      await page.getByTestId('platform-manage-activate').click();
      await confirmAntModal(page);
      await waitForTenantDetailStatus(page, 'ACTIVE');
    });

    await capture(`${shaShort}-limits-${tag}`, async () => {
      await page.getByTestId('platform-manage-save-limits').click();
      await page
        .getByTestId('platform-tenant-detail')
        .waitFor({ state: 'visible', timeout: 30_000 });
      await page.waitForTimeout(600);
    });

    await capture(`${shaShort}-grant-create-${tag}`, async () => {
      await clickTab('Grant create');
      await page
        .getByTestId('platform-grant-create-tenant')
        .waitFor({ state: 'visible', timeout: 30_000 });
      await page.getByTestId('platform-grant-create-tenant').fill(DEMO_TENANT_ID);
      await page.getByTestId('platform-grant-create-event').fill(DEMO_EVENT_ID);
      await page.getByTestId('platform-grant-create-reason').fill('pr844-uat');
      await page.getByTestId('platform-grant-create-submit').click();
      await confirmAntModal(page);
      await page
        .getByTestId('platform-grant-create-status')
        .waitFor({ state: 'visible', timeout: 30_000 });
    });

    const axeViolations = await runAxe(page);
    if (axeViolations.length) {
      writeFileSync(
        join(OUT, `axe-violations-${tag}.json`),
        JSON.stringify(axeViolations, null, 2),
      );
      die(`axe serious/critical @${tag}: ${axeViolations.length}`);
    }
  }

  const report = {
    sha,
    portal: PORTAL,
    shots,
    axeSeriousCritical: 0,
    at: new Date().toISOString(),
  };
  writeFileSync(join(OUT, 'pr844-uat-report.json'), JSON.stringify(report, null, 2));
  console.log(`PR844_UAT_OK sha=${sha} shots=${shots.length}`);
  await browser.close();
}

main().catch((e) => die(String(e?.message || e)));
