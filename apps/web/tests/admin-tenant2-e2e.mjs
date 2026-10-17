#!/usr/bin/env node
/**
 * Headless tenant2 E2E against real Keycloak + BFF + API + Postgres + MinIO.
 * Never opens a visible browser. Usage:
 *   node apps/web/tests/admin-tenant2-e2e.mjs [baseUrl]
 *
 * Env:
 *   WEB_UAT_BASE / argv base (default http://127.0.0.1:13040)
 *   KEYCLOAK_BASE (default http://127.0.0.1:18040)
 *   DATABASE_URL (runtime or admin URL for fixture SQL)
 *   TENANT2_ID (default a2222222-2222-4222-8222-222222222222)
 *   TENANT1_ATTACK_ID (default b1111111-1111-4111-8111-111111111111)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = join(ROOT, 'apps/web/.uat-artifacts');
const base = (
  process.env.WEB_UAT_BASE ||
  process.argv[2] ||
  'http://127.0.0.1:13040'
).replace(/\/$/, '');
const keycloak = (process.env.KEYCLOAK_BASE || 'http://127.0.0.1:18040').replace(
  /\/$/,
  '',
);
const TENANT2 =
  process.env.TENANT2_ID || 'a2222222-2222-4222-8222-222222222222';
const TENANT1_ATTACK =
  process.env.TENANT1_ATTACK_ID || 'b1111111-1111-4111-8111-111111111111';
const STAFF_USER = process.env.UAT_STAFF_USER || 'staff@example.com';
const STAFF_PASS = process.env.UAT_STAFF_PASS || 'staff-demo';
const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://ticket_dev:local_dev_only@127.0.0.1:54340/ticket_web22';

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

function psql(sql) {
  return execFileSync('psql', [DATABASE_URL, '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    encoding: 'utf8',
  });
}

async function clickAndNotice(page, name, pattern) {
  const beforeSeq =
    (await page
      .locator('[data-testid="admin-notice"]')
      .getAttribute('data-notice-seq')
      .catch(() => null)) ?? '';
  await page.getByRole('button', { name, exact: true }).click();
  try {
    const handle = await page.waitForFunction(
      ({ source, previousSeq }) => {
        const el = document.querySelector('[data-testid="admin-notice"]');
        const text = el?.textContent ?? '';
        const seq = el?.getAttribute('data-notice-seq') ?? '';
        if (!text || seq === previousSeq) return null;
        return new RegExp(source).test(text) ? text : null;
      },
      { source: pattern.source, previousSeq: beforeSeq },
      { timeout: 30000 },
    );
    return handle.jsonValue();
  } catch (error) {
    const notice = await page
      .locator('[data-testid="admin-notice"]')
      .textContent()
      .catch(() => '');
    console.error(`admin-e2e: notice miss for ${name}: ${notice}`);
    throw error;
  }
}

mkdirSync(OUT, { recursive: true });
const logLines = [];
const log = (line) => {
  logLines.push(line);
  console.log(line);
};

const browser = await launchBrowser();
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  // Login via OIDC
  await page.goto(`${base}/api/auth/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(new RegExp('openid-connect/auth|login-actions/'));
  await page.locator('#username, input[name="username"]').fill(STAFF_USER);
  await page.locator('#password, input[name="password"]').fill(STAFF_PASS);
  await Promise.all([
    page.waitForURL(
      (url) => {
        const u = typeof url === 'string' ? new URL(url) : url;
        const hostOk =
          u.hostname === '127.0.0.1' || u.hostname === 'localhost';
        // Successful callback redirects to /auth without error= (see auth/callback).
        return (
          hostOk &&
          u.pathname === '/auth' &&
          !u.searchParams.get('error')
        );
      },
      { timeout: 60000 },
    ),
    page.locator('#kc-login, button[type="submit"]').first().click(),
  ]);
  log(`e2e: logged in via Keycloak ${keycloak} → ${page.url()}`);

  // Sync user via BFF
  const me = await page.evaluate(async () => {
    const res = await fetch('/api/bff/me', { credentials: 'same-origin', cache: 'no-store' });
    return { status: res.status, body: await res.json().catch(() => null) };
  });
  log(`e2e: /api/bff/me status=${me.status}`);
  if (me.status !== 200 || !me.body?.userId) {
    throw new Error(`me sync failed: ${JSON.stringify(me)}`);
  }
  const userId = me.body.userId;

  // Operator fixture: tenant2 + membership (event/types/sources NOT seeded)
  psql(`
BEGIN;
INSERT INTO tenants (id, slug, name)
VALUES (
  '${TENANT2}'::uuid,
  'aurora-ops',
  'Aurora Ops (fixture tenant 2)'
)
ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, name = EXCLUDED.name;
INSERT INTO tenants (id, slug, name)
VALUES (
  '${TENANT1_ATTACK}'::uuid,
  'tenant1-attack',
  'Tenant1 Attack Fixture'
)
ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, name = EXCLUDED.name;
INSERT INTO memberships (id, tenant_id, user_id, role, permissions, activated_at, created_at, updated_at)
VALUES (
  'c3333333-3333-4333-8333-333333333333'::uuid,
  '${TENANT2}'::uuid,
  '${userId}'::uuid,
  'operator',
  ARRAY['event.create','event.list']::text[],
  now(),
  now(),
  now()
)
ON CONFLICT (tenant_id, user_id) DO UPDATE
  SET permissions = EXCLUDED.permissions,
      role = EXCLUDED.role,
      activated_at = COALESCE(memberships.activated_at, now()),
      updated_at = now();
COMMIT;
`);
  log(`e2e: provisioned tenant2=${TENANT2} membership for user=${userId}`);

  await page.goto(`${base}/admin`, { waitUntil: 'domcontentloaded' });
  const html = await page.content();
  if (/fun-fest|FUN FEST/i.test(html)) {
    throw new Error('admin page hardcoded a demo festival');
  }

  await page.getByLabel('Tenant ID').fill(TENANT2);
  const slug = `aurora-${Date.now().toString(36)}`;
  await page.getByLabel('Event slug').fill(slug);
  await page.getByLabel('Event name').fill('Aurora Night UAT');
  const createText = await clickAndNotice(
    page,
    'Tạo event',
    /Đã tạo event|IDEMPOTENCY|PERMISSION|EVENT_|chưa biết/,
  );
  log(`e2e: create=${createText.replace(/\s+/g, ' ')}`);
  if (!/Đã tạo event/.test(createText)) {
    throw new Error(`create event failed: ${createText}`);
  }
  const eventId = await page.getByLabel('Event ID').inputValue();
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) {
    throw new Error(`eventId not filled: ${eventId}`);
  }

  // Cross-tenant deny via BFF (same session cookies) before continuing happy path.
  const attack = await page.evaluate(
    async ({ tenantId, eventId }) => {
      const res = await fetch('/api/bff/admin/ticket-types', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, eventId, label: 'Attack GA' }),
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    },
    { tenantId: TENANT1_ATTACK, eventId },
  );
  log(`e2e: tenant1-attack=${JSON.stringify(attack)}`);
  if (attack.status < 400) {
    throw new Error(`tenant1 attack unexpectedly succeeded: ${JSON.stringify(attack)}`);
  }

  // Continue setup via UI on tenant2
  await page.getByLabel('Tenant ID').fill(TENANT2);
  await page.getByLabel('Event ID').fill(eventId);
  const typeText = await clickAndNotice(
    page,
    'Tạo ticket type',
    /Đã tạo ticket type|PERMISSION|chưa biết|CSRF/,
  );
  log(`e2e: ticket-type=${typeText.replace(/\s+/g, ' ')}`);
  if (!/Đã tạo ticket type/.test(typeText)) {
    throw new Error(`ticket type failed: ${typeText}`);
  }
  const sourceText = await clickAndNotice(
    page,
    'Tạo source',
    /Đã tạo source|PERMISSION|chưa biết/,
  );
  log(`e2e: source=${sourceText.replace(/\s+/g, ' ')}`);
  if (!/Đã tạo source/.test(sourceText)) {
    throw new Error(`source failed: ${sourceText}`);
  }

  await page.getByRole('button', { name: 'Xem trước', exact: true }).click();
  await page.locator('#config-preview').waitFor();
  const saveText = await clickAndNotice(
    page,
    'Lưu phiên bản',
    /Đã lưu|PERMISSION|chưa biết|CONFIG/,
  );
  log(`e2e: save=${saveText.replace(/\s+/g, ' ')}`);
  if (!/Đã lưu/.test(saveText)) {
    throw new Error(`save config failed: ${saveText}`);
  }
  const publishText = await clickAndNotice(
    page,
    'Publish',
    /Đã publish|PERMISSION|chưa biết|CONFIG/,
  );
  log(`e2e: publish=${publishText.replace(/\s+/g, ' ')}`);
  if (!/Đã publish/.test(publishText)) {
    throw new Error(`publish failed: ${publishText}`);
  }

  await page.locator('#admin-codes').fill('UAT-CODE-A\nUAT-CODE-B');
  await page.getByLabel('Quota event (lần nhập đầu)').fill('10');
  const importText = await clickAndNotice(
    page,
    'Nhập mã',
    /Đã nhập|PERMISSION|chưa biết|QUOTA/,
  );
  log(`e2e: import=${importText.replace(/\s+/g, ' ')}`);
  if (!/Đã nhập/.test(importText)) {
    throw new Error(`import failed: ${importText}`);
  }

  const csText = await clickAndNotice(
    page,
    'Tìm vé CS',
    /CS:|PERMISSION|chưa biết|EVENT_NOT_FOUND/,
  );
  log(`e2e: cs-list=${csText.replace(/\s+/g, ' ')}`);
  if (!/^CS:/.test(csText) && !/CS:/.test(csText)) {
    throw new Error(`cs list failed: ${csText}`);
  }

  // Pick first ticket id from CS list if present
  const listJson = await page
    .locator('[data-testid="cs-list"]')
    .textContent()
    .catch(() => null);
  if (listJson) {
    const parsed = JSON.parse(listJson);
    const first = Array.isArray(parsed) ? parsed[0] : null;
    if (first?.ticketId) {
      await page.getByLabel('Ticket ID').fill(first.ticketId);
      const detailText = await clickAndNotice(
        page,
        'Xem chi tiết CS',
        /CS: chi tiết|PERMISSION|chưa biết/,
      );
      log(`e2e: cs-detail=${detailText.replace(/\s+/g, ' ')}`);
      await page.locator('[data-testid="cs-timeline"]').waitFor({ timeout: 10000 });
      const resendText = await clickAndNotice(
        page,
        'Gửi lại email',
        /CS: đã yêu cầu|RESEND_|PERMISSION|chưa biết|IDEMPOTENCY/,
      );
      log(`e2e: cs-resend=${resendText.replace(/\s+/g, ' ')}`);
    }
  }

  const exportText = await clickAndNotice(
    page,
    'Tạo export CSV',
    /Export |PERMISSION|chưa biết|MINIO/,
  );
  log(`e2e: export-create=${exportText.replace(/\s+/g, ' ')}`);
  if (!/Export /.test(exportText)) {
    throw new Error(`export create failed: ${exportText}`);
  }

  // Poll status until READY or FAILED
  let ready = false;
  for (let i = 0; i < 20; i++) {
    const statusText = await clickAndNotice(
      page,
      'Trạng thái export',
      /Export |PERMISSION|chưa biết|EXPORT_/,
    );
    log(`e2e: export-status[${i}]=${statusText.replace(/\s+/g, ' ')}`);
    if (/READY/.test(statusText)) {
      ready = true;
      break;
    }
    if (/FAILED/.test(statusText)) break;
    await page.waitForTimeout(1000);
  }
  if (ready) {
    const dlText = await clickAndNotice(
      page,
      'Lấy link tải',
      /đã nhận CSV|EXPORT_|PERMISSION|chưa biết/,
    );
    log(`e2e: export-download=${dlText.replace(/\s+/g, ' ')}`);
  }

  const shot = join(OUT, 'admin-tenant2-e2e.png');
  await page.screenshot({ path: shot, fullPage: true });
  log(`e2e: screenshot ${shot}`);
  writeFileSync(join(OUT, 'admin-tenant2-e2e.log'), logLines.join('\n') + '\n');
  log(`e2e: ok ${base}/admin tenant2=${TENANT2} event=${eventId}`);
} finally {
  await browser.close();
}
