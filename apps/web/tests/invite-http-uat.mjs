#!/usr/bin/env node
/**
 * Headless invite HTTP/UI UAT (Issue #271 / O14).
 * Playwright Chromium only — no macOS mouse / cliclick.
 *
 * Usage:
 *   node apps/web/tests/invite-http-uat.mjs [baseUrl] [token]
 *
 * Env:
 *   WEB_BASE_URL, WEB_UAT_USER, WEB_UAT_PASS, WEB_UAT_INVITE_TOKEN
 *   WEB_UAT_INVITE_SKIP_LOGIN=1  — page + CSRF probes only
 *   WEB_UAT_OUT_DIR
 *
 * Never logs invite token / PII in stdout JSON.
 */
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT_DIR =
  process.env.WEB_UAT_OUT_DIR || join(ROOT, 'apps/web/.uat-artifacts');
const DEFAULT_BASE = process.env.WEB_BASE_URL || 'http://127.0.0.1:3271';
const DEFAULT_USER = process.env.WEB_UAT_USER || 'attendee@example.com';
const DEFAULT_PASS = process.env.WEB_UAT_PASS || 'attendee-demo';

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

function die(msg, code = 1) {
  console.error(`invite-http-uat: ${msg}`);
  process.exit(code);
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
  throw lastErr ?? new Error('could not launch Chromium');
}

async function loginKeycloak(page, base, user, pass) {
  await page.goto(`${base}/auth`, { waitUntil: 'networkidle' });
  // Product copy is VI — link text "Đăng nhập" → /api/auth/login (not English Keycloak label).
  // Prefer exact OIDC start href — nav also has text "Đăng nhập" → /auth.
  const loginLink = page.locator('a[href="/api/auth/login"]');
  await Promise.all([
    page.waitForURL(/openid-connect\/auth|login-actions/, { timeout: 30_000 }),
    loginLink.click(),
  ]);
  // Pin Keycloak to advertised frontend host so AUTH_SESSION cookies survive 127↔LAN rewrite.
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
  await Promise.all([
    page.waitForURL((url) => {
      const baseUrl = new URL(base);
      return (
        (url.hostname === '127.0.0.1' ||
          url.hostname === 'localhost' ||
          url.hostname === baseUrl.hostname) &&
        url.port === baseUrl.port &&
        !url.pathname.startsWith('/api/auth/login')
      );
    }, { timeout: 45_000 }),
    page
      .locator('#kc-login')
      .or(page.getByRole('button', { name: /sign in|log in/i }))
      .first()
      .click(),
  ]);
}

async function main() {
  const base = (process.argv[2] || DEFAULT_BASE).replace(/\/$/, '');
  let token =
    process.env.WEB_UAT_INVITE_TOKEN ||
    'invalid-invite-token-fixture';
  if (process.env.WEB_UAT_INVITE_TOKEN_FILE) {
    const { readFileSync } = await import('node:fs');
    token = readFileSync(process.env.WEB_UAT_INVITE_TOKEN_FILE, 'utf8').trim();
  }
  // Do not accept token from argv (coordinator: no token on CLI).
  const user = DEFAULT_USER;
  const pass = DEFAULT_PASS;
  const skipLogin = process.env.WEB_UAT_INVITE_SKIP_LOGIN === '1';
  const forceMockInvalid = process.env.WEB_UAT_INVITE_MOCK_INVALID === '1';

  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: true,
    });
    // Keycloak start-dev may rewrite 127.0.0.1 → LAN IP mid-login and drop cookies.
    await context.route(/192\.168\.\d+\.\d+:8080/, async (route) => {
      const url = route.request().url().replace(
        /http:\/\/192\.168\.\d+\.\d+:8080/,
        'http://127.0.0.1:8080',
      );
      await route.continue({ url });
    });
    const page = await context.newPage();

    // Evil Origin — fail-closed (Node fetch; do not log token).
    const evil = await fetch(`${base}/api/bff/me/membership-invites/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://evil.example',
      },
      body: JSON.stringify({
        token: 'redacted',
        idempotencyKey: '11111111-1111-4111-8111-111111111111',
      }),
    });
    const evilBody = await evil.json().catch(() => ({}));

    const missingOrigin = await fetch(
      `${base}/api/bff/me/membership-invites/accept`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'redacted',
          idempotencyKey: '11111111-1111-4111-8111-111111111111',
        }),
      },
    );
    const missingBody = await missingOrigin.json().catch(() => ({}));

    await page.goto(`${base}/invite#token=${encodeURIComponent(token)}`, {
      waitUntil: 'networkidle',
    });
    await page.waitForTimeout(500);
    const afterPark = page.url();
    const tokenLeakedInUrl =
      /[?&#]token=/i.test(afterPark) || afterPark.includes(token);

    await page
      .getByRole('button', { name: /Nhận lời mời|Nhận invite/i })
      .waitFor({ state: 'visible', timeout: 15_000 });

    let acceptUx = null;
    let mockedInvalidVi = null;
    if (!skipLogin) {
      try {
        await loginKeycloak(page, base, user, pass);
        await page.goto(`${base}/invite#token=${encodeURIComponent(token)}`, {
          waitUntil: 'networkidle',
        });
        await page.waitForTimeout(1000);
        await page.getByTestId('invite-accept-submit').click();
        const result = page.getByTestId('invite-accept-result');
        await result.waitFor({ state: 'visible', timeout: 30_000 });
        acceptUx = (await result.innerText()).slice(0, 400);

        // Optional: prove VI invalid/expired copy via BFF fulfill (not SQL bypass).
        if (forceMockInvalid || !/Đã nhận membership/i.test(acceptUx)) {
          await page.route(
            '**/api/bff/me/membership-invites/accept',
            async (route) => {
              await route.fulfill({
                status: 409,
                contentType: 'application/json',
                body: JSON.stringify({
                  code: 'INVITE_INVALID_OR_EXPIRED',
                  message: 'Invite invalid or expired',
                }),
              });
            },
          );
          await page.getByTestId('invite-accept-submit').click();
          await result.waitFor({ state: 'visible', timeout: 15_000 });
          mockedInvalidVi = (await result.innerText()).slice(0, 400);
          await page.unroute('**/api/bff/me/membership-invites/accept');
        }
      } catch (err) {
        acceptUx = `login_or_accept_gap:${String(err).slice(0, 160)}`;
      }
    }

    mkdirSync(OUT_DIR, { recursive: true });
    const shot = join(OUT_DIR, `invite-http-${Date.now()}.png`);
    await page.screenshot({ path: shot, fullPage: true });

    const csrfOk =
      evil.status === 403 &&
      evilBody.code === 'CSRF_ORIGIN_MISMATCH' &&
      missingOrigin.status === 403 &&
      missingBody.code === 'CSRF_ORIGIN_REQUIRED';

    const acceptOk = Boolean(acceptUx && /Đã nhận membership/i.test(acceptUx));
    const viFailClosed =
      acceptOk ||
      !acceptUx ||
      /không hợp lệ|hết hạn|đã được dùng|Cần đăng nhập|từ chối|chưa rõ|OIDC|gap|email|platform chưa biết/i.test(
        acceptUx,
      );
    const mockedViOk =
      !mockedInvalidVi ||
      /không hợp lệ|hết hạn/i.test(mockedInvalidVi);
    const mockNoFalseSuccess =
      !mockedInvalidVi || !/Đã nhận membership/i.test(mockedInvalidVi);

    const ok =
      csrfOk &&
      !tokenLeakedInUrl &&
      viFailClosed &&
      mockedViOk &&
      mockNoFalseSuccess &&
      (acceptOk || Boolean(mockedInvalidVi));

    console.log(
      JSON.stringify(
        {
          ok,
          base,
          user: skipLogin ? null : user,
          tokenLeakedInUrl,
          csrf: {
            evilStatus: evil.status,
            evilCode: evilBody.code ?? null,
            missingStatus: missingOrigin.status,
            missingCode: missingBody.code ?? null,
          },
          acceptUxPreview: acceptUx
            ? acceptUx.split(token).join('[redacted]')
            : null,
          mockedInvalidViPreview: mockedInvalidVi
            ? mockedInvalidVi.split(token).join('[redacted]')
            : null,
          screenshot: shot,
          afterParkUrl: afterPark.split(token).join('[redacted]'),
          acceptOk,
          gaps: acceptOk
            ? []
            : [
                'Live Nest accept did not return membership success; see acceptUxPreview / mockedInvalidViPreview.',
              ],
        },
        null,
        2,
      ),
    );
    if (!ok) process.exitCode = 2;
  } finally {
    await browser.close();
  }
}

main().catch((err) => die(String(err)));
