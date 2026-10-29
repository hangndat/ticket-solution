'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('../../../packages/backend/node_modules/pg');
const {
  createDatabase,
  createPrismaIdentityUserRepository,
  createAccountDeletionRequest,
  processDueAccountAnonymizations,
  createFakeKeycloakErasureAdapter,
  readTombstoneKeyring,
} = require('../../../packages/backend/dist');
const { startPostgres } = require('./pg-fixture.cjs');

const issuer = 'https://e2e-idp.example.test/realms/e2e';
const env = {
  OIDC_ISSUER: issuer,
  ACCOUNT_DELETION_TOMBSTONE_CURRENT_KEY_ID: 'e2e-k1',
  ACCOUNT_DELETION_TOMBSTONE_KEYRING_JSON: JSON.stringify([
    {
      keyId: 'e2e-k1',
      secretBase64: Buffer.alloc(32, 29).toString('base64'),
    },
  ]),
};

test(
  '[POL-01] account deletion crosses 30-day SLA boundary, retries IdP and retains tombstone',
  { timeout: 240000 },
  async () => {
    const pg = await startPostgres();
    const db = createDatabase(pg.url, 4);
    const admin = new Client({ connectionString: pg.adminUrl });
    try {
      await admin.connect();
      const users = createPrismaIdentityUserRepository(db, { env });
      const requests = [];
      for (const offset of [29, 31]) {
        const subject = randomUUID();
        const user = await users.upsertFromVerifiedIdentity({
          issuer,
          subject,
          email: `${subject}@example.test`,
          emailVerified: true,
        });
        const ack = await createAccountDeletionRequest(db, {
          userId: user.userId,
          confirmation: true,
        });
        assert.equal(ack.anonymizeWithinDays, 30);
        requests.push({ ...ack, userId: user.userId });
        await admin.query(
          `UPDATE account_deletion_requests
          SET requested_at = clock_timestamp() - ($2::integer * interval '1 day')
          WHERE id = $1`,
          [ack.requestId, offset],
        );
      }

      // Missing provider keeps the durable request open, even after PG scrub.
      const first = await processDueAccountAnonymizations(db, 10, {
        env,
        keyring: readTombstoneKeyring(env),
        idp: null,
        leaseOwner: `pol01-${randomUUID()}`,
      });
      assert.equal(first.scanned, 2);
      assert.equal(first.applied, 2);
      assert.equal(first.completed, 0);
      const overdue =
        await admin.query(`SELECT count(*)::int AS n FROM account_deletion_requests
        WHERE state = 'REQUESTED' AND policy_version IS NOT NULL
          AND requested_at < clock_timestamp() - interval '30 days'`);
      assert.equal(
        overdue.rows[0].n,
        1,
        'one request is beyond the 30-day SLA',
      );
      const actorlessRows = await db.$queryRaw`
        SELECT count(*)::int AS n FROM account_deletion_requests
      `;
      assert.equal(actorlessRows[0].n, 0, 'runtime still cannot read cross-actor rows');
      assert.equal(first.slaOverdue, overdue.rows[0].n);
      const pending = await admin.query(`SELECT id, state, pg_applied_at,
        subject_tombstone_digest FROM account_deletion_requests ORDER BY requested_at`);
      assert.equal(pending.rows.length, 2);
      for (const row of pending.rows) {
        assert.equal(row.state, 'REQUESTED');
        assert.ok(row.pg_applied_at);
        assert.ok(row.subject_tombstone_digest);
      }

      await admin.query(
        `UPDATE account_deletion_requests
        SET idp_next_attempt_at = clock_timestamp() - interval '1 second',
            idp_lease_expires_at = clock_timestamp() - interval '1 second'
        WHERE id = ANY($1::uuid[])`,
        [requests.map((x) => x.requestId)],
      );
      let providerCalls = 0;
      const idp = createFakeKeycloakErasureAdapter({
        deleteUserBySubject: async () => {
          providerCalls++;
          return { kind: 'DELETED' };
        },
      });
      const second = await processDueAccountAnonymizations(db, 10, {
        env,
        keyring: readTombstoneKeyring(env),
        idp,
        leaseOwner: `pol01-${randomUUID()}`,
      });
      assert.equal(second.completed, 2);
      assert.equal(second.applied, 0);
      assert.equal(second.slaOverdue, 0);
      assert.equal(providerCalls, 2);
      const completed = await admin.query(
        `SELECT state, original_issuer, original_subject,
        subject_tombstone_digest, pg_applied_at FROM account_deletion_requests
        WHERE id = ANY($1::uuid[])`,
        [requests.map((x) => x.requestId)],
      );
      for (const row of completed.rows) {
        assert.equal(row.state, 'COMPLETED');
        assert.equal(row.original_issuer, null);
        assert.equal(row.original_subject, null);
        assert.ok(row.subject_tombstone_digest);
        assert.ok(row.pg_applied_at);
      }
      const third = await processDueAccountAnonymizations(db, 10, {
        env,
        keyring: readTombstoneKeyring(env),
        idp,
        leaseOwner: `pol01-${randomUUID()}`,
      });
      assert.equal(third.completed, 0);
      assert.equal(providerCalls, 2);
    } finally {
      await admin.end().catch(() => {});
      await db.$disconnect().catch(() => {});
      pg.stop();
    }
  },
);
