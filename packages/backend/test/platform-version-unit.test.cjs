'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getPlatformTenantDetail, setTenantStatus, updateTenantLimits } = require('../dist/platform-tenant');

test('service uses different versions after activation (mocked transaction, no SQL execution)', async () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const actorUserId = '22222222-2222-4222-8222-222222222222';
  const tenant = { id: tenantId, status: 'PENDING', version: 1, name: 'Fixture', slug: 'fixture',
    default_timezone: 'UTC', contact: null };
  const limits = { version: 1, max_events: 10, max_staff: 10, email_per_day: 10,
    import_rows_per_job: 10, imports_enabled: true, exports_enabled: true };
  const tx = {
    async $executeRawUnsafe(sql) { assert.equal(sql, 'SET LOCAL ROLE ticket_platform_runtime'); },
    async $queryRaw(parts) {
      const sql = parts.join('?');
      if (sql.includes("set_config('app.actor_id'")) return [];
      if (sql.includes('FROM platform_operators')) return [{ user_id: actorUserId, revoked_at: null, activated_at: new Date(0) }];
      if (sql.includes('FROM tenants')) return [{ ...tenant }];
      if (sql.includes('platform_tenant_has_active_owner')) return [{ ok: true }];
      if (sql.includes('FROM tenant_limits')) return [{ ...limits }];
      if (sql.includes('platform_tenant_usage_counts')) return [{ events: 0, staff_active: 0, staff_pending: 0, email_today: 0 }];
      throw new Error(`Unexpected fixture query: ${sql}`);
    },
    async $executeRaw(parts, ...values) {
      const sql = parts.join('?');
      if (sql.includes('UPDATE tenants')) { tenant.status = values[0]; tenant.version = values[1]; return 1; }
      if (sql.includes('UPDATE tenant_limits')) { limits.version = values[6]; return 1; }
      if (sql.includes('INSERT INTO platform_audit_logs')) return 1;
      throw new Error(`Unexpected fixture mutation: ${sql}`);
    },
  };
  const db = { $transaction: async (fn) => fn(tx) };
  const before = await getPlatformTenantDetail(db, actorUserId, tenantId);
  assert.equal(before.version, 1);
  await setTenantStatus(db, { actorUserId, tenantId, status: 'ACTIVE', reason: 'fixture', expectedVersion: before.version });
  const detail = await getPlatformTenantDetail(db, actorUserId, tenantId);
  assert.equal(detail.version, 2);
  assert.equal(detail.limitsVersion, 1);
  const input = { actorUserId, tenantId, limits: detail.limits, flags: detail.flags, reason: 'fixture' };
  await assert.rejects(updateTenantLimits(db, { ...input, expectedVersion: detail.version }),
    (error) => error.code === 'STALE_VERSION');
  assert.equal(limits.version, 1, 'rejected update must not change limits');
  assert.deepEqual(await updateTenantLimits(db, { ...input, expectedVersion: detail.limitsVersion }), { version: 2 });
  await assert.rejects(updateTenantLimits(db, { ...input, expectedVersion: 1 }),
    (error) => error.code === 'STALE_VERSION');
});
