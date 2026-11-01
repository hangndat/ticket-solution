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

test(
  '[POL-01] F01/F02 field matrix: PG+IdP complete ≤30d; PII scrubbed; device rows deleted; audit retained',
  { timeout: 240000 },
  async () => {
    const pg = await startPostgres();
    const db = createDatabase(pg.url, 4);
    const admin = new Client({ connectionString: pg.adminUrl });
    try {
      await admin.connect();
      const users = createPrismaIdentityUserRepository(db, { env });
      const subject = randomUUID();
      const user = await users.upsertFromVerifiedIdentity({
        issuer,
        subject,
        email: `${subject}@example.test`,
        emailVerified: true,
      });

      const tenantId = randomUUID();
      const eventId = randomUUID();
      await admin.query(
        `INSERT INTO tenants (id, slug, name) VALUES ($1, 'pol01-t', 'POL01')`,
        [tenantId],
      );
      await admin.query(
        `INSERT INTO events (tenant_id, id, slug, name) VALUES ($1, $2, 'pol01-e', 'POL01 Event')`,
        [tenantId, eventId],
      );
      await admin.query(
        `INSERT INTO event_attendees (tenant_id, event_id, id, user_id, canonical_email)
         VALUES ($1, $2, $3, $4, $5)`,
        [tenantId, eventId, randomUUID(), user.userId, `${subject}@example.test`],
      );
      await admin.query(
        `INSERT INTO staff_sessions (tenant_id, event_id, id, user_id, status)
         VALUES ($1, $2, $3, $4, 'ACTIVE')`,
        [tenantId, eventId, randomUUID(), user.userId],
      );
      await admin.query(
        `INSERT INTO device_tokens (id, user_id, token, environment, created_at, updated_at)
         VALUES
           ($1, $2, 'pol01-active-device-000001', 'sandbox', now(), now()),
           ($3, $2, 'pol01-revoked-device-00002', 'production', now(), now())`,
        [randomUUID(), user.userId, randomUUID()],
      );
      await admin.query(
        `UPDATE device_tokens SET revoked_at = now()
         WHERE user_id = $1 AND token = 'pol01-revoked-device-00002'`,
        [user.userId],
      );
      const auditId = randomUUID();
      await admin.query(
        `INSERT INTO audit_logs (tenant_id, event_id, id, actor_user_id, action, resource_type)
         VALUES ($1, $2, $3, $4, 'account.deletion_ack', 'account')`,
        [tenantId, eventId, auditId, user.userId],
      );

      const ack = await createAccountDeletionRequest(db, {
        userId: user.userId,
        confirmation: true,
      });
      const idp = createFakeKeycloakErasureAdapter({
        deleteUserBySubject: async () => ({ kind: 'DELETED' }),
      });
      const result = await processDueAccountAnonymizations(db, 10, {
        env,
        keyring: readTombstoneKeyring(env),
        idp,
        leaseOwner: `pol01-field-${randomUUID()}`,
      });
      assert.equal(result.applied, 1);
      assert.equal(result.completed, 1);

      // F01: both PG and IdP timestamps fall inside the ≤30d deadline.
      const req = await admin.query(
        `SELECT requested_at, pg_applied_at, idp_deleted_at, state,
                original_issuer, original_subject, subject_tombstone_digest
         FROM account_deletion_requests WHERE id = $1`,
        [ack.requestId],
      );
      const row = req.rows[0];
      assert.equal(row.state, 'COMPLETED');
      const deadlineMs = row.requested_at.getTime() + 30 * 24 * 60 * 60 * 1000;
      assert.ok(row.pg_applied_at.getTime() <= deadlineMs, 'pg_applied_at ≤ deadline');
      assert.ok(row.idp_deleted_at.getTime() <= deadlineMs, 'idp_deleted_at ≤ deadline');

      // F02: field matrix — sensitive PII gone, minimal record retained.
      assert.equal(row.original_issuer, null);
      assert.equal(row.original_subject, null);
      assert.ok(row.subject_tombstone_digest, 'tombstone digest retained');

      const u = await admin.query(
        `SELECT email, email_verified, subject FROM users WHERE id = $1`,
        [user.userId],
      );
      assert.equal(u.rows[0].email, null);
      assert.equal(u.rows[0].email_verified, false);
      assert.equal(u.rows[0].subject, `anon:${ack.requestId}`);

      const devices = await admin.query(
        `SELECT count(*)::int AS n FROM device_tokens WHERE user_id = $1`,
        [user.userId],
      );
      assert.equal(devices.rows[0].n, 0, 'device registration hard-deleted');

      const attendee = await admin.query(
        `SELECT canonical_email FROM event_attendees
         WHERE tenant_id = $1 AND user_id = $2`,
        [tenantId, user.userId],
      );
      assert.equal(attendee.rows[0].canonical_email, null);

      const session = await admin.query(
        `SELECT status FROM staff_sessions WHERE tenant_id = $1 AND user_id = $2`,
        [tenantId, user.userId],
      );
      assert.equal(session.rows[0].status, 'REVOKED');

      const audit = await admin.query(
        `SELECT count(*)::int AS n FROM audit_logs WHERE id = $1`,
        [auditId],
      );
      assert.equal(audit.rows[0].n, 1, 'audit row retained (O06 TTL 730d)');
    } finally {
      await admin.end().catch(() => {});
      await db.$disconnect().catch(() => {});
      pg.stop();
    }
  },
);
