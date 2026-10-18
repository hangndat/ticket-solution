#!/usr/bin/env node
/**
 * Headless CS / email recovery UAT (Issue #246). Never opens a visible window.
 * Usage: node apps/web/tests/d11-cs-email-uat.mjs [baseUrl]
 * Expects real BFF/auth stack — fail-closed when unauthenticated; no mock auth.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = join(ROOT, 'apps/web/.uat-artifacts');
const base = (process.argv[2] || 'http://localhost:3246').replace(/\/$/, '');
const TENANT = '11111111-1111-4111-8111-111111111111';
const EVENT = '22222222-2222-4222-8222-222222222222';
const LOG = join(OUT, 'd11-cs-email-246-uat.log');

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

function log(line) {
  console.log(line);
  writeFileSync(LOG, `${line}\n`, { flag: 'a' });
}

mkdirSync(OUT, { recursive: true });
writeFileSync(LOG, `d11-cs-email-246 UAT start ${new Date().toISOString()} base=${base}\n`);

const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(20000);
  const response = await page.goto(`${base}/admin`, { waitUntil: 'domcontentloaded' });
  if (!response?.ok()) throw new Error(`GET /admin status ${response?.status()}`);
  await page.locator('[data-testid="admin-workspace"]').waitFor();
  await page.getByTestId('admin-tech-details').locator('summary').click();
  await page.getByLabel('Tenant ID', { exact: true }).fill(TENANT);
  await page.getByLabel('Event ID', { exact: true }).fill(EVENT);
  await page.getByTestId('admin-job-support').click();
  const support = page.locator('[data-testid="admin-support-panel"]');
  await support.waitFor({ state: 'visible' });

  const section = support.locator('#cs-heading');
  await section.waitFor({ state: 'visible' });
  const intro = await support.locator('#cs-heading + p, section.admin-section > p').first().textContent();
  if (!/ACCEPTED/.test(intro || '') || !/DELIVERED/.test(intro || '')) {
    throw new Error(`CS intro missing ACCEPTED/DELIVERED honesty copy: ${intro}`);
  }
  if (!/cooldown/i.test(intro || '') && !/cooldown|chờ gửi lại|cs\.resend/i.test(intro || '')) {
    throw new Error(`CS intro missing cooldown/permission hint: ${intro}`);
  }

  await page.getByTestId('cs-resend-button').waitFor();
  const resendLabel = await page.getByTestId('cs-resend-button').textContent();
  if (!/Gửi lại email/.test(resendLabel || '')) {
    throw new Error(`unexpected resend button label: ${resendLabel}`);
  }

  await page.getByLabel('Từ khóa CS').fill('lookup');
  const beforeSeq =
    (await page
      .locator('[data-testid="admin-notice"]')
      .getAttribute('data-notice-seq')
      .catch(() => null)) ?? '';
  await page.getByRole('button', { name: 'Tìm vé CS', exact: true }).click();
  await page.waitForFunction(
    ({ previousSeq }) => {
      const el = document.querySelector('[data-testid="admin-notice"]');
      const text = el?.textContent ?? '';
      const seq = el?.getAttribute('data-notice-seq') ?? '';
      if (!text || seq === previousSeq) return false;
      return /CS:|PERMISSION|OIDC|UNAUTHENTICATED|chưa biết|EVENT_NOT_FOUND/.test(
        text,
      );
    },
    { previousSeq: beforeSeq },
  );
  const csText =
    (await page.locator('[data-testid="admin-notice"]').textContent()) || '';
  log(`cs-search=${csText.replace(/\s+/g, ' ')}`);

  // Fail-closed: without auth we expect unknown/OIDC/PERMISSION — never invent DELIVERED success.
  if (/DELIVERED/.test(csText) && !/≠|không khẳng định|bằng chứng/.test(csText)) {
    throw new Error(`CS notice must not claim bare DELIVERED success: ${csText}`);
  }

  const shot = join(OUT, 'd11-cs-email-246-support.png');
  await page.locator('[data-testid="admin-support-panel"]').screenshot({ path: shot });
  log(`screenshot ${shot}`);
  log(`auth-note: notice="${csText.replace(/\s+/g, ' ')}" — real BFF; no mock auth bypass`);
  log('d11-cs-email-246 UAT ok');
} finally {
  await browser.close();
}
