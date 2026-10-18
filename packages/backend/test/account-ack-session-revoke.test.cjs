'use strict';

/**
 * D13 SEC-1 ACK: createAccountDeletionRequest revokes staff_sessions atomically.
 * Isolated Docker Postgres; does not stop other workers' DB containers.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { migrationFiles } = require('./migration-files.cjs');
const { Client } = require('pg');
const {
  createDatabase,
  withTenant,
  createPrismaIdentityUserRepository,
  seedEventInventory,
  redeemAndIssueTicket,
  unwrapRedeemOutcome,
  readCodeHmacEnvironment,
  grantMembership,
  grantEventAssignment,
  GateError,
  GATE_ERROR_CODES,
  openStaffSession,
  reserveCheckin,
  createAccountDeletionRequest,
  applyAccountAnonymization,
  processDueAccountAnonymizations,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS = migrationFiles();

const HMAC = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'd13-ack-session-revoke-pepper!',
  CODE_HMAC_VERSION: '1',
});

async function startIsolatedPostgres() {
  const name = 'ticket-d13-ack-sess-' + randomBytes(6).toString('hex');
  const password = randomBytes(24).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=d13_ack_sess',
    '-p',
    '127.0.0.1::5432',
    'postgres:18.1-alpine',
  );
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      docker(
        'exec',
        name,
        'pg_isready',
        '-h',
        '127.0.0.1',
        '-U',
        'postgres',
        '-d',
        'd13_ack_sess',
      );
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  assert.ok(ready, 'task database must become ready');
  const port = docker('port', name, '5432/tcp').split(':').at(-1);
  const admin = new Client({
    connectionString:
      'postgresql://postgres:' +
      password +
      '@127.0.0.1:' +
      port +
      '/d13_ack_sess',
  });
  try {
    for (let i = 0; i < 30; i++) {
      try {
        await admin.connect();
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    await admin.query(
      'CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS',
    );
    await admin.query(
      'CREATE ROLE ticket_platform_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS',
    );
    await admin.query(
      'CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS',
    );
    await admin.query('GRANT CREATE, USAGE ON SCHEMA public TO migration_owner');
    await admin.query('SET ROLE migration_owner');
    for (const file of MIGRATIONS) {
      await admin.query(readFileSync(file, 'utf8'));
    }
    await admin.query('RESET ROLE');
    await admin.query(
      "CREATE ROLE d13_ack_login LOGIN PASSWORD '" +
        password +
        "' NOSUPERUSER NOBYPASSRLS INHERIT",
    );
    await admin.query('GRANT ticket_runtime TO d13_ack_login');
    return {
      name,
      url:
        'postgresql://d13_ack_login:' +
        password +
        '@127.0.0.1:' +
        port +
        '/d13_ack_sess',
      adminUrl:
        'postgresql://postgres:' +
        password +
        '@127.0.0.1:' +
        port +
        '/d13_ack_sess',
    };
  } finally {
    await admin.end().catch(() => {});
  }
}

async function seedTwoTenantStaff(db, users) {
  const staff = await users.upsertFromVerifiedIdentity({
    issuer: 'http://127.0.0.1:8080/realms/ticket',
    subject: 'd13-ack-staff-a',
    email: 'd13-ack-staff-a@example.com',
    emailVerified: true,
  });
  const staffB = await users.upsertFromVerifiedIdentity({
    issuer: 'http://127.0.0.1:8080/realms/ticket',
    subject: 'd13-ack-staff-b',
    email: 'd13-ack-staff-b@example.com',
    emailVerified: true,
  });
  const guest = await users.upsertFromVerifiedIdentity({
    issuer: 'http://127.0.0.1:8080/realms/ticket',
    subject: 'd13-ack-guest',
    email: 'd13-ack-guest@example.com',
    emailVerified: true,
  });

  const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const tenantOther = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const eventId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const eventOther = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

  await withTenant(db, tenantId, async (tx) => {
    await tx.tenant.create({
      data: { id: tenantId, slug: 'd13-ack-a', name: 'D13 ACK A' },
    });
    await tx.event.create({
      data: {
        tenantId,
        id: eventId,
        slug: 'd13-ack-event-a',
        name: 'D13 ACK Event A',
        status: 'PUBLISHED',
      },
    });
    await seedEventInventory(tx, HMAC, {
      tenantId,
      eventId,
      eventQuota: 5,
      rawCodes: ['D13-ACK-A', 'D13-ACK-A2'],
    });
    for (const userId of [staff.userId, staffB.userId]) {
      const membership = await grantMembership(tx, {
        tenantId,
        userId,
        role: 'STAFF',
        permissions: ['gate.confirm', 'gate.undo', 'ticket.revoke'],
      });
      await grantEventAssignment(tx, {
        tenantId,
        eventId,
        membershipId: membership.membershipId,
        permissions: ['gate.confirm', 'gate.undo', 'ticket.revoke'],
      });
    }
  });

  await withTenant(db, tenantOther, async (tx) => {
    await tx.tenant.create({
      data: { id: tenantOther, slug: 'd13-ack-b', name: 'D13 ACK B' },
    });
    await tx.event.create({
      data: {
        tenantId: tenantOther,
        id: eventOther,
        slug: 'd13-ack-event-b',
        name: 'D13 ACK Event B',
        status: 'PUBLISHED',
      },
    });
    const membership = await grantMembership(tx, {
      tenantId: tenantOther,
      userId: staff.userId,
      role: 'STAFF',
      permissions: ['gate.confirm', 'gate.undo', 'ticket.revoke'],
    });
    await grantEventAssignment(tx, {
      tenantId: tenantOther,
      eventId: eventOther,
      membershipId: membership.membershipId,
      permissions: ['gate.confirm', 'gate.undo', 'ticket.revoke'],
    });
    const membershipB = await grantMembership(tx, {
      tenantId: tenantOther,
      userId: staffB.userId,
      role: 'STAFF',
      permissions: ['gate.confirm', 'gate.undo', 'ticket.revoke'],
    });
    await grantEventAssignment(tx, {
      tenantId: tenantOther,
      eventId: eventOther,
      membershipId: membershipB.membershipId,
      permissions: ['gate.confirm', 'gate.undo', 'ticket.revoke'],
    });
    await seedEventInventory(tx, HMAC, {
      tenantId: tenantOther,
      eventId: eventOther,
      eventQuota: 3,
      rawCodes: ['D13-ACK-B'],
    });
  });

  return {
    staff,
    staffB,
    guest,
    tenantId,
    tenantOther,
    eventId,
    eventOther,
  };
}

test(
  'SEC-1 ACK: revoke at request; Gate denies; REJECTED keeps revoked; open blocked; apply idempotent',
  { timeout: 240000 },
  async () => {
    let name;
    let db;
    let admin;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 4);
      admin = new Client({ connectionString: boot.adminUrl });
      await admin.connect();
      const users = createPrismaIdentityUserRepository(db);
      const ctx = await seedTwoTenantStaff(db, users);
      const {
        staff,
        staffB,
        guest,
        tenantId,
        tenantOther,
        eventId,
        eventOther,
      } = ctx;

      const issued = unwrapRedeemOutcome(
        await withTenant(db, tenantId, (tx) =>
          redeemAndIssueTicket(tx, HMAC, 'd13-ack-cred', {
            tenantId,
            eventId,
            actorUserId: guest.userId,
            actorEmail: guest.email,
            emailVerified: true,
            rawCode: 'D13-ACK-A',
            idempotencyKey: randomUUID(),
          }),
        ),
      );

      const sessionA = await withTenant(db, tenantId, (tx) =>
        openStaffSession(tx, { tenantId, eventId, userId: staff.userId }),
      );
      const sessionAOther = await withTenant(db, tenantOther, (tx) =>
        openStaffSession(tx, {
          tenantId: tenantOther,
          eventId: eventOther,
          userId: staff.userId,
        }),
      );
      const sessionB = await withTenant(db, tenantId, (tx) =>
        openStaffSession(tx, { tenantId, eventId, userId: staffB.userId }),
      );

      const auditBefore = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`SELECT count(*)::int AS n FROM audit_logs`,
      );

      // ACK → sessions revoked atomically (before apply/COMPLETED).
      const del = await createAccountDeletionRequest(db, {
        userId: staff.userId,
        confirmation: true,
      });
      assert.equal(del.state, 'REQUESTED');

      const victimSessions = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`
          SELECT status FROM staff_sessions
          WHERE id = ${sessionA.sessionId}::uuid
        `,
      );
      assert.equal(victimSessions[0].status, 'REVOKED');

      const victimOtherTenant = await withTenant(db, tenantOther, (tx) =>
        tx.$queryRaw`
          SELECT status FROM staff_sessions
          WHERE id = ${sessionAOther.sessionId}::uuid
        `,
      );
      assert.equal(victimOtherTenant[0].status, 'REVOKED');

      const otherStaff = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`
          SELECT status FROM staff_sessions
          WHERE id = ${sessionB.sessionId}::uuid
        `,
      );
      assert.equal(otherStaff[0].status, 'ACTIVE');

      // Gate old session denies after ACK.
      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            reserveCheckin(tx, {
              tenantId,
              eventId,
              ticketId: issued.ticketId,
              staffSessionId: sessionA.sessionId,
              actorUserId: staff.userId,
            }),
          ),
        (e) =>
          e instanceof GateError &&
          e.code === GATE_ERROR_CODES.SESSION_NOT_ACTIVE,
      );

      // Cannot open a new staff session while REQUESTED is open.
      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            openStaffSession(tx, {
              tenantId,
              eventId,
              userId: staff.userId,
            }),
          ),
        (e) =>
          e instanceof GateError &&
          e.code === GATE_ERROR_CODES.ACCOUNT_DELETION_OPEN,
      );

      // Duplicate ACK idempotent: same requestId; still no side effects on others.
      const again = await createAccountDeletionRequest(db, {
        userId: staff.userId,
        confirmation: true,
      });
      assert.equal(again.requestId, del.requestId);

      const auditMid = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`SELECT count(*)::int AS n FROM audit_logs`,
      );
      assert.equal(auditMid[0].n, auditBefore[0].n);

      // REJECTED does NOT reactivate old sessions; new open allowed after reject.
      await admin.query(
        `UPDATE account_deletion_requests
         SET state = 'REJECTED', updated_at = clock_timestamp()
         WHERE id = $1`,
        [del.requestId],
      );

      const stillRevoked = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`
          SELECT status FROM staff_sessions
          WHERE id = ${sessionA.sessionId}::uuid
        `,
      );
      assert.equal(stillRevoked[0].status, 'REVOKED');

      const fresh = await withTenant(db, tenantId, (tx) =>
        openStaffSession(tx, {
          tenantId,
          eventId,
          userId: staff.userId,
        }),
      );
      assert.equal(fresh.status, 'ACTIVE');
      assert.notEqual(fresh.sessionId, sessionA.sessionId);

      const auditAfterOpen = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`SELECT count(*)::int AS n FROM audit_logs`,
      );
      assert.ok(auditAfterOpen[0].n >= auditBefore[0].n);

      // Fresh open request again + apply remains idempotent; audit not deleted.
      const del2 = await createAccountDeletionRequest(db, {
        userId: staff.userId,
        confirmation: true,
      });
      assert.equal(del2.state, 'REQUESTED');
      const afterAck2 = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`
          SELECT status FROM staff_sessions
          WHERE id = ${fresh.sessionId}::uuid
        `,
      );
      assert.equal(afterAck2[0].status, 'REVOKED');

      const processed = await processDueAccountAnonymizations(db, 50);
      assert.equal(processed.applied, 1);
      const retry = await applyAccountAnonymization(db, del2.requestId);
      assert.equal(retry.applied, false);

      const auditAfterApply = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`SELECT count(*)::int AS n FROM audit_logs`,
      );
      assert.equal(auditAfterApply[0].n, auditAfterOpen[0].n);

      // Other staff never touched.
      const otherStill = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`
          SELECT status FROM staff_sessions
          WHERE id = ${sessionB.sessionId}::uuid
        `,
      );
      assert.equal(otherStill[0].status, 'ACTIVE');
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (admin) await admin.end().catch(() => {});
      if (name) {
        try {
          docker('rm', '-f', name);
        } catch {
          // ignore cleanup races
        }
      }
    }
  },
);

/**
 * Wait until another backend is blocked on the session-mutation advisory lock
 * for this user (barrier — not sleep-as-sync).
 */
async function waitForSessionLockWaiter(admin, userId, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const r = await admin.query(
      `SELECT count(*)::int AS n
       FROM pg_locks
       WHERE locktype = 'advisory'
         AND classid = 872341
         AND objid = hashtext($1::text)
         AND objsubid = 2
         AND NOT granted`,
      [userId],
    );
    if (r.rows[0].n > 0) return;
    await new Promise((res) => setTimeout(res, 10));
  }
  throw new Error(
    'timed out waiting for advisory lock waiter on lock_user_session_mutation',
  );
}

test(
  'SEC-R1: uncommitted raw INSERT cannot race ACK into ACTIVE+REQUESTED',
  { timeout: 300000 },
  async () => {
    let name;
    let db;
    let admin;
    let insertClient;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 4);
      admin = new Client({ connectionString: boot.adminUrl });
      await admin.connect();
      // Match production default; race is READ COMMITTED visibility.
      await admin.query('SHOW transaction_isolation');

      const users = createPrismaIdentityUserRepository(db);
      const ctx = await seedTwoTenantStaff(db, users);
      const { staff, tenantId, eventId } = ctx;

      insertClient = new Client({ connectionString: boot.url });
      await insertClient.connect();

      const ROUNDS = 40;
      let violations = 0;
      for (let round = 0; round < ROUNDS; round++) {
        await admin.query(
          `UPDATE account_deletion_requests
           SET state = 'REJECTED', updated_at = clock_timestamp()
           WHERE user_id = $1
             AND state IN ('REQUESTED', 'UNDER_REVIEW', 'AWAITING_POLICY')`,
          [staff.userId],
        );

        const sessionId = randomUUID();
        await insertClient.query('BEGIN ISOLATION LEVEL READ COMMITTED');
        await insertClient.query(
          `SELECT set_config('app.tenant_id', $1, true)`,
          [tenantId],
        );
        // Trigger takes lock_user_session_mutation via assert before EXISTS.
        await insertClient.query(
          `INSERT INTO staff_sessions (tenant_id, event_id, id, user_id, status)
           VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'ACTIVE')`,
          [tenantId, eventId, sessionId, staff.userId],
        );

        // ACK blocks on the same advisory lock until INSERT commits.
        const ackPromise = createAccountDeletionRequest(db, {
          userId: staff.userId,
          confirmation: true,
        });
        await waitForSessionLockWaiter(admin, staff.userId);
        await insertClient.query('COMMIT');
        const del = await ackPromise;
        assert.equal(del.state, 'REQUESTED');

        const check = await admin.query(
          `SELECT
             (SELECT count(*)::int FROM staff_sessions
              WHERE user_id = $1 AND status = 'ACTIVE') AS active_n,
             (SELECT count(*)::int FROM account_deletion_requests
              WHERE user_id = $1
                AND state IN ('REQUESTED', 'UNDER_REVIEW', 'AWAITING_POLICY')) AS open_n,
             (SELECT status FROM staff_sessions WHERE id = $2::uuid) AS sess_status`,
          [staff.userId, sessionId],
        );
        const { active_n: activeN, open_n: openN, sess_status: sessStatus } =
          check.rows[0];
        if (activeN > 0 && openN > 0) {
          violations += 1;
        }
        assert.equal(
          sessStatus,
          'REVOKED',
          `round ${round}: raw INSERT session must be revoked after ACK`,
        );
        assert.equal(
          activeN,
          0,
          `round ${round}: no ACTIVE staff_sessions while deletion open`,
        );
        assert.equal(openN, 1, `round ${round}: exactly one open deletion request`);
      }
      assert.equal(
        violations,
        0,
        'ACTIVE+REQUESTED must never co-exist (old trigger without lock fails ~40/40)',
      );
    } finally {
      if (insertClient) await insertClient.end().catch(() => {});
      if (db) await db.$disconnect().catch(() => {});
      if (admin) await admin.end().catch(() => {});
      if (name) {
        try {
          docker('rm', '-f', name);
        } catch {
          // ignore
        }
      }
    }
  },
);

test(
  'SEC-1 ACK: revoke failure rolls back REQUESTED insert',
  { timeout: 240000 },
  async () => {
    let name;
    let db;
    let admin;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 2);
      const users = createPrismaIdentityUserRepository(db);
      const staff = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'd13-ack-rollback',
        email: 'd13-ack-rollback@example.com',
        emailVerified: true,
      });

      admin = new Client({ connectionString: boot.adminUrl });
      await admin.connect();
      // Break helper so ACK transaction must fail after INSERT attempt path.
      await admin.query(
        'ALTER FUNCTION revoke_sessions_for_user(uuid) OWNER TO postgres',
      );
      await admin.query(`
        CREATE OR REPLACE FUNCTION revoke_sessions_for_user(p_user_id uuid)
        RETURNS integer
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $f$
        BEGIN
          RAISE EXCEPTION 'forced revoke failure for rollback test';
        END;
        $f$;
      `);
      await admin.query(
        'ALTER FUNCTION revoke_sessions_for_user(uuid) OWNER TO migration_owner',
      );
      await admin.query(
        'GRANT EXECUTE ON FUNCTION revoke_sessions_for_user(uuid) TO ticket_runtime',
      );

      await assert.rejects(
        () =>
          createAccountDeletionRequest(db, {
            userId: staff.userId,
            confirmation: true,
          }),
        (e) =>
          e instanceof Error &&
          String(e.message).includes('forced revoke failure'),
      );

      const rows = await admin.query(
        `SELECT count(*)::int AS n FROM account_deletion_requests
         WHERE user_id = $1`,
        [staff.userId],
      );
      assert.equal(rows.rows[0].n, 0);
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (admin) await admin.end().catch(() => {});
      if (name) {
        try {
          docker('rm', '-f', name);
        } catch {
          // ignore
        }
      }
    }
  },
);
