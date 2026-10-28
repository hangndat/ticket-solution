import { test, expect, loadManifest, fixtureFor } from '../harness/fixtures';
import { randomUUID } from 'node:crypto';
import {
  bffGet,
  bffMutate,
  eventBff,
  eventPath,
  login,
  portalUrl,
} from './helpers';

test('[PORT-06] Manager approves a pending request in Portal', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-06');
  if (!f.requestId)
    throw new Error('BLOCKED: PORT-06 pending request fixture missing');
  await login(page, m, 'PORT-06', 'manager');
  const before = await bffGet(
    page,
    m,
    `${eventBff(f, '/redemptions')}?status=PENDING_REVIEW&q=${f.requestId}`,
  );
  expect(before.status).toBe(200);
  expect(JSON.stringify(before.json)).toContain(f.requestId);
  await page.goto(portalUrl(m, eventPath(f, '/guests#pending')));
  const pending = page.locator('#pending');
  await pending
    .getByPlaceholder('Tìm theo mã UUID của yêu cầu')
    .fill(f.requestId);
  await pending
    .getByRole('button', { name: 'Áp dụng bộ lọc chờ duyệt' })
    .click();
  const row = pending.getByRole('row', { name: new RegExp(f.requestId) });
  await expect(row).toBeVisible();
  const approved = page.waitForResponse(
    (response) =>
      response.url().includes(`/redemptions/${f.requestId}/approve`) &&
      response.request().method() === 'POST',
  );
  await row.getByRole('button', { name: 'Duyệt' }).click();
  expect([200, 201]).toContain((await approved).status());
  await expect(pending.getByTestId('pending-notice')).toBeVisible();
  const after = await bffGet(
    page,
    m,
    `${eventBff(f, '/redemptions')}?status=PENDING_REVIEW&q=${f.requestId}`,
  );
  expect(after.status).toBe(200);
  await expect
    .poll(async () => {
      const snapshot = await bffGet(
        page,
        m,
        `${eventBff(f, '/redemptions')}?status=PENDING_REVIEW&q=${f.requestId}`,
      );
      expect(snapshot.status).toBe(200);
      return JSON.stringify(snapshot.json).includes(f.requestId!);
    })
    .toBe(false);
});

test('[PORT-09] CS lookup masks PII and resend preserves the ticket with cooldown', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-09');
  if (!f.ticketId) throw new Error('BLOCKED: PORT-09 ticket missing');
  await login(page, m, 'PORT-09', 'cs');
  const response = await bffGet(
    page,
    m,
    eventBff(f, `/tickets?q=${f.ticketId}&limit=50`),
  );
  expect(response.status).toBe(200);
  const body = response.json as { items: Array<Record<string, unknown>> };
  expect(body.items).toHaveLength(1);
  expect(body.items[0].ticketId).toBe(f.ticketId);
  for (const item of body.items) {
    expect(item.notification).toBeTruthy();
    expect(['PENDING', 'ACCEPTED', 'FAILED', 'DEAD', 'UNKNOWN']).toContain(
      (item.notification as { providerStatus: string }).providerStatus,
    );
    for (const key of [
      'email',
      'ownerEmail',
      'rawEmail',
      'token',
      'qr',
      'qrPayload',
    ])
      expect(item).not.toHaveProperty(key);
  }
  const detailPath = eventBff(f, `/tickets/${f.ticketId}`);
  const before = await bffGet(page, m, detailPath);
  expect(before.status).toBe(200);
  expect(Array.isArray((before.json as { timeline: unknown[] }).timeline)).toBe(
    true,
  );
  await page.goto(portalUrl(m, eventPath(f, '/support')));
  const panel = page.locator('#cs');
  await panel.getByPlaceholder('Mã vé hoặc mã yêu cầu').fill(f.ticketId);
  await panel.getByRole('button', { name: 'Tra cứu', exact: true }).click();
  const row = panel.getByRole('row').filter({ hasText: f.ticketId });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Chi tiết', exact: true }).click();
  await expect(
    panel.getByRole('heading', { name: `Timeline — ${f.ticketId}` }),
  ).toBeVisible();
  const sent = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/tickets/${f.ticketId}/resend`) &&
      r.request().method() === 'POST',
  );
  await panel
    .getByRole('button', { name: 'Resend email', exact: true })
    .click();
  expect([200, 201]).toContain((await sent).status());
  const cooldown = await bffMutate(page, `${detailPath}/resend`, {
    idempotencyKey: randomUUID(),
  });
  expect(cooldown.status).toBe(429);
  expect((cooldown.json as { code: string }).code).toBe('RESEND_COOLDOWN');
  const after = await bffGet(page, m, detailPath);
  expect(after.status).toBe(200);
  expect((after.json as { ticketId: string; state: string }).ticketId).toBe(
    f.ticketId,
  );
  expect((after.json as { state: string }).state).toBe(
    (before.json as { state: string }).state,
  );
  await expect(page.getByText('DELIVERED', { exact: true })).toHaveCount(0);
});

test('[PORT-12] self-serve registration remains PENDING', async ({ page }) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-12');
  const name = f.data?.registrationName;
  const slug = f.data?.registrationSlug;
  if (typeof name !== 'string' || typeof slug !== 'string')
    throw new Error('BLOCKED: PORT-12 unique registration values missing');
  await login(page, m, 'PORT-12', 'owner');
  await page.goto(portalUrl(m, '/onboarding'));
  await page.getByLabel('Tên tổ chức').fill(name);
  await page.getByLabel('Slug').fill(slug);
  await page.getByRole('button', { name: 'Gửi đăng ký' }).click();
  await expect(page).toHaveURL(/\/onboarding\/[0-9a-f-]+/);
  const tenantId = new URL(page.url()).pathname.split('/')[2];
  const tenants = await bffGet(page, m, '/api/bff/me/tenants');
  expect(tenants.status).toBe(200);
  expect(JSON.stringify(tenants.json)).toContain(tenantId);
  await expect(page.getByText(/chờ|PENDING/i).first()).toBeVisible();
});

test('[PORT-14] audit/codes BFF projections omit raw secrets', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-14');
  await login(page, m, 'PORT-14', 'owner');
  for (const endpoint of ['/audit?limit=20', '/codes?limit=20']) {
    const response = await bffGet(page, m, eventBff(f, endpoint));
    expect(response.status).toBe(200);
    const text = JSON.stringify(response.json);
    expect(text).not.toMatch(
      /"(?:rawCode|tokenHash|hmac|qrPayload|ownerEmail|rawEmail)"\s*:/i,
    );
  }
  await page.goto(portalUrl(m, eventPath(f, '/audit')));
  await expect(page.getByTestId('audit-table')).toBeVisible();
});
