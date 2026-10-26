'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp, createOpenApi } = require('../dist/app');
const { IdentityError } = require('@ticket/backend');

const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const actorId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const path = `/v1/tenants/${tenantId}/limits`;

function fixture() {
  let role = 'Owner';
  let revoked = false;
  let present = true;
  let consumed = 0;
  let snapshots = 0;
  const db = {
    $transaction: async (operation) => operation({
      $executeRaw: async () => 1,
      $queryRaw: async (strings, ...values) => {
        const sql = strings.join('?');
        if (sql.includes('UPDATE notification_rate_counters')) {
          assert.equal(values[0], actorId);
          assert.equal(values[1], 'api.tenant-limits.read');
          assert.equal(values[3], 240);
          consumed++;
          return consumed <= 240 ? [{ count: consumed }] : [];
        }
        if (sql.includes('FROM memberships') && sql.includes('FOR SHARE')) {
          return present ? [{
            id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            tenant_id: tenantId, user_id: actorId, role,
            permissions: role === 'Owner' ? ['tenant.profile'] : ['report.read'],
            activated_at: new Date(0), revoked_at: revoked ? new Date() : null,
          }] : [];
        }
        if (sql.includes('FROM tenant_limits lim')) {
          snapshots++;
          return [{
            max_events: 10, max_staff: null, email_per_day: 20,
            import_rows_per_job: null, events: 2, staff_active: 1,
            staff_pending: 0, email_today: 3,
            as_of: new Date('2026-10-26T01:02:03.000Z'), email_usage_date: '2026-10-26',
          }];
        }
        return [];
      },
    }),
  };
  return {
    db,
    setRole: (value) => { role = value; },
    setRevoked: (value) => { revoked = value; },
    setPresent: (value) => { present = value; },
    get consumed() { return consumed; },
    get snapshots() { return snapshots; },
  };
}

async function appFor(f) {
  const app = await createApp({
    logging: false, database: f.db,
    oidcVerifier: { verifyBearerToken: async (header) => {
      if (header !== 'Bearer fixture') throw new IdentityError('UNAUTHENTICATED', 'Bearer required');
      return { subject: 'fixture' };
    } },
    users: { upsertFromVerifiedIdentity: async () => ({ userId: actorId }) },
  });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

test('G-10 API raw query, bearer, RBAC, non-enumeration and DTO', async () => {
  const f = fixture();
  const app = await appFor(f);
  try {
    for (const suffix of ['?x=1', '?x=1&x=1', '?x=', '?limit=1']) {
      const res = await app.inject({ method: 'GET', url: path + suffix });
      assert.equal(res.statusCode, 422, suffix);
      assert.equal(res.json().code, 'INVALID_FILTER');
      assert.equal(res.headers['cache-control'], 'private, no-store');
    }
    assert.equal(f.consumed, 0);
    const missingBearer = await app.inject({ method: 'GET', url: path });
    assert.equal(missingBearer.statusCode, 401);
    assert.equal(f.consumed, 0);
    const call = () => app.inject({ method: 'GET', url: path, headers: { authorization: 'Bearer fixture' } });
    f.setRole('Manager');
    const forbidden = await call();
    assert.equal(forbidden.statusCode, 403);
    assert.equal(f.consumed, 0);
    f.setRole('Owner');
    f.setRevoked(true);
    const revoked = await call();
    assert.equal(revoked.statusCode, 404);
    f.setRevoked(false);
    f.setPresent(false);
    const foreign = await call();
    assert.equal(foreign.statusCode, 404);
    assert.deepEqual(foreign.json(), { ...revoked.json(), requestId: foreign.json().requestId });
    assert.equal(f.consumed, 0);
    f.setPresent(true);
    const ok = await call();
    assert.equal(ok.statusCode, 200);
    assert.equal(ok.headers['cache-control'], 'private, no-store');
    assert.deepEqual(ok.json(), {
      tenantId,
      limits: { maxEvents: 10, maxStaff: null, emailPerDay: 20, importRowsPerJob: null },
      usage: { events: 2, staffActive: 1, staffPendingInvites: 0, emailToday: 3 },
      asOf: '2026-10-26T01:02:03.000Z', emailUsageDate: '2026-10-26',
    });
    assert.doesNotMatch(ok.body, /emailAddress|contact|status|token|secret/i);
    assert.equal(f.snapshots, 1);
    const operation = createOpenApi(app).paths['/v1/tenants/{tenantId}/limits'].get;
    assert.equal(operation.responses['200'].content['application/json'].schema.$ref,
      '#/components/schemas/TenantLimitsUsageReadResponseDto');
    assert.equal((operation.parameters ?? []).filter((p) => p.in === 'query').length, 0);
    assert.deepEqual(Object.keys(operation.responses).sort(),
      ['200', '401', '403', '404', '422', '429', '503']);
    assert.ok(operation.responses['429'].headers['Retry-After']);
  } finally { await app.close(); }
});

test('G-10 API limiter runs after authorization and returns its UTC window retry', async () => {
  const f = fixture();
  const app = await appFor(f);
  try {
    for (let i = 0; i < 240; i++) {
      const res = await app.inject({ method: 'GET', url: path, headers: { authorization: 'Bearer fixture' } });
      assert.equal(res.statusCode, 200, `read ${i + 1}`);
    }
    const denied = await app.inject({ method: 'GET', url: path, headers: { authorization: 'Bearer fixture' } });
    assert.equal(denied.statusCode, 429);
    assert.equal(denied.json().code, 'RATE_LIMITED');
    assert.equal(denied.json().retryable, true);
    assert.match(denied.headers['retry-after'], /^[1-9][0-9]*$/);
    assert.ok(Number(denied.headers['retry-after']) <= 3600);
    assert.equal(denied.headers['cache-control'], 'private, no-store');
    assert.equal(f.snapshots, 240);
  } finally { await app.close(); }
});
