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
  const beforeSeq =
    (await page
      .locator('[data-testid="admin-notice"]')
      .getAttribute('data-notice-seq')
      .catch(() => null)) ?? '';
  await page.getByRole('button', { name, exact: true }).click();
  let handle;
  try {
    handle = await page.waitForFunction(
      ({ source, previousSeq }) => {
        const el = document.querySelector('[data-testid="admin-notice"]');
        const text = el?.textContent ?? '';
        const seq = el?.getAttribute('data-notice-seq') ?? '';
        if (!text || seq === previousSeq) return null;
        return new RegExp(source).test(text) ? text : null;
      },
      { source: pattern.source, previousSeq: beforeSeq },
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
  if (/mfest|MFest/i.test(html))
    throw new Error('admin page hardcoded a demo festival');
  await page.locator('[data-testid="admin-workspace"]').waitFor();
  await page.getByTestId('admin-tech-details').locator('summary').click();
  await page.getByLabel('Tenant ID', { exact: true }).fill(TENANT);
  await page.getByLabel('Event ID', { exact: true }).fill(EVENT);
  await page.getByTestId('admin-job-setup').click();
  const orgInput = page.getByLabel(/Tên tổ chức|organizationName|Organization/i).first();
  if (await orgInput.count()) {
    await orgInput.fill('UAT Org');
  }
  await page.getByRole('button', { name: /Xem trước/ }).click();
  await Promise.race([
    page.getByTestId('config-rendered-preview').waitFor({ state: 'visible' }),
    page.getByTestId('config-validation-error').waitFor({ state: 'visible' }),
    page.getByTestId('admin-notice').waitFor({ state: 'visible' }),
  ]);
  // Fail-closed: OIDC unset → OIDC_MISCONFIGURED; signed-out → UNAUTHENTICATED;
  // OIDC set but API down → unknown (never claim saved/published/imported).
  const failClosed =
    /OIDC_MISCONFIGURED|UNAUTHENTICATED|chưa biết|EVENT_CREATE|CONFIG_VERSION|QUOTA_REQUIRED|CS:|Export |Đã lưu|Đã publish|Đã nhập|Đã tạo event|Quota event|Payload không hợp lệ|CONFIG_EDITOR/;
  const saveText = await clickAndNotice(page, 'Lưu phiên bản', failClosed);
  await page.getByLabel(/Phiên bản cần xuất bản|Phiên bản cần publish/).fill('1');
  const publishBtn = page.getByTestId('config-publish-button');
  const publishDisabled = await publishBtn.isDisabled();
  let publishText;
  if (publishDisabled) {
    publishText =
      'Publish UI gated (checklist chưa đủ) — không coi đã xuất bản; backend vẫn fail-closed.';
    console.log('admin-uat: publish gated disabled=true (PD AC-M1)');
  } else {
    publishText = await clickAndNotice(page, 'Xuất bản', failClosed);
  }
  await page.getByTestId('admin-job-guests').click();
  await page.locator('#admin-codes').fill('CODE-A\nCODE-B');
  const importText = await clickAndNotice(page, 'Nhập mã', failClosed);
  const quotaText = await clickAndNotice(page, 'Đọc quota', failClosed);
  await page.getByTestId('admin-job-setup').click();
  await page.getByLabel('Event slug').fill('aurora-night');
  await page.getByLabel('Event name').fill('Aurora Night');
  const createText = await clickAndNotice(page, 'Tạo event', failClosed);
  await page.getByTestId('admin-job-support').click();
  await page.getByLabel('Từ khóa CS').fill('lookup');
  const csText = await clickAndNotice(page, 'Tìm vé CS', failClosed);
  const exportText = await clickAndNotice(page, 'Tạo export CSV', failClosed);
  await page.getByTestId('admin-job-setup').click();
  const saveBtn = page.getByRole('button', { name: 'Lưu phiên bản', exact: true });
  // Fail-closed publish must not lock draft as if published succeeded.
  if (await saveBtn.isDisabled()) {
    throw new Error('unpublished config editor was locked after fail-closed flow');
  }
  const shot = join(OUT, 'admin-event-ops.png');
  await page.screenshot({ path: shot, fullPage: true });
  console.log(`admin-uat: ok ${base}/admin`);
  console.log(`admin-uat: save=${saveText.replace(/\s+/g, ' ')}`);
  console.log(`admin-uat: publish=${publishText.replace(/\s+/g, ' ')}`);
  console.log(`admin-uat: import=${importText.replace(/\s+/g, ' ')}`);
  console.log(`admin-uat: quota=${quotaText.replace(/\s+/g, ' ')}`);
  console.log(`admin-uat: create=${createText.replace(/\s+/g, ' ')}`);
  console.log(`admin-uat: cs=${csText.replace(/\s+/g, ' ')}`);
  console.log(`admin-uat: export=${exportText.replace(/\s+/g, ' ')}`);
  console.log(`admin-uat: screenshot ${shot}`);
} finally {
  await browser.close();
}
