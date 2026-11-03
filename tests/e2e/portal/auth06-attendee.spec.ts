import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import {
  test,
  expect,
  loadManifest,
  fixtureFor,
  accountFor,
} from '../harness/fixtures';
import {
  bffGet,
  bffMutate,
  eventBff,
  eventPath,
  login,
  portalUrl,
} from './helpers';

const requireBackend = createRequire(
  resolve(process.cwd(), 'packages/backend/package.json'),
);
const { Client } = requireBackend('pg');

test('[AUTH-06] attendee staff-client login does not grant a staff workspace', async ({
  page,
  browser,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'AUTH-06');
  const attendeeId = accountFor(m, 'AUTH-06', 'attendee').userId;
  const databaseUrl = f.data?.controlDatabaseUrl;
  if (!attendeeId || typeof databaseUrl !== 'string')
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
    expect((subject.json as { userId: string }).userId).toBeTruthy();
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
    expect((await bffGet(page, m, eventBff(f, '/gates'))).status).toBe(403);
    expect(
      (
        await bffMutate(page, eventBff(f, '/gates'), {
          name: 'AUTH06 attendee denied',
        })
      ).status,
    ).toBe(403);
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
