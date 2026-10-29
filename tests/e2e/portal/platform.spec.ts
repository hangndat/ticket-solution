import { randomUUID } from 'node:crypto';
import { test, expect, loadManifest, fixtureFor } from '../harness/fixtures';
import { bffGet, bffMutate, login, portalUrl } from './helpers';

test('[PLAT-01] Operator MFA session is separate from staff Owner', async ({
  page,
  browser,
}) => {
  const m = loadManifest();
  fixtureFor(m, 'PLAT-01');
  await login(page, m, 'PLAT-01', 'operator', 'platform');
  const me = await bffGet(page, m, '/api/bff/platform/me');
  expect(me.status).toBe(200);
  expect((me.json as { operator?: boolean }).operator).toBe(true);
  await page.goto(portalUrl(m, '/platform'));
  await expect(page.getByTestId('platform-tenants-table')).toBeVisible();
  const ownerContext = await browser.newContext();
  try {
    const ownerPage = await ownerContext.newPage();
    await login(ownerPage, m, 'PLAT-01', 'owner');
    const denied = await bffGet(ownerPage, m, '/api/bff/platform/tenants');
    expect([401, 403]).toContain(denied.status);
    await ownerPage.goto(portalUrl(m, '/platform'));
    await expect(ownerPage.getByTestId('platform-tenants-table')).toHaveCount(
      0,
    );
  } finally {
    await ownerContext.close();
  }
});

test('[PLAT-02] Operator activates a PENDING tenant with version check', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PLAT-02');
  const tenantId = f.data?.pendingTenantId;
  if (typeof tenantId !== 'string')
    throw new Error('BLOCKED: PLAT-02 pending tenant missing');
  await login(page, m, 'PLAT-02', 'operator', 'platform');
  expect((await bffGet(page, m, '/api/bff/platform/me')).status).toBe(200);
  const path = `/api/bff/platform/tenants/${tenantId}`;
  const before = await bffGet(page, m, path);
  expect(before.status).toBe(200);
  const detail = before.json as { status: string; version: number };
  expect(detail.status).toBe('PENDING');
  const activated = await bffMutate(page, `${path}/status`, {
    status: 'ACTIVE',
    reason: 'E2E activation after review',
    expectedVersion: detail.version,
    idempotencyKey: randomUUID(),
  });
  expect([200, 201]).toContain(activated.status);
  const after = await bffGet(page, m, path);
  expect(after.status).toBe(200);
  expect((after.json as { status: string }).status).toBe('ACTIVE');
});

test('[PLAT-03] support grant is bounded to cs.read and one hour', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PLAT-03');
  await login(page, m, 'PLAT-03', 'operator', 'platform');
  expect((await bffGet(page, m, '/api/bff/platform/me')).status).toBe(200);
  const path = '/api/bff/platform/support-grants';
  const base = {
    tenantId: f.tenantId,
    eventId: f.eventId,
    reason: 'E2E scoped support review',
    idempotencyKey: randomUUID(),
  };
  const broad = await bffMutate(page, path, {
    ...base,
    scopes: ['cs.read', 'pii.read'],
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
  });
  expect(broad.status).toBe(422);
  expect((broad.json as { code?: string }).code).toBe('INVALID_INPUT');
  const tooLong = await bffMutate(page, path, {
    ...base,
    idempotencyKey: randomUUID(),
    scopes: ['cs.read'],
    expiresAt: new Date(Date.now() + 2 * 60 * 60_000).toISOString(),
  });
  expect(tooLong.status).toBe(422);
  expect((tooLong.json as { code?: string }).code).toBe('INVALID_INPUT');
  const granted = await bffMutate(page, path, {
    ...base,
    idempotencyKey: randomUUID(),
    scopes: ['cs.read'],
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
  });
  expect([200, 201]).toContain(granted.status);
  const grant = granted.json as { grantId: string; expiresAt: string };
  expect(grant.grantId).toMatch(/^[0-9a-f-]{36}$/i);
  expect(Date.parse(grant.expiresAt)).toBeLessThanOrEqual(
    Date.now() + 60 * 60_000,
  );
  const revoked = await bffMutate(page, `${path}/${grant.grantId}/revoke`, {
    reason: 'E2E revoke after validation',
    idempotencyKey: randomUUID(),
  });
  expect([200, 201]).toContain(revoked.status);
  expect(
    Date.parse(String((revoked.json as { revokedAt?: string }).revokedAt)),
  ).not.toBeNaN();
});

test('[PLAT-04] Operator reads tenant health and audit without raw PII', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PLAT-04');
  await login(page, m, 'PLAT-04', 'operator', 'platform');
  const health = await bffGet(
    page,
    m,
    `/api/bff/platform/tenants/${f.tenantId}/health`,
  );
  expect(health.status).toBe(200);
  expect((health.json as { tenantId: string }).tenantId).toBe(f.tenantId);
  const audit = await bffGet(
    page,
    m,
    `/api/bff/platform/audit?tenantId=${f.tenantId}&limit=20`,
  );
  expect(audit.status).toBe(200);
  for (const body of [health.json, audit.json]) {
    expect(JSON.stringify(body)).not.toMatch(
      /"(?:secret|token|email|rawError|providerPayload|qrPayload)"\s*:/i,
    );
  }
  await page.goto(portalUrl(m, '/platform'));
  await page.getByRole('tab', { name: 'Tenant health', exact: true }).click();
  await expect(page.getByTestId('platform-health-load')).toBeVisible();
});

test('[PLAT-05] unconfigured platform login fails closed without a session', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PLAT-05');
  const origin = f.data?.unconfiguredPortalOrigin;
  if (typeof origin !== 'string' || new URL(origin).protocol !== 'https:') {
    throw new Error(
      'BLOCKED: PLAT-05 isolated HTTPS misconfiguration profile missing',
    );
  }
  const response = await page.request.get(
    new URL('/api/auth/platform/login', origin).toString(),
    { failOnStatusCode: false },
  );
  expect(response.status()).toBe(503);
  const body = (await response.json()) as { code?: string };
  expect(body.code).toBe('PLATFORM_MISCONFIGURED');
  const me = await page.request.get(
    new URL('/api/bff/platform/me', origin).toString(),
    { failOnStatusCode: false },
  );
  expect([401, 403, 503]).toContain(me.status());
  await page.goto(new URL('/platform', origin).toString());
  await expect(page.getByTestId('platform-tenants-table')).toHaveCount(0);
});
