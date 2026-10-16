#!/usr/bin/env node
/**
 * Headless admin UAT. Never opens a visible browser window.
 * Usage: node apps/web/tests/admin-uat.mjs [baseUrl]
 */
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = join(ROOT, 'apps/web/.uat-artifacts');
const base = (process.argv[2] || 'http://127.0.0.1:3000').replace(/\/$/, '');
const TENANT = '11111111-1111-4111-8111-111111111111';
const EVENT = '22222222-2222-4222-8222-222222222222';

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

async function clickAndNotice(page, name, pattern) {
  const before =
    (await page
      .locator('[data-testid="admin-notice"]')
      .textContent()
      .catch(() => '')) ?? '';
  await page.getByRole('button', { name, exact: true }).click();
  let handle;
  try {
    handle = await page.waitForFunction(
      ({ source, previous }) => {
        const text =
          document.querySelector('[data-testid="admin-notice"]')?.textContent ??
          '';
        if (!text || text === previous) return null;
        return new RegExp(source).test(text) ? text : null;
      },
      { source: pattern.source, previous: before },
    );
  } catch (error) {
    const notice = await page
      .locator('[data-testid="admin-notice"]')
      .textContent()
      .catch(() => '');
    console.error(`admin-uat: notice miss for ${name}: ${notice}`);
    throw error;
  }
  return handle.jsonValue();
}

mkdirSync(OUT, { recursive: true });
const browser = await launchBrowser();
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  page.setDefaultTimeout(15000);
  const response = await page.goto(`${base}/admin`, {
    waitUntil: 'domcontentloaded',
  });
  if (!response?.ok())
    throw new Error(`GET /admin status ${response?.status()}`);
  const html = await page.content();
  if (/fun-fest|FUN FEST/i.test(html))
    throw new Error('admin page hardcoded a demo festival');
  await page.getByLabel('Tenant ID').fill(TENANT);
  await page.getByLabel('Event ID').fill(EVENT);
  await page.getByRole('button', { name: 'Xem trước', exact: true }).click();
  await page.locator('#config-preview').waitFor();
  const saveText = await clickAndNotice(
    page,
    'Lưu phiên bản',
    /OIDC_MISCONFIGURED|UNAUTHENTICATED|Đã lưu/,
  );
  await page.getByLabel('Phiên bản cần publish').fill('1');
  const publishText = await clickAndNotice(
    page,
    'Publish',
    /OIDC_MISCONFIGURED|UNAUTHENTICATED|CONFIG_VERSION|Đã publish/,
  );
  await page.locator('#admin-codes').fill('CODE-A\nCODE-B');
  const importText = await clickAndNotice(
    page,
    'Nhập mã',
    /OIDC_MISCONFIGURED|UNAUTHENTICATED|Đã nhập/,
  );
  const quotaText = await clickAndNotice(
    page,
    'Đọc quota',
    /OIDC_MISCONFIGURED|UNAUTHENTICATED|QUOTA_REQUIRED|Quota event/,
  );
  if (await page.locator('#admin-payload').getAttribute('readonly')) {
    throw new Error('unpublished payload was locked');
  }
  const shot = join(OUT, 'admin-event-ops.png');
  await page.screenshot({ path: shot, fullPage: true });
  console.log(`admin-uat: ok ${base}/admin`);
  console.log(`admin-uat: save=${saveText.replace(/\s+/g, ' ')}`);
  console.log(`admin-uat: publish=${publishText.replace(/\s+/g, ' ')}`);
  console.log(`admin-uat: import=${importText.replace(/\s+/g, ' ')}`);
  console.log(`admin-uat: quota=${quotaText.replace(/\s+/g, ' ')}`);
  console.log(`admin-uat: screenshot ${shot}`);
} finally {
  await browser.close();
}
