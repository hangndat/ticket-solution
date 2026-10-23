#!/usr/bin/env node
/**
 * Issue #843 — portal C-N templates/reminders UAT (headless Playwright).
 * Preconditions: docker postgres/redis/keycloak, fe-uat-stack bootstrap, API :3001, portal :3013.
 */
import { createHmac } from 'node:crypto';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const axeSource = readFileSync(
  resolve(ROOT, 'apps/portal/node_modules/axe-core/axe.min.js'),
  'utf8',
);
const PORTAL = (process.env.PORTAL_BASE_URL || 'http://127.0.0.1:3013').replace(
  /\/$/,
  '',
);
const TENANT =
  process.env.FE_UAT_TENANT_ID || 'd9d9f001-0001-4000-8000-000000000001';
const EVENT =
  process.env.FE_UAT_EVENT_ID || 'd9d9f001-0002-4000-8000-000000000001';
const USER = process.env.PORTAL_UAT_USER || 'staff@example.com';
const PASS = process.env.PORTAL_UAT_PASS || 'staff-demo';
const OUT = resolve(ROOT, 'docs/reviews/assets/PR843');
const TOTP_SECRET_CACHE = join(
  tmpdir(),
  process.env.PR844_TOTP_SECRET_FILE || 'pr844-platform-totp.secret',
);

function md5File(path) {
  return createHash('md5').update(readFileSync(path)).digest('hex');
}

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

async function loginPortal(page) {
  await page.goto(`${PORTAL}/api/auth/login?return=/`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForURL(/openid-connect\/auth|login-actions/, { timeout: 30_000 });
  await page.locator('#username').fill(USER);
  await page.locator('#password').fill(PASS);
  await page.locator('#kc-login').click();
  await page.waitForTimeout(800);

  let enrolledTotpSecret = loadCachedTotpSecret();
  const totpSecret = page.locator('input[name=totpSecret]');
  if (await totpSecret.count()) {
    enrolledTotpSecret = await totpSecret.inputValue();
    if (!enrolledTotpSecret) throw new Error('totpSecret empty on enroll');
    saveCachedTotpSecret(enrolledTotpSecret);
    await page.fill('input[name=totp]', totpFromSessionSecret(enrolledTotpSecret));
    await page.locator('input[type=submit], #kc-login').first().click();
    await page.waitForTimeout(1500);
  }

  const otp = page.locator('input[name=otp]');
  if (await otp.count()) {
    if (!enrolledTotpSecret) {
      throw new Error('otp login without enrolled totp secret (cache missing)');
    }
    await waitForNextTotpWindow();
    await otp.fill(totpFromSessionSecret(enrolledTotpSecret));
    await page.locator('input[type=submit], #kc-login').first().click();
    await page.waitForTimeout(2000);
  }

  await page.waitForURL(
    (url) =>
      url.hostname === '127.0.0.1' &&
      url.port === '3013' &&
      !url.pathname.startsWith('/api/auth'),
    { timeout: 60_000 },
  );
}

async function runAxe(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(500);
  const results = await page.evaluate(({ source, selector }) => {
    const script = document.createElement('script');
    script.textContent = source;
    document.head.appendChild(script);
    const root = document.querySelector(selector) ?? document;
    return new Promise((resolve) => {
      // @ts-expect-error injected
      window.axe.run(root, { runOnly: ['wcag2a', 'wcag2aa'] }, (err, res) => {
        resolve(
          err
            ? { error: String(err) }
            : {
                violations: res.violations.filter(
                  (v) => v.impact === 'serious' || v.impact === 'critical',
                ),
              },
        );
      });
    });
  }, { source: axeSource, selector: '#portal-cn-notify-section' });
  return results;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.WEB_UAT_CHANNEL || 'chrome',
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const guestsUrl = `${PORTAL}/t/${TENANT}/e/${EVENT}/guests#notifications`;

  await loginPortal(page);
  await page.goto(guestsUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const notifyTab = page
    .locator('.ant-tabs-tab')
    .filter({ hasText: /thông báo|notification/i })
    .first();
  await notifyTab.click({ timeout: 30_000 });
  await page.getByTestId('portal-template-preview').waitFor({ timeout: 30_000 });
  await page.getByTestId('portal-template-preview').click();
  await page.getByTestId('portal-template-preview-result').waitFor({
    timeout: 30_000,
  });
  const previewShot = join(OUT, '01-template-preview.png');
  await page.screenshot({ path: previewShot, fullPage: true });

  await page.getByTestId('portal-template-publish').click();
  await page.locator('.ant-modal-confirm .ant-btn-primary').click();
  await page.getByTestId('portal-template-publish-result').waitFor({
    timeout: 30_000,
  });
  const publishShot = join(OUT, '02-template-publish.png');
  await page.screenshot({ path: publishShot, fullPage: true });

  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const local = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}T${pad(future.getHours())}:${pad(future.getMinutes())}`;
  await page.locator('input[type="datetime-local"]').fill(local);
  await page.getByTestId('portal-reminder-preview').click();
  await page.getByTestId('portal-reminder-preview-result').waitFor({
    timeout: 30_000,
  });
  const remPreviewShot = join(OUT, '03-reminder-preview.png');
  await page.screenshot({ path: remPreviewShot, fullPage: true });

  await page.getByTestId('portal-reminder-create').click();
  await page.getByTestId('portal-reminder-create-result').waitFor({
    timeout: 30_000,
  });
  const remCreateShot = join(OUT, '04-reminder-create.png');
  await page.screenshot({ path: remCreateShot, fullPage: true });

  const cancelId = await page
    .locator('input[aria-label*="Reminder"], input[placeholder*="Reminder"]')
    .inputValue();
  let remCancelShot = null;
  if (cancelId.trim()) {
    await page.getByTestId('portal-reminder-cancel').click();
    await page
      .locator('.ant-modal-confirm .ant-btn-dangerous, .ant-modal-confirm .ant-btn-primary')
      .first()
      .click();
    await page.getByTestId('portal-reminder-cancel-result').waitFor({
      timeout: 30_000,
    });
    remCancelShot = join(OUT, '05-reminder-cancel.png');
    await page.screenshot({ path: remCancelShot, fullPage: true });
  }

  const axeResult = await runAxe(page);
  const manifest = {
    sha: process.env.UAT_SHA || 'unset',
    portal: PORTAL,
    guestsUrl,
    screenshots: [previewShot, publishShot, remPreviewShot, remCreateShot, remCancelShot]
      .filter(Boolean)
      .map((p) => ({ path: p, md5: md5File(p) })),
    axeSeriousCritical: axeResult.violations?.length ?? 'error',
    axeDetail: axeResult,
  };
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
  await browser.close();
  if (axeResult.violations?.length > 0) process.exit(2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
