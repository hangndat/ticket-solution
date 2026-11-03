import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import type { Page } from 'playwright/test';
import {
  test,
  expect,
  loadManifest,
  fixtureFor,
  accountFor,
} from '../harness/fixtures';
import { bffGet, eventBff, eventPath, login, portalUrl } from './helpers';

const requireBackend = createRequire(
  resolve(process.cwd(), 'packages/backend/package.json'),
);
const { Client } = requireBackend('pg');

async function postGate(
  page: Page,
  origin: string,
  path: string,
  name: string,
  mismatch = false,
) {
  const cookie = (await page.context().cookies(origin)).find(
    (item) => item.name === 'portal_csrf',
  );
  expect(cookie?.value.length).toBeGreaterThanOrEqual(32);
  return page.evaluate(
    async ({ path, name, token }) => {
      const response = await fetch(path, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'x-portal-csrf': token },
        body: JSON.stringify({ name }),
      });
      return { status: response.status, json: await response.json() };
    },
    { path, name, token: mismatch ? 'invalid-csrf' : cookie!.value },
  );
}

test('[AUTH-06] attendee staff-client login does not grant a staff workspace', async ({
  page,
  browser,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'AUTH-06');
  const attendee = accountFor(m, 'AUTH-06', 'attendee') as ReturnType<
    typeof accountFor
  > & { subject?: string };
  const attendeeId = attendee.userId;
  const databaseUrl = f.data?.controlDatabaseUrl;
  if (!attendeeId || !attendee.subject || typeof databaseUrl !== 'string')
    throw new Error('BLOCKED: AUTH-06 fixture control missing');
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  const query = async (sql: string, values: string[]) => {
    await db.query('BEGIN');
    try {
      await db.query('SET LOCAL ROLE ticket_runtime');
      await db.query("SELECT set_config('app.tenant_id', $1, true)", [
        f.tenantId,
      ]);
      const result = await db.query(sql, values);
      await db.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  };
  const staff = await browser.newContext();
  try {
    const memberships = await query(
      `SELECT count(*)::int AS count FROM memberships WHERE tenant_id=$1::uuid AND user_id=$2::uuid AND revoked_at IS NULL`,
      [f.tenantId, attendeeId],
    );
    expect(memberships.count).toBe(0);
    const assignments = await query(
      `SELECT count(*)::int AS count FROM event_assignments a JOIN memberships m ON m.tenant_id=a.tenant_id AND m.id=a.membership_id WHERE a.tenant_id=$1::uuid AND a.event_id=$2::uuid AND m.user_id=$3::uuid AND a.revoked_at IS NULL`,
      [f.tenantId, f.eventId, attendeeId],
    );
    expect(assignments.count).toBe(0);
    const staffPage = await staff.newPage();
    await login(staffPage, m, 'AUTH-06', 'owner');
    const ownerEvents = await bffGet(staffPage, m, '/api/bff/me/events');
    expect(ownerEvents.status).toBe(200);
    expect((ownerEvents.json as { staffEligible: boolean }).staffEligible).toBe(
      true,
    );
    expect(JSON.stringify(ownerEvents.json)).toContain(f.eventId);
    await staffPage.goto(portalUrl(m, eventPath(f, '/gate')));
    const section = staffPage.getByRole('region', { name: 'Cổng vào' });
    await section.getByRole('button', { name: 'Thêm cổng' }).click();
    const dialog = staffPage.getByRole('dialog', { name: 'Thêm cổng' });
    await dialog.getByRole('textbox').fill('AUTH06 staff control');
    await dialog.getByRole('button', { name: 'Thêm cổng' }).click();
    await expect(
      section.getByRole('cell', { name: 'AUTH06 staff control' }),
    ).toBeVisible();
    const ownerPost = await postGate(
      staffPage,
      m.origins.portal,
      eventBff(f, '/gates'),
      'AUTH06 csrf positive',
    );
    expect(ownerPost.status).toBe(201);
    expect(ownerPost.json.name).toBe('AUTH06 csrf positive');

    const gateCount = async () =>
      (
        await query(
          `SELECT count(*)::int AS count FROM gates WHERE tenant_id=$1::uuid AND event_id=$2::uuid`,
          [f.tenantId, f.eventId],
        )
      ).count;
    const before = await gateCount();
    await login(page, m, 'AUTH-06', 'attendee');
    const subject = await bffGet(page, m, '/api/bff/me/subject');
    expect(subject.status).toBe(200);
    expect((subject.json as { userId: string }).userId).toBe(attendee.subject);
    const tenants = await bffGet(page, m, '/api/bff/me/tenants');
    expect(tenants.status).toBe(200);
    const items = (
      tenants.json as { items: Array<{ tenantId: string; role: string }> }
    ).items;
    expect(items).toContainEqual(
      expect.objectContaining({ tenantId: f.tenantId, role: 'Attendee' }),
    );
    expect(items.filter((item) => item.role !== 'Attendee')).toEqual([]);
    const events = await bffGet(page, m, '/api/bff/me/events');
    expect(events.status).toBe(200);
    expect(events.json).toEqual(
      expect.objectContaining({ staffEligible: false, items: [] }),
    );
    await expect(
      page.getByText('Portal quản trị chỉ dành cho nhân sự'),
    ).toBeVisible();
    const deniedGates = await bffGet(page, m, eventBff(f, '/gates'));
    expect(deniedGates.status).toBe(403);
    expect(JSON.stringify(deniedGates.json)).not.toContain(
      'AUTH06 staff control',
    );
    const csrfNegative = await postGate(
      page,
      m.origins.portal,
      eventBff(f, '/gates'),
      'AUTH06 csrf negative',
      true,
    );
    expect(csrfNegative.status).toBe(403);
    expect(csrfNegative.json.code).toBe('CSRF_TOKEN_MISMATCH');
    const deniedPost = await postGate(
      page,
      m.origins.portal,
      eventBff(f, '/gates'),
      'AUTH06 attendee denied',
    );
    expect(deniedPost.status).toBe(403);
    expect(deniedPost.json.code).toBe('MEMBERSHIP_REQUIRED');
    await page.goto(portalUrl(m, eventPath(f, '/gate')));
    await expect(
      page.getByText('Portal quản trị chỉ dành cho nhân sự'),
    ).toBeVisible();
    await expect(page.getByText('AUTH06 staff control')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Thêm cổng' })).toHaveCount(
      0,
    );
    expect(await gateCount()).toBe(before);
  } finally {
    await staff.close();
    await db.end();
  }
});
