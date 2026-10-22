#!/usr/bin/env node
/**
 * API + optional Playwright sanity for FE UAT stack (Epic #715 markers).
 *
 * API (default): public catalog/terms, staff me/*, attendee redeem + tickets.
 * UI (--ui): redeem-terms-consent, wallet-ticket-grid, admin-workspace, gate-tabs.
 */
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const apiBase = (
  process.env.FE_UAT_API_URL || 'http://127.0.0.1:3001'
).replace(/\/$/, '');
const webBase = (
  process.env.FE_UAT_WEB_URL || 'http://localhost:3000'
).replace(/\/$/, '');
const ui = process.argv.includes('--ui');
const pepper =
  process.env.CODE_HMAC_PEPPER || 'local-dev-code-pepper-change-me';
const issuer =
  process.env.OIDC_ISSUER || 'http://127.0.0.1:8080/realms/ticket';
const UAT_TENANT_ID =
  process.env.FE_UAT_TENANT_ID || 'd9d9f001-0001-4000-8000-000000000001';
const UAT_EVENT_ID =
  process.env.FE_UAT_EVENT_ID || 'd9d9f001-0002-4000-8000-000000000001';
const REDEEM_ASSET_DIR =
  process.env.FE_UAT_REDEEM_ASSET_DIR ||
  join(ROOT, 'docs/reviews/assets/fe-redeem-terms-harness-2026-10-22');

function tenantBoundRedeemUrl(base) {
  return (
    `${base}/redeem?tenantId=${encodeURIComponent(UAT_TENANT_ID)}` +
    `&eventId=${encodeURIComponent(UAT_EVENT_ID)}` +
    '&tenantSlug=mfest-demo&eventSlug=mfest'
  );
}

function log(step, detail) {
  console.log(`[fe-uat-sanity] ${step}${detail ? ` ${detail}` : ''}`);
}

async function passwordToken(username, password) {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: 'ticket-web',
    client_secret: 'dev-web-secret-change-me',
    username,
    password,
  });
  const res = await fetch(
    `${issuer.replace(/\/$/, '')}/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    },
  );
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(`token ${username}: ${res.status}`);
  }
  return json.access_token;
}

async function api(token, method, path, body) {
  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body
        ? {
            'content-type': 'application/json',
            'idempotency-key': crypto.randomUUID(),
          }
        : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
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
  const { chromium } = await import('playwright');
  const shell = findCachedHeadlessShell();
  const opts = shell
    ? { executablePath: shell, headless: true, args: ['--disable-dev-shm-usage'] }
    : { headless: true, args: ['--disable-dev-shm-usage'] };
  return chromium.launch(opts);
}

async function loginKeycloak(page, base, returnTarget) {
  const returnPath = returnTarget.startsWith('http')
    ? new URL(returnTarget).pathname + new URL(returnTarget).search
    : returnTarget;
  await page.goto(`${base}/api/auth/login?return=${encodeURIComponent(returnPath)}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForURL(/openid-connect\/auth|login-actions/, { timeout: 30_000 });
  await page.locator('#username').first().fill(
    process.env.FE_UAT_USER || 'attendee@example.com',
  );
  await page.locator('#password').first().fill(
    process.env.FE_UAT_PASS || 'attendee-demo',
  );
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

async function runApiChecks() {
  const results = [];
  const health = await fetch(`${apiBase}/v1/health`);
  results.push({
    id: 'api_health',
    pass: health.ok,
    status: health.status,
  });

  const catalog = await fetch(`${apiBase}/v1/public/events?limit=5`);
  const catalogJson = await catalog.json().catch(() => ({}));
  const slugs = (catalogJson.items || []).map((r) => r.slug);
  results.push({
    id: 'public_events',
    pass:
      catalog.ok &&
      slugs.includes('mfest') &&
      slugs.includes('studio-night'),
    slugs,
  });

  const detail = await fetch(
    `${apiBase}/v1/public/tenants/mfest-demo/events/mfest`,
  );
  const detailJson = await detail.json().catch(() => ({}));
  const termsVersion = detailJson.terms?.version ?? null;
  results.push({
    id: 'published_terms',
    pass: detail.ok && termsVersion === 'terms-v1',
    termsVersion,
  });

  const staffToken = await passwordToken('staff@example.com', 'staff-demo');
  const tenants = await api(staffToken, 'GET', '/v1/me/tenants');
  const tenantItems = tenants.json?.items || [];
  const adminPerms = ['event.create', 'event.list', 'members.manage', 'tenant.profile'];
  const staffAdmin = tenantItems.some((t) =>
    adminPerms.every((p) => (t.tenantPermissions || []).includes(p)),
  );
  results.push({
    id: 'staff_admin_capability',
    pass: tenants.status === 200 && staffAdmin,
    slugs: tenantItems.map((t) => t.slug),
  });

  const events = await api(staffToken, 'GET', '/v1/me/events');
  results.push({
    id: 'staff_gate_capability',
    pass:
      events.status === 200 &&
      events.json?.staffEligible === true &&
      (events.json?.items || []).some((e) =>
        (e.permissions || []).includes('gate.confirm'),
      ),
  });

  const attendeeToken = await passwordToken(
    'attendee@example.com',
    'attendee-demo',
  );
  const meTicketsBefore = await api(attendeeToken, 'GET', '/v1/me/tickets');
  const countBefore = (meTicketsBefore.json?.tickets || []).length;

  const tenantId =
    process.env.FE_UAT_TENANT_ID ||
    'd9d9f001-0001-4000-8000-000000000001';
  const eventId =
    process.env.FE_UAT_EVENT_ID ||
    'd9d9f001-0002-4000-8000-000000000001';
  const redeemCode =
    process.env.FE_UAT_REDEEM_CODE || 'DEMO-MFEST-008';

  const redeem = await api(
    attendeeToken,
    'POST',
    `/v1/tenants/${tenantId}/events/${eventId}/redemptions`,
    {
      code: redeemCode,
      termsVersion: 'terms-v1',
      termsAccepted: true,
      idempotencyKey: crypto.randomUUID(),
    },
  );
  results.push({
    id: 'redeem_attendee',
    pass: redeem.status === 200 || redeem.status === 201,
    status: redeem.status,
    code: redeem.json?.code || redeem.json?.ticketId,
  });

  const meTickets = await api(attendeeToken, 'GET', '/v1/me/tickets');
  const countAfter = (meTickets.json?.tickets || []).length;
  results.push({
    id: 'me_tickets',
    pass: meTickets.status === 200 && countAfter >= Math.max(1, countBefore),
    count: countAfter,
  });

  return results;
}

async function waitForRedeemTermsConsent(page, base, redeemUrl, options) {
  const {
    viewport,
    screenshotPath,
    globalResolveCode,
    label,
  } = options;
  if (viewport) {
    await page.setViewportSize(viewport);
  }
  await loginKeycloak(page, base, redeemUrl);
  if (
    !page.url().includes('tenantSlug=mfest-demo') ||
    !page.url().includes('eventSlug=mfest')
  ) {
    await page.goto(redeemUrl, { waitUntil: 'domcontentloaded' });
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const stuckLoading = await page
      .getByTestId('route-loading')
      .isVisible()
      .catch(() => false);
    if (!stuckLoading) break;
    await page.waitForTimeout(2000);
    await page.goto(redeemUrl, { waitUntil: 'domcontentloaded' });
  }
  await page
    .locator('.redeem-product-form, .redeem-form')
    .first()
    .waitFor({ state: 'visible', timeout: 120_000 });
  await page
    .waitForResponse(
      (res) =>
        res.url().includes('/api/bff/public/tenants/mfest-demo/events/mfest') &&
        res.status() === 200,
      { timeout: 90_000 },
    )
    .catch(() => {});

  const termsLocator = page.getByTestId('redeem-terms-consent');
  let termsVisible = await termsLocator
    .waitFor({ state: 'visible', timeout: 60_000 })
    .then(() => true)
    .catch(() => false);

  const globalCode = await page
    .getByTestId('redeem-global-code')
    .isVisible()
    .catch(() => false);

  if (!termsVisible && globalCode && globalResolveCode) {
    await page.getByTestId('redeem-global-code').fill(globalResolveCode);
    await page.getByTestId('redeem-global-resolve').click();
    await page
      .waitForResponse(
        (res) =>
          res.url().includes('/api/bff/redeem/resolve') && res.status() < 500,
        { timeout: 60_000 },
      )
      .catch(() => {});
    termsVisible = await termsLocator
      .waitFor({ state: 'visible', timeout: 60_000 })
      .then(() => true)
      .catch(() => false);
  }

  const globalCodeAfter = await page
    .getByTestId('redeem-global-code')
    .isVisible()
    .catch(() => false);

  if (screenshotPath) {
    mkdirSync(dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }

  return {
    label,
    termsVisible,
    globalCodeSurface: globalCodeAfter,
    url: page.url(),
  };
}

async function runUiChecks() {
  const { chromium } = await import('playwright');
  void chromium;
  const browser = await launchBrowser();
  const markers = [];
  try {
    const staffCtx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const staffPage = await staffCtx.newPage();
    process.env.FE_UAT_USER = 'staff@example.com';
    process.env.FE_UAT_PASS = 'staff-demo';
    await loginKeycloak(staffPage, webBase, '/admin');
    await staffPage.goto(`${webBase}/admin`, {
      waitUntil: 'domcontentloaded',
    });
    await staffPage.waitForLoadState('networkidle').catch(() => {});
    const adminDenied = staffPage.url().includes('admin_denied');
    markers.push({
      id: 'admin-workspace',
      pass:
        !adminDenied &&
        (await staffPage
          .getByTestId('admin-workspace')
          .isVisible({ timeout: 45_000 })
          .catch(() => false)),
    });
    await staffPage.goto(`${webBase}/gate`, { waitUntil: 'domcontentloaded' });
    await staffPage
      .locator('main#main')
      .first()
      .waitFor({ state: 'visible', timeout: 30_000 });
    await staffPage.waitForLoadState('networkidle').catch(() => {});
    markers.push({
      id: 'gate-tabs',
      pass: await staffPage
        .getByTestId('gate-tabs')
        .isVisible({ timeout: 45_000 })
        .catch(() => false),
    });
    await staffCtx.close();

    process.env.FE_UAT_USER = 'attendee@example.com';
    process.env.FE_UAT_PASS = 'attendee-demo';
    const redeemUrl = tenantBoundRedeemUrl(webBase);
    const uiCodeDesktop =
      process.env.FE_UAT_UI_REDEEM_CODE_DESKTOP || 'DEMO-MFEST-009';
    const uiCodeMobile =
      process.env.FE_UAT_UI_REDEEM_CODE_MOBILE || 'DEMO-MFEST-010';

    const desktopCtx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const desktopPage = await desktopCtx.newPage();
    const desktopRedeem = await waitForRedeemTermsConsent(
      desktopPage,
      webBase,
      redeemUrl,
      {
        label: 'desktop',
        globalResolveCode: uiCodeDesktop,
        screenshotPath: join(REDEEM_ASSET_DIR, 'redeem-terms-desktop.png'),
      },
    );
    await desktopCtx.close();

    const mobileCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const mobilePage = await mobileCtx.newPage();
    const mobileRedeem = await waitForRedeemTermsConsent(
      mobilePage,
      webBase,
      redeemUrl,
      {
        label: 'mobile',
        globalResolveCode: uiCodeMobile,
        screenshotPath: join(REDEEM_ASSET_DIR, 'redeem-terms-mobile.png'),
      },
    );
    await mobileCtx.close();

    const attCtx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const attPage = await attCtx.newPage();
    await loginKeycloak(attPage, webBase, redeemUrl);
    await attPage.goto(redeemUrl, { waitUntil: 'domcontentloaded' });
    markers.push({
      id: 'redeem-terms-consent',
      pass:
        desktopRedeem.termsVisible &&
        mobileRedeem.termsVisible &&
        !desktopRedeem.globalCodeSurface &&
        !mobileRedeem.globalCodeSurface,
      desktop: desktopRedeem,
      mobile: mobileRedeem,
      assetDir: REDEEM_ASSET_DIR,
    });
    await attPage.goto(`${webBase}/wallet`, { waitUntil: 'domcontentloaded' });
    await attPage.waitForLoadState('networkidle').catch(() => {});
    markers.push({
      id: 'wallet-ticket-grid',
      pass: await attPage
        .getByTestId('wallet-ticket-grid')
        .isVisible({ timeout: 45_000 })
        .catch(() => false),
    });
    await attCtx.close();
  } finally {
    await browser.close();
  }
  return markers;
}

async function main() {
  log('api', apiBase);
  const apiResults = await runApiChecks();
  let uiResults = [];
  if (ui) {
    log('ui', webBase);
    uiResults = await runUiChecks();
  }
  const all = [...apiResults, ...uiResults];
  const failed = all.filter((r) => !r.pass);
  const summary = { ok: failed.length === 0, apiBase, webBase: ui ? webBase : null, results: all };
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) {
    console.error('FE_UAT_STACK_SANITY_FAIL');
    process.exit(1);
  }
  console.log('FE_UAT_STACK_SANITY_PASS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
