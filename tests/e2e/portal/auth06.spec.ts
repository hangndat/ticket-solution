import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import {
  test,
  expect,
  loadManifest,
  fixtureFor,
  accountFor,
} from '../harness/fixtures';
import { eventBff, eventPath, login, portalUrl } from './helpers';

const requireBackend = createRequire(
  resolve(process.cwd(), 'packages/backend/package.json'),
);
const { Client } = requireBackend('pg');

test('[AUTH-06] stale Portal capability rejects gate creation after assignment and membership revocation', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'AUTH-06');
  const databaseUrl = f.data?.controlDatabaseUrl;
  if (typeof databaseUrl !== 'string')
    throw new Error('BLOCKED: AUTH-06 control database missing');
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
      return result;
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  };
  const counts = async () =>
    (
      await query(
        `SELECT (SELECT count(*)::int FROM gates WHERE tenant_id=$1::uuid AND event_id=$2::uuid) AS gates,
            (SELECT count(*)::int FROM checkins WHERE tenant_id=$1::uuid AND event_id=$2::uuid) AS checkins`,
        [f.tenantId, f.eventId],
      )
    ).rows[0];
  try {
    for (const actor of ['manager', 'owner'] as const) {
      const userId = accountFor(m, 'AUTH-06', actor).userId;
      if (!userId) throw new Error(`BLOCKED: ${actor} userId missing`);
      await login(page, m, 'AUTH-06', actor);
      await page.goto(portalUrl(m, eventPath(f, '/gate')));
      const section = page.getByRole('region', { name: 'Cổng vào' });
      const open = section.getByRole('button', { name: 'Thêm cổng' });
      await open.click();
      const dialog = page.getByRole('dialog', { name: 'Thêm cổng' });
      const positive = `AUTH06 ${actor} positive`;
      await dialog.getByRole('textbox').fill(positive);
      await dialog.getByRole('button', { name: 'Thêm cổng' }).click();
      await expect(section.getByRole('cell', { name: positive })).toBeVisible();
      await page.reload();
      await expect(section.getByRole('cell', { name: positive })).toBeVisible();
      await open.click();
      await dialog.getByRole('textbox').fill(`AUTH06 ${actor} revoked`);
      const before = await counts();
      const revoked =
        actor === 'manager'
          ? await query(
              `UPDATE event_assignments SET revoked_at=now() WHERE tenant_id=$1::uuid AND event_id=$2::uuid AND membership_id=(SELECT id FROM memberships WHERE tenant_id=$1::uuid AND user_id=$3::uuid) AND revoked_at IS NULL`,
              [f.tenantId, f.eventId, userId],
            )
          : await query(
              `UPDATE memberships SET revoked_at=now() WHERE tenant_id=$1::uuid AND user_id=$2::uuid AND revoked_at IS NULL`,
              [f.tenantId, userId],
            );
      expect(revoked.rowCount).toBe(1);
      const response = page.waitForResponse(
        (res) =>
          res.url().includes(eventBff(f, '/gates')) &&
          res.request().method() === 'POST',
      );
      await dialog.getByRole('button', { name: 'Thêm cổng' }).click();
      expect((await response).status()).toBe(403);
      await expect(
        dialog.getByText(
          'Bạn không có quyền xem danh sách cổng của sự kiện này.',
        ),
      ).toBeVisible();
      await expect(section.locator('.ant-alert-success')).toHaveCount(0);
      expect(await counts()).toEqual(before);
      await page.context().clearCookies();
    }
  } finally {
    await db.end();
  }
});
