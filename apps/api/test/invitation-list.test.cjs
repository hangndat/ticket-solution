const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp, createOpenApi } = require('../dist/app');
const { IdentityError } = require('@ticket/backend');

const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const eventId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const invitationId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const path = `/v1/tenants/${tenantId}/events/${eventId}/invitations`;

test('G-08 API validates raw invitation query and documents exact-ID lookup', async () => {
  const app = await createApp(false);
  try {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    for (const suffix of [
      '?unexpected=x',
      '?q=x&q=x',
      '?state=PENDING&state=PENDING',
      '?limit=1&limit=1',
      '?q=',
      '?q=ada@example.com',
      '?q=cccccccc',
      '?state=',
      '?state=UNKNOWN',
      '?limit=',
      '?limit=0',
      '?limit=101',
      '?limit=1.0',
    ]) {
      const response = await app.inject({ method: 'GET', url: path + suffix });
      assert.equal(response.statusCode, 422, suffix);
      assert.equal(response.json().code, 'INVALID_FILTER', suffix);
      assert.equal(response.headers['cache-control'], 'private, no-store');
    }
    for (const suffix of [
      '?cursor=',
      '?cursor=garbage',
      `?q=${invitationId}&cursor=`,
      `?q=${invitationId}&cursor=${invitationId}`,
    ]) {
      const response = await app.inject({ method: 'GET', url: path + suffix });
      assert.equal(response.statusCode, 422, suffix);
      assert.equal(response.json().code, 'INVALID_CURSOR', suffix);
    }
    const operation =
      createOpenApi(app).paths[
        '/v1/tenants/{tenantId}/events/{eventId}/invitations'
      ].get;
    assert.deepEqual(
      operation.parameters
        .filter((p) => p.in === 'query')
        .map((p) => p.name)
        .sort(),
      ['cursor', 'limit', 'q', 'state'],
    );
    assert.equal(
      operation.responses['200'].content['application/json'].schema.$ref,
      '#/components/schemas/InvitationListPageDto',
    );
  } finally {
    await app.close();
  }
});

test('G-08 API requires bearer, masks q result, and bounds reads with Retry-After', async () => {
  const actorId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const membershipId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
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
            assert.equal(values[1], 'api.invitations.list');
            assert.equal(values[3], 240);
            consumed++;
            return consumed <= 2 ? [{ count: consumed }] : [];
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
                id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
                tenant_id: tenantId,
                event_id: eventId,
                membership_id: membershipId,
                permissions: ['inventory.import'],
                activated_at: new Date(0),
                revoked_at: null,
              },
            ];
          if (sql.includes('FROM guest_invitations')) {
            listQueries++;
            assert.ok(sql.includes('AND id = ?::uuid'));
            assert.ok(values.includes(invitationId));
            return [
              {
                id: invitationId,
                event_id: eventId,
                source_id: tenantId,
                ticket_type_id: tenantId,
                invited_email: 'ada@example.com',
                state: 'PENDING',
                expires_at: new Date('2030-01-01T00:00:00Z'),
              },
            ];
          }
          return [];
        },
      }),
  };
  const app = await createApp({
    logging: false,
    database,
    hmac: { pepper: 'fixture-key', version: 1 },
    oidcVerifier: {
      verifyBearerToken: async (authorization) => {
        if (authorization !== 'Bearer fixture')
          throw new IdentityError('UNAUTHENTICATED', 'Bearer required');
        return { subject: 'fixture' };
      },
    },
    users: { upsertFromVerifiedIdentity: async () => ({ userId: actorId }) },
  });
  try {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const unauthorized = await app.inject({
      method: 'GET',
      url: path + `?q=${invitationId}`,
    });
    assert.equal(unauthorized.statusCode, 401);
    assert.equal(consumed, 0);
    for (let i = 0; i < 2; i++) {
      const response = await app.inject({
        method: 'GET',
        url: path + `?q=${invitationId}`,
        headers: { authorization: 'Bearer fixture' },
      });
      assert.equal(response.statusCode, 200);
      assert.equal(response.headers['cache-control'], 'private, no-store');
      assert.equal(response.json().nextCursor, null);
      assert.equal(response.json().items.length, 1);
      assert.ok(response.json().items[0].invitedEmailMasked.includes('***'));
      assert.ok(!response.body.includes('ada@example.com'));
    }
    const denied = await app.inject({
      method: 'GET',
      url: path + `?q=${invitationId}`,
      headers: { authorization: 'Bearer fixture' },
    });
    assert.equal(denied.statusCode, 429);
    assert.equal(denied.json().code, 'RATE_LIMITED');
    assert.match(denied.headers['retry-after'], /^[1-9][0-9]*$/);
    assert.equal(denied.headers['cache-control'], 'private, no-store');
    assert.equal(listQueries, 2);
  } finally {
    await app.close();
  }
});

test('G-08 API hides missing event assignments without hiding permission failures', async () => {
  const actorId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const membershipId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  let assignment = 'missing';
  let invitationReads = 0;
  const database = {
    $transaction: async (operation) =>
      operation({
        $executeRaw: async () => 1,
        $queryRaw: async (strings) => {
          const sql = strings.join('?');
          if (sql.includes('UPDATE notification_rate_counters'))
            return [{ count: 1 }];
          if (sql.includes('FROM memberships'))
            return [{
              id: membershipId,
              tenant_id: tenantId,
              user_id: actorId,
              role: 'OWNER',
              permissions: [],
              activated_at: new Date(0),
              revoked_at: null,
            }];
          if (sql.includes('FROM event_assignments')) {
            if (assignment === 'missing') return [];
            return [{
              id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
              tenant_id: tenantId,
              event_id: eventId,
              membership_id: membershipId,
              permissions: assignment === 'denied' ? ['report.read'] : ['inventory.import'],
              activated_at: new Date(0),
              revoked_at: assignment === 'revoked' ? new Date() : null,
            }];
          }
          if (sql.includes('FROM guest_invitations')) invitationReads++;
          return [];
        },
      }),
  };
  const app = await createApp({
    logging: false,
    database,
    hmac: { pepper: 'fixture-key', version: 1 },
    oidcVerifier: {
      verifyBearerToken: async () => ({ subject: 'fixture' }),
    },
    users: { upsertFromVerifiedIdentity: async () => ({ userId: actorId }) },
  });
  try {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    for (const state of ['missing', 'revoked', 'denied']) {
      assignment = state;
      const response = await app.inject({
        method: 'GET',
        url: path + `?q=${invitationId}`,
        headers: { authorization: 'Bearer fixture' },
      });
      assert.equal(response.statusCode, state === 'denied' ? 403 : 404, state);
      assert.equal(response.json().code, state === 'denied' ? 'PERMISSION_DENIED' : 'EVENT_NOT_FOUND', state);
      assert.equal(response.headers['cache-control'], 'private, no-store');
      assert.ok(!response.body.includes(invitationId));
    }
    assert.equal(invitationReads, 0);
  } finally {
    await app.close();
  }
});
