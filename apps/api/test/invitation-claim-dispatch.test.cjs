const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../dist/app');
const { IdentityError } = require('@ticket/backend');
const { createGateTestConfig } = require('./gate-test-config.cjs');

const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const eventId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const actorId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const credentialKey = 'fixture-credential-key';
const gateConfig = createGateTestConfig(credentialKey);
const claimPath = `/v1/tenants/${tenantId}/events/${eventId}/invitations/claim`;
const dispatchPath = `/v1/tenants/${tenantId}/events/${eventId}/invitations/dispatch`;

/** A database that must never be reached: pre-tenant validation throws first. */
function unreachableDb() {
  return {
    $transaction: async () => {
      throw new Error('unexpected tenant DB access');
    },
  };
}

function verifiedVerifier() {
  return {
    verifyBearerToken: async (authorization) => {
      if (authorization !== 'Bearer fixture')
        throw new IdentityError('UNAUTHENTICATED', 'Bearer required');
      return { subject: 'fixture' };
    },
  };
}

test('claim requires a verified email before touching tenant data (M06/TD §5.1)', async () => {
  const app = await createApp({
    logging: false,
    database: unreachableDb(),
    hmac: { pepper: 'fixture-key', version: 1 },
    credentialKey,
    env: { ...process.env, ...gateConfig.env },
    oidcVerifier: verifiedVerifier(),
    // No email/emailVerified on the identity record → claim must reject.
    users: { upsertFromVerifiedIdentity: async () => ({ userId: actorId }) },
  });
  try {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const response = await app.inject({
      method: 'POST',
      url: claimPath,
      headers: {
        authorization: 'Bearer fixture',
        'idempotency-key': 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      },
      payload: { token: 'f'.repeat(32) },
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().code, 'EMAIL_NOT_VERIFIED');
  } finally {
    await app.close();
  }
});

test('claim requires an idempotency key for a verified attendee', async () => {
  const app = await createApp({
    logging: false,
    database: unreachableDb(),
    hmac: { pepper: 'fixture-key', version: 1 },
    credentialKey,
    env: { ...process.env, ...gateConfig.env },
    oidcVerifier: verifiedVerifier(),
    users: {
      upsertFromVerifiedIdentity: async () => ({
        userId: actorId,
        email: 'ada@example.com',
        emailVerified: true,
      }),
    },
  });
  try {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const response = await app.inject({
      method: 'POST',
      url: claimPath,
      headers: { authorization: 'Bearer fixture' },
      payload: { token: 'f'.repeat(32) },
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().code, 'IDEMPOTENCY_KEY_REQUIRED');
  } finally {
    await app.close();
  }
});

test('dispatch requires an idempotency key before touching tenant data', async () => {
  const app = await createApp({
    logging: false,
    database: unreachableDb(),
    hmac: { pepper: 'fixture-key', version: 1 },
    oidcVerifier: verifiedVerifier(),
    users: { upsertFromVerifiedIdentity: async () => ({ userId: actorId }) },
  });
  try {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const response = await app.inject({
      method: 'POST',
      url: dispatchPath,
      headers: { authorization: 'Bearer fixture' },
      payload: {
        invitationIds: ['cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
        previewRevision: 1,
      },
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().code, 'IDEMPOTENCY_KEY_REQUIRED');
  } finally {
    await app.close();
  }
});
