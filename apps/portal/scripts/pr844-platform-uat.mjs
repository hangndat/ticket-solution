#!/usr/bin/env node
/**
 * PR #844 — portal platform operator mutate UAT (local stack).
 * Requires: API :3001, portal :3013, Keycloak :8080, D9 bootstrap + platform operator bootstrap.
 *
 *   node apps/portal/scripts/pr844-platform-uat.mjs
 */
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import axe from 'axe-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = join(ROOT, 'docs/reviews/assets/PR844');
const PORTAL = (process.env.PORTAL_UAT_BASE || 'http://127.0.0.1:3013').replace(
  /\/$/,
  '',
);
const issuer = (
  process.env.OIDC_ISSUER || 'http://127.0.0.1:8080/realms/ticket'
).replace(/\/$/, '');
const clientId = 'ticket-platform-web';
const redirectUri =
  process.env.PLATFORM_OIDC_REDIRECT_URI ||
  `${PORTAL}/api/auth/platform/callback`;
const username = process.env.PLATFORM_UAT_USER || 'staff@example.com';
const password = process.env.PLATFORM_UAT_PASS || 'staff-demo';

function die(msg) {
  console.error(`pr844-uat: ${msg}`);
  process.exit(1);
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function totpFromSessionSecret(sessionSecret, step = 30, digits = 6) {
  const key = Buffer.from(sessionSecret, 'utf8');
  const counter = Math.floor(Date.now() / 1000 / step);
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

function extractForm(html) {
  const actionMatch = html.match(/<form[^>]*action="([^"]+)"/i);
  if (!actionMatch) return null;
  const action = actionMatch[1].replace(/&amp;/g, '&');
  const inputs = {};
  for (const tag of html.match(/<input[^>]*>/gi) || []) {
    const name = (tag.match(/name="([^"]+)"/i) || [])[1];
    if (!name) continue;
    inputs[name] = (tag.match(/value="([^"]*)"/i) || [])[1] || '';
  }
  return { action, inputs };
}

async function platformLoginCookies() {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash('sha256').update(verifier).digest());
  const authUrl =
    `${issuer}/protocol/openid-connect/auth?` +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid',
      state: b64url(randomBytes(16)),
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }).toString();

  const jar = new Map();
  const storeCookies = (res) => {
    for (const c of res.headers.getSetCookie?.() || []) {
      const [nv] = c.split(';');
      const eq = nv.indexOf('=');
      if (eq > 0) jar.set(nv.slice(0, eq).trim(), nv.slice(eq + 1));
    }
  };
  const cookieHeader = () =>
    [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

  const follow = async (startRes) => {
    let res = startRes;
    storeCookies(res);
    while (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) break;
      if (loc.includes('code=')) return { loc, html: '' };
      res = await fetch(new URL(loc, issuer).toString(), {
        redirect: 'manual',
        headers: { Cookie: cookieHeader() },
      });
      storeCookies(res);
    }
    const html = res.status === 200 ? await res.text() : '';
    return { loc: res.headers.get('location'), html };
  };

  let { html, loc } = await follow(
    await fetch(authUrl, { redirect: 'manual' }),
  );
  let form = extractForm(html);
  if (!form) die('Keycloak login form missing');
  form.inputs.username = username;
  form.inputs.password = password;
  ({ html, loc } = await follow(
    await fetch(form.action, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookieHeader(),
      },
      body: new URLSearchParams(form.inputs),
    }),
  ));

  if (html && /totpSecret/i.test(html)) {
    form = extractForm(html);
    const sessionSecret = form?.inputs?.totpSecret;
    if (!sessionSecret) die('totpSecret missing');
    form.inputs.totp = totpFromSessionSecret(sessionSecret);
    form.inputs.totpSecret = sessionSecret;
    form.inputs.userLabel = 'uat';
    ({ html, loc } = await follow(
      await fetch(form.action, {
        method: 'POST',
        redirect: 'manual',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: cookieHeader(),
        },
        body: new URLSearchParams(form.inputs),
      }),
    ));
  }

  if (html && /name="otp"/i.test(html)) {
    form = extractForm(html);
    if (!form) die('otp form missing');
    const secretField = form.inputs.totpSecret || '';
    if (secretField) form.inputs.otp = totpFromSessionSecret(secretField);
    ({ html, loc } = await follow(
      await fetch(form.action, {
        method: 'POST',
        redirect: 'manual',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: cookieHeader(),
        },
        body: new URLSearchParams(form.inputs),
      }),
    ));
  }

  if (!loc || !loc.includes('code=')) {
    die(`no auth code (html snippet: ${(html || '').slice(0, 120)})`);
  }
  const code = new URL(loc, PORTAL).searchParams.get('code');
  const cbRes = await fetch(loc, {
    redirect: 'manual',
    headers: { Cookie: cookieHeader() },
  });
  storeCookies(cbRes);
  let next = cbRes;
  while (next.status >= 300 && next.status < 400) {
    const l = next.headers.get('location');
    if (!l) break;
    next = await fetch(new URL(l, PORTAL).toString(), {
      redirect: 'manual',
      headers: { Cookie: cookieHeader() },
    });
    storeCookies(next);
  }
  const portalCookies = [...jar.entries()].map(([name, value]) => ({
    name,
    value,
    url: PORTAL,
  }));
  return { portalCookies, code };
}

async function loadPlaywright() {
  const { chromium } = await import('playwright');
  const exe =
    process.env.WEB_UAT_EXECUTABLE ||
    chromium.executablePath?.() ||
    undefined;
  return chromium.launch({ headless: true, executablePath: exe });
}

async function runAxe(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const results = await page.evaluate(async () => {
    // @ts-expect-error injected
    return await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    });
  });
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  return serious;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const sha = (
    await import('node:child_process')
  ).execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();

  const { portalCookies } = await platformLoginCookies();
  const browser = await loadPlaywright();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  });
  await context.addCookies(portalCookies);
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

  await capture('01-platform-tenants', async () => {
    await page.goto(`${PORTAL}/platform`, { waitUntil: 'networkidle' });
    await page.getByRole('tab', { name: 'Tenants' }).click();
  });
  await capture('02-platform-provision', async () => {
    await page.getByRole('tab', { name: 'Provision' }).click();
  });
  await capture('03-platform-manage', async () => {
    await page.getByRole('tab', { name: 'Manage' }).click();
  });
  await capture('04-platform-grant-create', async () => {
    await page.getByRole('tab', { name: 'Grant create' }).click();
  });

  const axeViolations = await runAxe(page);
  if (axeViolations.length) {
    writeFileSync(
      join(OUT, 'axe-violations.json'),
      JSON.stringify(axeViolations, null, 2),
    );
    die(`axe serious/critical: ${axeViolations.length}`);
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
