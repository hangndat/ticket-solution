const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp, createOpenApi } = require('../dist/app');
const { IdentityError } = require('@ticket/backend');

const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const eventId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const path = `/v1/tenants/${tenantId}/events/${eventId}/imports`;

test('G-09 API validates raw import list query and documents the projection', async () => {
  const app = await createApp(false);
  try {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    for (const suffix of [
      '?unexpected=x',
      '?limit=1&limit=1',
      '?kind=CODES&kind=CODES',
      '?limit=0',
      '?limit=101',
      '?limit=1.0',
      '?limit=',
      '?status=UNKNOWN',
      '?kind=UNKNOWN',
      '?status=',
    ]) {
      const response = await app.inject({ method: 'GET', url: path + suffix });
      assert.equal(response.statusCode, 422, suffix);
      assert.equal(response.json().code, 'INVALID_FILTER', suffix);
      assert.equal(response.headers['cache-control'], 'private, no-store');
    }
    const emptyCursor = await app.inject({
      method: 'GET',
      url: path + '?cursor=',
    });
    assert.equal(emptyCursor.statusCode, 422);
    assert.equal(emptyCursor.json().code, 'INVALID_CURSOR');
    const malformedCursor = await app.inject({
      method: 'GET',
      url: path + '?cursor=garbage',
    });
    assert.equal(malformedCursor.statusCode, 422);
    assert.equal(malformedCursor.json().code, 'INVALID_CURSOR');
    const operation =
      createOpenApi(app).paths[
        '/v1/tenants/{tenantId}/events/{eventId}/imports'
      ].get;
    assert.deepEqual(
      operation.parameters
        .filter((p) => p.in === 'query')
        .map((p) => p.name)
        .sort(),
      ['cursor', 'kind', 'limit', 'status'],
    );
    assert.equal(
      operation.responses['200'].content['application/json'].schema.$ref,
      '#/components/schemas/ImportJobListPageDto',
    );
  } finally {
    await app.close();
  }
});

test('G-09 API requires bearer on every page and sends an empty private page', async () => {
  const actorId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const membershipId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  let listQueries = 0;
  const database = {
    $transaction: async (operation) =>
      operation({
        $executeRaw: async () => 1,
        $queryRaw: async (strings) => {
          const sql = strings.join('?');
          if (sql.includes('UPDATE notification_rate_counters'))
            return [{ count: 1 }];
          if (sql.includes('FROM memberships'))
            return [
              {
                id: membershipId,
                tenant_id: tenantId,
                user_id: actorId,
                role: 'OWNER',
                permissions: [],
                activated_at: new Date(0),
                revoked_at: null,
              },
            ];
          if (sql.includes('FROM event_assignments'))
            return [
              {
                id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
                tenant_id: tenantId,
                event_id: eventId,
                membership_id: membershipId,
                permissions: ['inventory.import'],
                activated_at: new Date(0),
                revoked_at: null,
              },
            ];
          if (sql.includes('FROM import_jobs')) {
            listQueries++;
            return [];
          }
          return [];
        },
      }),
  };
  const app = await createApp({
    logging: false,
    database,
    hmac: { pepper: 'fixture-cursor-signing-key', version: 1 },
    oidcVerifier: {
      verifyBearerToken: async (authorization) => {
        if (authorization !== 'Bearer fixture') {
          throw new IdentityError('UNAUTHENTICATED', 'Bearer required');
        }
        return { subject: 'fixture' };
      },
    },
    users: { upsertFromVerifiedIdentity: async () => ({ userId: actorId }) },
  });
  try {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const unauthorized = await app.inject({ method: 'GET', url: path });
    assert.equal(unauthorized.statusCode, 401);
    assert.equal(listQueries, 0);
    const response = await app.inject({
      method: 'GET',
      url: path + '?limit=1',
      headers: { authorization: 'Bearer fixture' },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['cache-control'], 'private, no-store');
    assert.deepEqual(response.json(), { items: [], nextCursor: null });
    assert.equal(listQueries, 1);
  } finally {
    await app.close();
  }
});

test('G-09 API limits authenticated list reads per user and returns Retry-After', async () => {
  const actorId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const membershipId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  let consumed = 0;
  let listQueries = 0;
  const database = {
    $transaction: async (operation) =>
      operation({
        $executeRaw: async () => 1,
        $queryRaw: async (strings, ...values) => {
          const sql = strings.join('?');
          if (sql.includes('UPDATE notification_rate_counters')) {
            assert.equal(values[0], actorId);
            assert.equal(values[1], 'api.import-jobs.list');
            assert.equal(values[3], 240);
            consumed++;
            return consumed <= 240 ? [{ count: consumed }] : [];
          }
          if (sql.includes('FROM memberships'))
            return [
              {
                id: membershipId,
                tenant_id: tenantId,
                user_id: actorId,
                role: 'OWNER',
                permissions: [],
                activated_at: new Date(0),
                revoked_at: null,
              },
            ];
          if (sql.includes('FROM event_assignments'))
            return [
              {
                id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
                tenant_id: tenantId,
                event_id: eventId,
                membership_id: membershipId,
                permissions: ['inventory.import'],
                activated_at: new Date(0),
                revoked_at: null,
              },
            ];
          if (sql.includes('FROM import_jobs')) {
            listQueries++;
            return [];
          }
          return [];
        },
      }),
  };
  const app = await createApp({
    logging: false,
    database,
    hmac: { pepper: 'fixture-cursor-signing-key', version: 1 },
    oidcVerifier: {
      verifyBearerToken: async (authorization) => {
        if (authorization !== 'Bearer fixture') {
          throw new IdentityError('UNAUTHENTICATED', 'Bearer required');
        }
        return { subject: 'fixture' };
      },
    },
    users: { upsertFromVerifiedIdentity: async () => ({ userId: actorId }) },
  });
  try {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const unauthorized = await app.inject({ method: 'GET', url: path });
    assert.equal(unauthorized.statusCode, 401);
    assert.equal(consumed, 0, 'bearer auth precedes the limiter');
    for (let i = 0; i < 240; i++) {
      const response = await app.inject({
        method: 'GET',
        url: path,
        headers: { authorization: 'Bearer fixture' },
      });
      assert.equal(response.statusCode, 200, `request ${i + 1}`);
    }
    const denied = await app.inject({
      method: 'GET',
      url: path,
      headers: { authorization: 'Bearer fixture' },
    });
    assert.equal(denied.statusCode, 429);
    assert.equal(denied.json().code, 'RATE_LIMITED');
    assert.equal(denied.json().retryable, true);
    assert.match(denied.headers['retry-after'], /^[1-9][0-9]*$/);
    assert.ok(Number(denied.headers['retry-after']) <= 3600);
    assert.equal(denied.headers['cache-control'], 'private, no-store');
    assert.equal(
      listQueries,
      240,
      'denied request must not run the list query',
    );
  } finally {
    await app.close();
  }
});
