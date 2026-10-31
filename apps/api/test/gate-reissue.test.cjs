'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createApp } = require('../dist/app');

const tenantId = randomUUID();
const eventId = randomUUID();
const ticketId = randomUUID();
const actorId = randomUUID();
const membershipId = randomUUID();
const url = `/v1/gate/events/${eventId}/tickets/${ticketId}/reissue`;

test('reissue HTTP requires reason and UUID idempotency key; CS is forbidden', async () => {
  let assigned = true;
  const tx = {
    $queryRaw: async (strings) => {
      const sql = strings.join('?');
      if (sql.includes('set_config')) return [{}];
      if (sql.includes('FROM memberships')) {
        return [{
          id: membershipId, tenant_id: tenantId, user_id: actorId,
          role: 'STAFF', permissions: ['cs.lookup', 'cs.resend'],
          activated_at: new Date(0), revoked_at: null,
        }];
      }
      if (sql.includes('FROM event_assignments')) {
        return assigned ? [{
          id: randomUUID(), tenant_id: tenantId, event_id: eventId,
          membership_id: membershipId,
          permissions: ['cs.lookup', 'cs.resend'],
          activated_at: new Date(0), revoked_at: null,
        }] : [];
      }
      throw new Error(`unexpected query: ${sql}`);
    },
  };
  const db = {
    $transaction: async (work) => work(tx),
    $disconnect: async () => {},
  };
  const app = await createApp({
    logging: false,
    database: db,
    oidcVerifier: { verifyBearerToken: async () => ({ subject: 'cs' }) },
    users: { upsertFromVerifiedIdentity: async () => ({ userId: actorId }) },
    credentialKey: 'local-test-key-for-reissue',
  });
  try {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const send = (body, key) => app.inject({
      method: 'POST', url,
      headers: {
        authorization: 'Bearer fixture',
        ...(key ? { 'idempotency-key': key } : {}),
      },
      payload: { tenantId, ...body },
    });
    for (const reason of [undefined, '', '  ']) {
      const res = await send(reason === undefined ? {} : { reason }, randomUUID());
      assert.equal(res.statusCode, 422);
    }
    const missingKey = await send({ reason: 'replace QR' });
    assert.equal(missingKey.statusCode, 422);
    const malformedKey = await send({ reason: 'replace QR' }, 'not-a-uuid');
    assert.equal(malformedKey.statusCode, 422);
    const forbidden = await send({ reason: 'replace QR' }, randomUUID());
    assert.equal(forbidden.statusCode, 403);
    assert.equal(forbidden.json().code, 'PERMISSION_DENIED');
    assert.equal(forbidden.headers['cache-control'], 'private, no-store');
    assigned = false;
    const unassigned = await send({ reason: 'replace QR' }, randomUUID());
    assert.equal(unassigned.statusCode, 403);
    assert.equal(unassigned.json().code, 'EVENT_ASSIGNMENT_REQUIRED');
  } finally {
    await app.close();
  }
});
