#!/usr/bin/env node
/**
 * Headless web UAT via Playwright Chromium.
 * Never opens a visible browser window and never moves the macOS mouse.
 *
 * Usage:
 *   node scripts/web-uat.mjs auth-smoke [baseUrl]
 *   node scripts/web-uat.mjs bff-login [baseUrl] [email] [password]
 *   node scripts/web-uat.mjs auth-logout [baseUrl] [email] [password]
 *   node scripts/web-uat.mjs redeem [baseUrl] [code] [tenantId] [eventId]
 *   node scripts/web-uat.mjs screenshot <url> [out.png]
 *   node scripts/web-uat.mjs goto <url>
 *   node scripts/web-uat.mjs portal-smoke [portalBase] [appBase]
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = process.env.WEB_UAT_OUT_DIR || join(ROOT, 'apps/web/.uat-artifacts');
const DEFAULT_BASE = process.env.WEB_BASE_URL || 'http://127.0.0.1:3000';
const DEFAULT_USER = process.env.WEB_UAT_USER || 'attendee@example.com';
const DEFAULT_PASS = process.env.WEB_UAT_PASS || 'attendee-demo';

/** Prefer chrome-headless-shell (no Chrome.app activation / no mouse steal). */
function findCachedHeadlessShell() {
  if (process.env.WEB_UAT_EXECUTABLE) return process.env.WEB_UAT_EXECUTABLE;
  const cache = join(homedir(), 'Library/Caches/ms-playwright');
  if (!existsSync(cache)) return null;
  const dirs = readdirSync(cache)
    .filter((d) => d.startsWith('chromium_headless_shell-'))
    .sort()
    .reverse();
  for (const dir of dirs) {
    const candidate = join(
      cache,
      dir,
      'chrome-headless-shell-mac-arm64',
      'chrome-headless-shell',
    );
    if (existsSync(candidate)) return candidate;
    const x64 = join(
      cache,
      dir,
      'chrome-headless-shell-mac-x64',
      'chrome-headless-shell',
    );
    if (existsSync(x64)) return x64;
  }
  return null;
}

function die(msg, code = 1) {
  console.error(`web-uat: ${msg}`);
  process.exit(code);
}

function usage() {
  console.log(`web-uat — headless Chromium UAT (Playwright)

Never uses cliclick / AppleScript / ORCA computer mouse clicks on Chrome/Safari.

Commands:
  auth-smoke [baseUrl]                         /auth thin redirect + Home login?return= + anonymous BFF
  bff-login [baseUrl] [email] [password]       Keycloak login → BFF /api/bff/me
  auth-logout [baseUrl] [email] [password]     Login → /me → logout → /auth stub → / (no Invalid redirect uri)
  redeem [baseUrl] [code] [tenantId] [eventId] Login + /redeem DEMO code (D9)
  screenshot <url> [out.png]                   PNG under apps/web/.uat-artifacts/
  goto <url>                                   Print final URL + title
  o13-sales [baseUrl]                          O13 marketing screenshots → docs/reviews/o13-issue-381-uat/
  nav-o02 [baseUrl]                            O02 SiteNav guest chrome + soft-redirect /admin|/gate
  portal-smoke [portalBase] [appBase]          Portal headless + GATE-STAY-APP / dual-run regression

Env:
  WEB_BASE_URL     default http://127.0.0.1:3000 (app. attendee/Gate)
  PORTAL_BASE_URL  default http://127.0.0.1:3013 (apps/portal)
  WEB_UAT_USER     default attendee@example.com
  WEB_UAT_PASS     default attendee-demo
  WEB_UAT_OUT_DIR  screenshot directory
  WEB_UAT_HEADED=1 optional visible browser (only if user asks to watch)
  WEB_UAT_REDEEM_CODE / TENANT_ID / EVENT_ID   redeem defaults (D9 mfest-demo)
  WEB_UAT_HOST     optional Host header (e.g. vemoki.com) for apex routing smoke

Browsers: uses Playwright Chromium if installed, else system Chrome (headless).
Optional: WEB_UAT_CHANNEL=chrome|chromium|msedge
Optional install: pnpm exec playwright install chromium
`);
}

async function launchBrowser() {
  const headed = process.env.WEB_UAT_HEADED === '1';
  const args = headed ? [] : ['--disable-dev-shm-usage'];
  const channel = process.env.WEB_UAT_CHANNEL; // e.g. chrome | chromium | msedge
  const shell = headed ? null : findCachedHeadlessShell();
  // Order: explicit channel → cached headless_shell → Playwright bundle → system Chrome.
  // Avoid headed Chrome.app for default UAT (activates the user's browser).
  const attempts = [];
  if (channel) attempts.push({ channel, headless: !headed, args });
  if (shell) attempts.push({ executablePath: shell, headless: true, args });
  attempts.push({ headless: !headed, args });
  if (!channel) attempts.push({ channel: 'chrome', headless: !headed, args });

  let lastErr;
  for (const opts of attempts) {
    try {
      return await chromium.launch(opts);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error('could not launch Chromium/Chrome');
}

async function withBrowser(fn) {
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();
    return await fn({ browser, context, page });
  } finally {
    await browser.close();
  }
}

async function cmdAuthSmoke(baseUrl) {
  const base = (baseUrl || DEFAULT_BASE).replace(/\/$/, '');
  return withBrowser(async ({ page, context }) => {
    // `/auth` is a thin redirect stub — no product auth UI (AC-S1).
    const authRaw = await context.request.get(`${base}/auth`, {
      maxRedirects: 0,
    });
    const authStatus = authRaw.status();
    const authLocation = authRaw.headers()['location'] ?? '';
    if (authStatus !== 307 && authStatus !== 308) {
      die(`expected /auth HTTP 307/308, got ${authStatus} location=${authLocation}`);
    }
    {
      let locPath = '';
      try {
        locPath = new URL(authLocation, base).pathname;
      } catch {
        die(`invalid /auth Location: ${authLocation}`);
      }
      const okLoc =
        locPath === '/' ||
        locPath.startsWith('/api/auth/login') ||
        authLocation.includes('notice=');
      if (!okLoc) {
        die(`unexpected /auth Location: ${authLocation}`);
      }
    }

    // Follow Location on the same host as `base` (avoid 127.0.0.1→localhost→::1 mismatch).
    const landing = new URL(authLocation, base);
    const landUrl = `${base}${landing.pathname}${landing.search}`;
    const authFollow = await page.goto(landUrl, { waitUntil: 'networkidle' });
    if (!authFollow || !authFollow.ok()) {
      die(`GET /auth landing failed: ${authFollow?.status()} url=${landUrl}`);
    }
    const afterAuth = new URL(page.url());
    if (afterAuth.pathname === '/auth') {
      die(`expected /auth to redirect away, stayed on ${page.url()}`);
    }
    // No product auth shell on the stub target.
    const authShell = await page
      .locator('[data-testid="auth-session"], .auth-session')
      .count();
    if (authShell > 0) {
      die('product auth UI still rendered after /auth redirect');
    }

    // Login CTA lives on Home (and guest chrome): /api/auth/login?return=…
    await page.goto(`${base}/`, { waitUntil: 'networkidle' });
    const signIn = page.locator('a[href^="/api/auth/login?return="]').first();
    await signIn.waitFor({ state: 'visible', timeout: 15_000 });
    const signInHref = (await signIn.getAttribute('href')) || '';
    if (!signInHref.includes('return=')) {
      die(`login CTA missing return=: ${signInHref}`);
    }
    const loginCtaCount = await page
      .locator('a[href^="/api/auth/login?return="]')
      .count();
    if (loginCtaCount < 1) {
      die('no login CTA with /api/auth/login?return= on Home');
    }

    const me = await context.request.get(`${base}/api/bff/me`);
    const meStatus = me.status();
    const meBody = await me.text();
    // 401 = OIDC configured, anonymous. 503 = OIDC unset (fail-closed).
    if (meStatus !== 401 && meStatus !== 503) {
      die(
        `expected anonymous /api/bff/me 401|503, got ${meStatus}: ${meBody.slice(0, 200)}`,
      );
    }

    mkdirSync(OUT_DIR, { recursive: true });
    const shot = join(OUT_DIR, `auth-smoke-${Date.now()}.png`);
    await page.screenshot({ path: shot, fullPage: true });

    console.log(JSON.stringify({
      ok: true,
      base,
      authStatus,
      authLocation,
      afterAuthUrl: page.url(),
      signInHref,
      signInVisible: true,
      loginCtaCount,
      bffMeStatus: meStatus,
      screenshot: shot,
    }, null, 2));
  });
}

/** Keycloak password login; leaves page on app base with session cookies. */
async function loginKeycloak(page, base, user, pass) {
  // AC-S2: start PKCE directly — `/auth` is redirect-only (no product login UI).
  await page.goto(`${base}/api/auth/login?return=/`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForURL(/openid-connect\/auth|login-actions/, { timeout: 30_000 });

  // Pin Keycloak to its advertised frontend host for the whole login so
  // AUTH_SESSION cookies are not dropped when start-dev rewrites 127↔LAN.
  {
    let prefer = process.env.KEYCLOAK_PUBLIC_HOST || '';
    if (!prefer) {
      try {
        const disc = await page.request.get(
          'http://127.0.0.1:8080/realms/ticket/.well-known/openid-configuration',
        );
        if (disc.ok()) {
          const body = await disc.json();
          prefer = new URL(body.issuer).hostname;
        }
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
  }

  const userField =
    page.locator('#username').or(page.getByLabel(/username|email/i)).first();
  const passField =
    page.locator('#password').or(page.getByLabel(/password/i)).first();
  await userField.waitFor({ state: 'visible', timeout: 20_000 });
  await userField.fill(user);
  await passField.fill(pass);
  await page.locator('#kc-login').or(page.getByRole('button', { name: /sign in|log in/i })).first().click();

  try {
    const baseUrl = new URL(base);
    const appHosts = new Set(['127.0.0.1', 'localhost', baseUrl.hostname]);
    await page.waitForURL((url) => {
      return (
        appHosts.has(url.hostname) &&
        url.port === baseUrl.port &&
        !url.pathname.startsWith('/api/auth/login') &&
        url.pathname !== '/auth'
      );
    }, { timeout: 45_000 });
  } catch (err) {
    mkdirSync(OUT_DIR, { recursive: true });
    const failShot = join(OUT_DIR, `bff-login-fail-${Date.now()}.png`);
    await page.screenshot({ path: failShot, fullPage: true });
    die(`login did not return to app (url=${page.url()} shot=${failShot}): ${err}`);
  }

  const landed = new URL(page.url());
  const err = landed.searchParams.get('error');
  if (err) die(`callback returned error=${err} url=${page.url()}`);
}

async function cmdBffLogin(baseUrl, email, password) {
  const base = (baseUrl || DEFAULT_BASE).replace(/\/$/, '');
  const user = email || DEFAULT_USER;
  const pass = password || DEFAULT_PASS;

  return withBrowser(async ({ page }) => {
    await loginKeycloak(page, base, user, pass);

    const meRes = await page.request.get(`${base}/api/bff/me`);
    const meStatus = meRes.status();
    const meBody = await meRes.text();
    // 200 = full BFF. 502 after a session cookie means login succeeded but Nest is down.
    if (meStatus !== 200 && meStatus !== 502) {
      die(`BFF /v1/me failed: HTTP ${meStatus}\n${meBody.slice(0, 500)}`);
    }
    const text = `HTTP ${meStatus}\n${meBody}`;

    mkdirSync(OUT_DIR, { recursive: true });
    const shot = join(OUT_DIR, `bff-login-${Date.now()}.png`);
    await page.screenshot({ path: shot, fullPage: true });

    console.log(JSON.stringify({
      ok: meStatus === 200,
      login: true,
      upstream: meStatus === 200 ? 'ok' : 'unavailable',
      base,
      user,
      finalUrl: page.url(),
      me: text.split('\n').slice(0, 8),
      screenshot: shot,
    }, null, 2));
    if (meStatus !== 200) process.exitCode = 2;
  });
}

/**
 * Login → /api/bff/me → /api/auth/logout → KC post_logout → /auth stub → /
 * without Keycloak «Invalid redirect uri». Also probes anonymous /admin gate.
 */
async function cmdAuthLogout(baseUrl, email, password) {
  const base = (baseUrl || DEFAULT_BASE).replace(/\/$/, '');
  const user = email || DEFAULT_USER;
  const pass = password || DEFAULT_PASS;
  const authUrl = `${base}/auth`;

  return withBrowser(async ({ page, context }) => {
    await loginKeycloak(page, base, user, pass);

    const meRes = await page.request.get(`${base}/api/bff/me`);
    const meStatus = meRes.status();
    if (meStatus !== 200) {
      die(`BFF /me before logout: HTTP ${meStatus}`);
    }

    let sawAuthStub = false;
    page.on('response', (res) => {
      try {
        const u = new URL(res.url());
        if (
          u.origin === new URL(base).origin &&
          u.pathname === '/auth' &&
          (res.status() === 307 || res.status() === 308 || res.status() === 200)
        ) {
          sawAuthStub = true;
        }
      } catch {
        /* ignore */
      }
    });

    await page.goto(`${base}/api/auth/logout`, { waitUntil: 'domcontentloaded' });

    // Keycloak may show confirm («Do you want to log out?») when no id_token_hint.
    const baseHost = new URL(base).hostname;
    const backOnApp = (url) =>
      url.hostname === baseHost &&
      (url.pathname === '/' || url.pathname === '/auth');

    try {
      await page.waitForURL(backOnApp, { timeout: 8_000 });
    } catch {
      const confirm = page
        .locator('#kc-logout')
        .or(page.getByRole('button', { name: /^Logout$/i }))
        .or(page.getByRole('button', { name: /log out|đăng xuất/i }))
        .first();
      if (await confirm.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await confirm.click();
      }
      await page.waitForURL(backOnApp, { timeout: 30_000 });
    }

    // Thin stub: if we briefly landed on /auth, follow should leave it.
    if (new URL(page.url()).pathname === '/auth') {
      await page.waitForURL(
        (url) => url.hostname === baseHost && url.pathname !== '/auth',
        { timeout: 10_000 },
      );
    }

    const finalUrl = page.url();
    const html = await page.content();
    const invalidRedirect =
      /invalid\s+redirect\s+uri/i.test(html) ||
      /Invalid parameter:\s*redirect_uri/i.test(html);
    const finalPath = new URL(finalUrl).pathname;
    const landedAfterLogout =
      new URL(finalUrl).origin === new URL(base).origin &&
      finalPath !== '/auth' &&
      (finalPath === '/' || sawAuthStub);

    mkdirSync(OUT_DIR, { recursive: true });
    const shot = join(OUT_DIR, `auth-logout-${Date.now()}.png`);
    await page.screenshot({ path: shot, fullPage: true });

    // After logout, session gone → /admin soft-redirects to /auth?next=/admin
    const adminRes = await context.request.get(`${base}/admin`, {
      maxRedirects: 0,
    });
    const adminStatus = adminRes.status();
    const adminLoc = adminRes.headers()['location'] ?? '';

    const ok =
      landedAfterLogout &&
      !invalidRedirect &&
      (adminStatus === 307 || adminStatus === 302) &&
      /\/auth/.test(adminLoc);

    console.log(JSON.stringify({
      ok,
      base,
      user,
      meStatus,
      finalUrl,
      postLogoutViaAuth: sawAuthStub || finalUrl.startsWith(authUrl),
      expectedPostLogoutChain: `${authUrl} → /`,
      invalidRedirect,
      adminGate: { status: adminStatus, location: adminLoc },
      screenshot: shot,
    }, null, 2));

    if (!ok) {
      die(
        `auth-logout failed (finalUrl=${finalUrl} sawAuthStub=${sawAuthStub} invalidRedirect=${invalidRedirect} admin=${adminStatus} ${adminLoc})`,
      );
    }
  });
}

/** D9 demo: attendee login → /redeem with DEMO-MFEST-* → ticket issued. */
async function cmdRedeem(baseUrl, codeArg, tenantArg, eventArg) {
  const base = (baseUrl || DEFAULT_BASE).replace(/\/$/, '');
  const user = DEFAULT_USER;
  const pass = DEFAULT_PASS;
  const code =
    codeArg ||
    process.env.WEB_UAT_REDEEM_CODE ||
    'DEMO-MFEST-006';
  const tenantId =
    tenantArg ||
    process.env.WEB_UAT_TENANT_ID ||
    'd9d9f001-0001-4000-8000-000000000001';
  const eventId =
    eventArg ||
    process.env.WEB_UAT_EVENT_ID ||
    'd9d9f001-0002-4000-8000-000000000001';

  return withBrowser(async ({ page }) => {
    await loginKeycloak(page, base, user, pass);

    const meRes = await page.request.get(`${base}/api/bff/me`);
    if (meRes.status() !== 200) {
      die(`BFF /me before redeem: HTTP ${meRes.status()}`);
    }

    const redeemUrl =
      `${base}/redeem?tenantId=${encodeURIComponent(tenantId)}` +
      `&eventId=${encodeURIComponent(eventId)}` +
      `&tenantSlug=mfest-demo&eventSlug=mfest`;
    await page.goto(redeemUrl, { waitUntil: 'networkidle' });

    await page.locator('input[name="code"]').fill(code);
    await page.getByRole('button', { name: /Đổi mã \(API thật\)/i }).click();

    // Success surface: ticket section or decision UX
    const ticketSection = page.locator('.redeem-ticket, [data-testid="redeem-ticket"]').first();
    const successHint = page.getByText(/đã cấp|ticketId|ACTIVE|Vé/i).first();
    try {
      await Promise.race([
        ticketSection.waitFor({ state: 'visible', timeout: 45_000 }),
        successHint.waitFor({ state: 'visible', timeout: 45_000 }),
      ]);
    } catch (err) {
      mkdirSync(OUT_DIR, { recursive: true });
      const failShot = join(OUT_DIR, `d9-e2e-redeem-fail-${Date.now()}.png`);
      await page.screenshot({ path: failShot, fullPage: true });
      die(`redeem did not show success (url=${page.url()} shot=${failShot}): ${err}`);
    }

    mkdirSync(OUT_DIR, { recursive: true });
    const shot = join(OUT_DIR, `d9-e2e-redeem-${Date.now()}.png`);
    await page.screenshot({ path: shot, fullPage: true });

    const ticketsRes = await page.request.get(
      `${base}/api/bff/tickets?tenantId=${encodeURIComponent(tenantId)}`,
    );
    const ticketsStatus = ticketsRes.status();
    const ticketsBody = await ticketsRes.text();
    let ticketCount = 0;
    try {
      const json = JSON.parse(ticketsBody);
      ticketCount = Array.isArray(json.tickets) ? json.tickets.length : 0;
    } catch {
      /* leave 0 */
    }

    const ok = ticketsStatus === 200 && ticketCount >= 1;
    console.log(JSON.stringify({
      ok,
      login: true,
      base,
      user,
      code,
      tenantId,
      eventId,
      ticketsStatus,
      ticketCount,
      screenshot: shot,
      redeemUrl,
    }, null, 2));
    if (!ok) process.exitCode = 2;
  });
}

async function cmdScreenshot(url, out) {
  if (!url) die('usage: web-uat screenshot <url> [out.png]');
  return withBrowser(async ({ page }) => {
    const host = process.env.WEB_UAT_HOST?.trim();
    if (host) {
      await page.setExtraHTTPHeaders({ host });
    }
    const res = await page.goto(url, { waitUntil: 'networkidle' });
    mkdirSync(OUT_DIR, { recursive: true });
    const shot = resolve(out || join(OUT_DIR, `shot-${Date.now()}.png`));
    mkdirSync(dirname(shot), { recursive: true });
    await page.screenshot({ path: shot, fullPage: true });
    console.log(JSON.stringify({
      ok: true,
      status: res?.status() ?? null,
      url: page.url(),
      title: await page.title(),
      screenshot: shot,
      host: host || null,
    }, null, 2));
  });
}

/** O13 sales page evidence — tracked under docs/reviews/o13-issue-381-uat/ */
async function cmdO13Sales(baseUrl) {
  const base = (baseUrl || DEFAULT_BASE).replace(/\/$/, '');
  const outDir = join(ROOT, 'docs/reviews/o13-issue-381-uat');
  mkdirSync(outDir, { recursive: true });
  const host = process.env.WEB_UAT_HOST?.trim() || null;

  const shots = [
    { path: '/marketing', file: 'o13-sales-vi.png', label: 'sales-vi' },
    { path: '/marketing/en', file: 'o13-sales-en.png', label: 'sales-en' },
    { path: '/marketing/privacy', file: 'o13-privacy.png', label: 'privacy' },
    { path: '/marketing/support', file: 'o13-support.png', label: 'support' },
  ];

  return withBrowser(async ({ page }) => {
    if (host) {
      await page.setExtraHTTPHeaders({ host });
    }
    const results = [];
    for (const s of shots) {
      const url = `${base}${s.path}`;
      const res = await page.goto(url, { waitUntil: 'networkidle' });
      const status = res?.status() ?? null;
      const out = join(outDir, s.file);
      await page.screenshot({ path: out, fullPage: true });
      results.push({
        label: s.label,
        url,
        status,
        screenshot: out,
        ok: status === 200,
      });
      if (status !== 200) {
        die(`o13-sales ${s.label} HTTP ${status} at ${url}`);
      }
    }
    const evidence = join(outDir, 'EVIDENCE.md');
    const tip = process.env.WEB_UAT_SHA?.trim() || 'local';
    writeFileSync(
      evidence,
      [
        '# O13 Issue #381 — headless UAT evidence',
        '',
        `- Issue: https://github.com/hangndat/ticket-solution/issues/381`,
        `- Command: \`scripts/web-uat.sh o13-sales ${base}\``,
        `- Base URL: \`${base}\``,
        `- Host header: \`${host || '(none — /marketing paths)'}\``,
        `- SHA: \`${tip}\``,
        `- Captured: ${new Date().toISOString()}`,
        '',
        '| Shot | Path | File |',
        '| ---- | ---- | ---- |',
        ...shots.map(
          (s) => `| ${s.label} | \`${s.path}\` | \`${s.file}\` |`,
        ),
        '',
      ].join('\n'),
    );
    console.log(JSON.stringify({ ok: true, host, base, evidence, results }, null, 2));
  });
}

async function cmdGoto(url) {
  if (!url) die('usage: web-uat goto <url>');
  return withBrowser(async ({ page }) => {
    const res = await page.goto(url, { waitUntil: 'networkidle' });
    console.log(JSON.stringify({
      ok: true,
      status: res?.status() ?? null,
      url: page.url(),
      title: await page.title(),
    }, null, 2));
  });
}

/**
 * Issue #439 / T-UAT-PORTAL — portal headless smoke + attendee/Gate regression.
 * No mock auth. OIDC unset → fail-closed 503 on portal login (accepted).
 * Checklist maps to docs/ops/PORTAL-LOCAL-CUTOVER-PREP.md §4.3 L3–L6 (+ L1 fail-closed).
 */
async function cmdPortalSmoke(portalBaseUrl, appBaseUrl) {
  const portal = (
    portalBaseUrl ||
    process.env.PORTAL_BASE_URL ||
    'http://127.0.0.1:3013'
  ).replace(/\/$/, '');
  const app = (
    appBaseUrl ||
    process.env.WEB_BASE_URL ||
    DEFAULT_BASE
  ).replace(/\/$/, '');
  const outDir =
    process.env.WEB_UAT_OUT_DIR ||
    join(ROOT, 'apps/portal/.uat-artifacts/issue-439');
  mkdirSync(outDir, { recursive: true });
  const demoTenant = 'd9d9f001-0001-4000-8000-000000000001';

  return withBrowser(async ({ page, context }) => {
    // --- Portal: shell loads (no mock session) ---
    const homeRes = await page.goto(`${portal}/`, { waitUntil: 'networkidle' });
    const homeStatus = homeRes?.status() ?? null;
    if (homeStatus !== 200) {
      die(`portal home HTTP ${homeStatus}`);
    }
    const portalHomeShot = join(outDir, 'portal-home.png');
    await page.screenshot({ path: portalHomeShot, fullPage: true });

    const authPageRes = await page.goto(`${portal}/auth`, {
      waitUntil: 'networkidle',
    });
    const authPageStatus = authPageRes?.status() ?? null;
    if (authPageStatus !== 200) {
      die(`portal /auth HTTP ${authPageStatus}`);
    }
    const portalAuthShot = join(outDir, 'portal-auth.png');
    await page.screenshot({ path: portalAuthShot, fullPage: true });

    // L1 fail-closed: login without full OIDC → 503 (or 302 to IdP when configured)
    const loginRes = await context.request.get(
      `${portal}/api/auth/login?return=/`,
      { maxRedirects: 0 },
    );
    const loginStatus = loginRes.status();
    const loginLoc = loginRes.headers()['location'] ?? '';
    const loginBody = await loginRes.text();
    let loginMode = 'unknown';
    if (loginStatus === 503) {
      loginMode = 'oidc_fail_closed';
      if (!/OIDC_MISCONFIGURED|OIDC/i.test(loginBody)) {
        die(`portal login 503 body missing OIDC hint: ${loginBody.slice(0, 200)}`);
      }
    } else if (loginStatus === 302 || loginStatus === 307) {
      loginMode = 'oidc_authorize_redirect';
      if (!/openid-connect\/auth|protocol\/openid-connect/i.test(loginLoc)) {
        die(`portal login redirect not to IdP: ${loginLoc}`);
      }
    } else {
      die(`portal /api/auth/login unexpected HTTP ${loginStatus}`);
    }

    // Platform login same fail-closed / IdP contract
    const platLogin = await context.request.get(
      `${portal}/api/auth/platform/login?return=/platform`,
      { maxRedirects: 0 },
    );
    const platStatus = platLogin.status();
    if (platStatus !== 503 && platStatus !== 302 && platStatus !== 307) {
      die(`platform login unexpected HTTP ${platStatus}`);
    }

    // L6 open-redirect reject: evil return must not become Location
    const evilLogin = await context.request.get(
      `${portal}/api/auth/login?return=${encodeURIComponent('https://evil.example')}`,
      { maxRedirects: 0 },
    );
    const evilStatus = evilLogin.status();
    const evilLoc = evilLogin.headers()['location'] ?? '';
    if (/evil\.example/i.test(evilLoc)) {
      die(`open redirect leaked evil Location: ${evilLoc}`);
    }
    if (evilStatus !== 503 && evilStatus !== 302 && evilStatus !== 307) {
      die(`evil-return login unexpected HTTP ${evilStatus}`);
    }

    // L5 CSRF: Origin from app. mutate portal BFF → 403
    const csrfRes = await context.request.fetch(
      `${portal}/api/bff/tenants/${demoTenant}/branding`,
      {
        method: 'PUT',
        headers: {
          Origin: app,
          'Content-Type': 'application/json',
        },
        data: JSON.stringify({ expectedVersion: 1 }),
        maxRedirects: 0,
      },
    );
    const csrfStatus = csrfRes.status();
    const csrfBody = await csrfRes.text();
    // 403 = Origin mismatch (WEB_PUBLIC_ORIGIN set). 503 = ORIGIN_NOT_CONFIGURED (fail-closed).
    if (csrfStatus !== 403 && csrfStatus !== 503) {
      die(
        `expected CSRF/origin 403|503 from app Origin, got ${csrfStatus}: ${csrfBody.slice(0, 200)}`,
      );
    }
    if (!/CSRF_ORIGIN|ORIGIN_NOT_CONFIGURED|Origin/i.test(csrfBody)) {
      die(`CSRF body missing origin code: ${csrfBody.slice(0, 200)}`);
    }

    // L3/L4 GATE-STAY-APP + legacy admin: stay on app host (soft /auth), never portal
    const softPaths = ['/gate', '/admin'];
    const softResults = [];
    for (const path of softPaths) {
      const res = await context.request.get(`${app}${path}`, {
        maxRedirects: 0,
      });
      const status = res.status();
      const location = res.headers()['location'] ?? '';
      let locUrl;
      try {
        locUrl = new URL(location, app);
      } catch {
        die(`${path} invalid Location: ${location}`);
      }
      const sameHost = locUrl.origin === new URL(app).origin;
      const softAuth =
        (status === 307 || status === 302) &&
        locUrl.pathname === '/auth' &&
        (locUrl.searchParams.get('next') === path ||
          locUrl.searchParams.get('return') === path);
      const leakedPortal =
        /3013|portal\./i.test(location) ||
        locUrl.origin === new URL(portal).origin;
      if (!sameHost || !softAuth || leakedPortal) {
        die(
          `GATE-STAY-APP fail ${path}: status=${status} loc=${location} sameHost=${sameHost} softAuth=${softAuth} leakedPortal=${leakedPortal}`,
        );
      }
      softResults.push({ path, status, location });
    }

    // Attendee regression screenshots on app.
    await page.goto(`${app}/`, { waitUntil: 'networkidle' });
    const appHomeShot = join(outDir, 'app-home.png');
    await page.screenshot({ path: appHomeShot, fullPage: true });

    await page.goto(`${app}/redeem`, { waitUntil: 'networkidle' });
    const appRedeemShot = join(outDir, 'app-redeem.png');
    await page.screenshot({ path: appRedeemShot, fullPage: true });

    // Follow /gate soft-redirect for visual evidence.
    // Chain when OIDC unset: /gate → /auth?next=/gate → /?notice=auth_unavailable
    // (127.0.0.1 vs localhost are both loopback product — reject only portal origin.)
    await page.goto(`${app}/gate`, { waitUntil: 'networkidle' });
    const afterGate = new URL(page.url());
    const portalOrigin = new URL(portal).origin;
    const appPort = new URL(app).port;
    const loopback =
      afterGate.hostname === '127.0.0.1' || afterGate.hostname === 'localhost';
    if (afterGate.origin === portalOrigin) {
      die(`followed /gate landed on portal: ${page.url()}`);
    }
    if (!loopback || (appPort && afterGate.port && afterGate.port !== appPort)) {
      die(`followed /gate left app loopback/port: ${page.url()}`);
    }
    const gateLandingOk =
      afterGate.pathname === '/auth' ||
      afterGate.pathname === '/gate' ||
      (afterGate.pathname === '/' &&
        afterGate.searchParams.get('notice') === 'auth_unavailable');
    if (!gateLandingOk) {
      die(`unexpected /gate landing path: ${page.url()}`);
    }
    const appGateShot = join(outDir, 'app-gate-auth.png');
    await page.screenshot({ path: appGateShot, fullPage: true });

    const result = {
      ok: true,
      portal,
      app,
      loginMode,
      loginStatus,
      platformLoginStatus: platStatus,
      evilReturnStatus: evilStatus,
      csrfStatus,
      softRedirects: softResults,
      screenshots: {
        portalHome: portalHomeShot,
        portalAuth: portalAuthShot,
        appHome: appHomeShot,
        appRedeem: appRedeemShot,
        appGateAuth: appGateShot,
      },
    };
    console.log(JSON.stringify(result, null, 2));
  });
}

const [cmd, ...args] = process.argv.slice(2);
switch (cmd) {
  case 'auth-smoke':
    await cmdAuthSmoke(args[0]);
    break;
  case 'bff-login':
    await cmdBffLogin(args[0], args[1], args[2]);
    break;
  case 'auth-logout':
    await cmdAuthLogout(args[0], args[1], args[2]);
    break;
  case 'redeem':
    await cmdRedeem(args[0], args[1], args[2], args[3]);
    break;
  case 'screenshot':
    await cmdScreenshot(args[0], args[1]);
    break;
  case 'o13-sales':
    await cmdO13Sales(args[0]);
    break;
  case 'portal-smoke':
    await cmdPortalSmoke(args[0], args[1]);
    break;
  case 'nav-o02': {
    const { spawnSync } = await import('node:child_process');
    const script = join(ROOT, 'apps/web/tests/nav-o02-uat.mjs');
    const r = spawnSync(process.execPath, [script, args[0] || DEFAULT_BASE].filter(Boolean), {
      stdio: 'inherit',
      env: process.env,
    });
    process.exit(r.status ?? 1);
    break;
  }
  case 'goto':
    await cmdGoto(args[0]);
    break;
  case '-h':
  case '--help':
  case 'help':
  case undefined:
    usage();
    break;
  default:
    die(`unknown command '${cmd}' (try --help)`);
}
