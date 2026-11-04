'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PlatformOperatorService } = require('../dist/platform/platform-operator.service');

test('legacy tenant version cannot overwrite concurrent limits update', async () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const actorUserId = '22222222-2222-4222-8222-222222222222';
  const state = { version: 1, maxEvents: 10, writes: 0 };
  const tx = {
    async $executeRawUnsafe() {},
    async $queryRaw(parts) {
      const sql = parts.join('?');
      if (sql.includes('set_config')) return [];
      if (sql.includes('FROM platform_operators')) return [{ user_id: actorUserId, revoked_at: null, activated_at: new Date(0) }];
      if (sql.includes('FROM tenant_limits')) return [{ version: state.version }];
      if (sql.includes('platform_tenant_usage_counts')) return [{ events: 0, staff_active: 0 }];
      throw Error(`Unexpected query: ${sql}`);
    },
    async $executeRaw(parts, ...values) {
      if (!parts.join('?').includes('UPDATE tenant_limits')) throw Error('Unexpected mutation');
      state.maxEvents = values[0]; state.version = values[6]; state.writes++;
      return 1;
    },
  };
  const service = new PlatformOperatorService({ db: { $transaction: async (fn) => fn(tx) } },
    { platformActor: async () => ({ userId: actorUserId }) });
  const limits = { maxEvents: 20, maxStaff: 10, emailPerDay: 10, importRowsPerJob: 10 };
  const flags = { importsEnabled: true, exportsEnabled: true };
  const body = { limits, flags, reason: 'fixture' };
  const oldClient = { ...body, expectedVersion: 2, limits: { ...limits, maxEvents: 30 } };
  assert.deepEqual(await service.setLimits('fixture', tenantId, { ...body, expectedLimitsVersion: 1 }), { version: 2 });
  await assert.rejects(service.setLimits('fixture', tenantId, oldClient), (e) => e.getStatus() === 422);
  await assert.rejects(service.setLimits('fixture', tenantId, { ...body, expectedVersion: 2, expectedLimitsVersion: 2 }), (e) => e.getStatus() === 422);
  assert.deepEqual(state, { version: 2, maxEvents: 20, writes: 1 });
  await assert.rejects(service.setLimits('fixture', tenantId, { ...body, expectedLimitsVersion: 1 }), (e) => e.getStatus() === 409);
  assert.deepEqual(state, { version: 2, maxEvents: 20, writes: 1 });
  assert.deepEqual(await service.setLimits('fixture', tenantId, { ...body, expectedLimitsVersion: 2 }), { version: 3 });
});
