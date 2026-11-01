const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PLATFORM_ERROR_CODES } = require('@ticket/contracts');
const { PlatformService } = require('../dist/platform');

const actorUserId = '11111111-1111-4111-8111-111111111111';
const eventTenantId = '22222222-2222-4222-8222-222222222222';
const foreignTenantId = '33333333-3333-4333-8333-333333333333';
const originalEventId = '44444444-4444-4444-8444-444444444444';

function supportGrantBody() {
  return {
    tenantId: foreignTenantId,
    eventId: originalEventId,
    scopes: ['cs.read'],
    reason: 'Investigate support request',
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
  };
}

function createService(db) {
  return new PlatformService({
    db,
    platformVerifier: {
      async verifyBearerToken() {
        return { issuer: 'https://issuer.test', subject: 'operator-1' };
      },
    },
    identityVerifier: null,
    users: {
      async upsertFromVerifiedIdentity() {
        return { userId: actorUserId };
      },
    },
    security: { supportTtlMaxSeconds: 3600 },
    bootError: null,
  });
}

function databaseError(code, postgresCode, message) {
  return Object.assign(new Error('Raw query failed'), {
    code,
    meta: { code: postgresCode, message },
  });
}

function createTransactionDatabase(insertError) {
  const committed = { grants: [], auditTenantIds: [] };
  let grantInsertAttempts = 0;
  let auditInsertAttempts = 0;
  const db = {
    async $transaction(operation) {
      const pending = { grants: [], auditTenantIds: [] };
      const tx = {
        async $executeRawUnsafe() {},
        async $queryRaw(strings) {
          const sql = strings.join('?');
          if (sql.includes('FROM platform_operators')) {
            return [
              {
                user_id: actorUserId,
                revoked_at: null,
                activated_at: new Date(0),
              },
            ];
          }
          return [];
        },
        async $executeRaw(strings, ...values) {
          const sql = strings.join('?');
          if (sql.includes('INSERT INTO support_grants')) {
            grantInsertAttempts += 1;
            if (insertError) throw insertError;
            pending.grants.push({ tenantId: values[0], eventId: values[3] });
          }
          if (sql.includes('INSERT INTO platform_audit_logs')) {
            auditInsertAttempts += 1;
            pending.auditTenantIds.push(values[5]);
          }
        },
      };

      const result = await operation(tx);
      committed.grants.push(...pending.grants);
      committed.auditTenantIds.push(...pending.auditTenantIds);
      return result;
    },
  };
  return {
    db,
    committed,
    get grantInsertAttempts() {
      return grantInsertAttempts;
    },
    get auditInsertAttempts() {
      return auditInsertAttempts;
    },
  };
}

test('foreign tenant/event support grant mismatch returns hidden 404 and commits no grant or audit', async () => {
  const body = supportGrantBody();
  const fkError = databaseError(
    'P2010',
    '23503',
    'Foreign key violation on support_grants_event_fk',
  );
  const store = createTransactionDatabase(fkError);
  const service = createService(store.db);

  await assert.rejects(
    () => service.supportGrant('Bearer platform-token', body),
    (error) => {
      assert.equal(error.getStatus(), 404);
      assert.equal(error.getResponse().code, PLATFORM_ERROR_CODES.RESOURCE_NOT_FOUND);
      assert.equal(error.getResponse().message, 'Resource not found');
      return true;
    },
  );

  assert.equal(store.grantInsertAttempts, 1);
  assert.equal(store.auditInsertAttempts, 0);
  assert.deepEqual(store.committed.grants, []);
  assert.deepEqual(store.committed.auditTenantIds, []);
  assert.notEqual(foreignTenantId, eventTenantId);
  assert.equal(body.eventId, originalEventId);
});

test('support grant API propagates unrelated database errors', async () => {
  const unrelatedError = databaseError(
    'P2010',
    '23503',
    'Foreign key violation on support_grants_operator_user_id_fkey',
  );
  const service = createService(createTransactionDatabase(unrelatedError).db);

  await assert.rejects(
    () => service.supportGrant('Bearer platform-token', supportGrantBody()),
    (error) => error === unrelatedError,
  );
});
