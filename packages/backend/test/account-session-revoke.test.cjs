'use strict';

/**
 * D13 SEC-1: apply_account_anonymization must revoke staff_sessions atomically.
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
  processDueAccountAnonymizations,
  applyAccountAnonymization,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS = migrationFiles();

const HMAC = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'd13-session-revoke-pepper!',
  CODE_HMAC_VERSION: '1',
});

async function startIsolatedPostgres() {
  const name = 'ticket-d13-sess-rev-' + randomBytes(6).toString('hex');
  const password = randomBytes(24).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=d13_sess_revoke',
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
        'd13_sess_revoke',
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
      '/d13_sess_revoke',
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
      "CREATE ROLE d13_login LOGIN PASSWORD '" +
        password +
        "' NOSUPERUSER NOBYPASSRLS INHERIT",
    );
    await admin.query('GRANT ticket_runtime TO d13_login');
    return {
      name,
      url:
        'postgresql://d13_login:' +
        password +
        '@127.0.0.1:' +
        port +
        '/d13_sess_revoke',
    };
  } finally {
    await admin.end().catch(() => {});
  }
}

test(
  'SEC-1: anonymize revokes staff sessions; other user untouched; idempotent; audit kept',
  { timeout: 240000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 4);
      const users = createPrismaIdentityUserRepository(db);

      const staff = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'd13-staff-a',
        email: 'd13-staff-a@example.com',
        emailVerified: true,
      });
      const staffB = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'd13-staff-b',
        email: 'd13-staff-b@example.com',
        emailVerified: true,
      });
      const guest = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'd13-guest',
        email: 'd13-guest@example.com',
        emailVerified: true,
      });

      const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const tenantOther = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      const eventId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
      const eventOther = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

      await withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantId, slug: 'd13-sess-a', name: 'D13 A' },
        });
        await tx.event.create({
          data: {
            tenantId,
            id: eventId,
            slug: 'd13-event-a',
            name: 'D13 Event A',
            status: 'PUBLISHED',
          },
        });
        await seedEventInventory(tx, HMAC, {
          tenantId,
          eventId,
          eventQuota: 5,
          rawCodes: ['D13-A-CODE', 'D13-A-CODE-2'],
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
          data: { id: tenantOther, slug: 'd13-sess-b', name: 'D13 B' },
        });
        await tx.event.create({
          data: {
            tenantId: tenantOther,
            id: eventOther,
            slug: 'd13-event-b',
            name: 'D13 Event B',
            status: 'PUBLISHED',
          },
        });
        const membership = await grantMembership(tx, {
          tenantId: tenantOther,
          userId: staffB.userId,
          role: 'STAFF',
          permissions: ['gate.confirm', 'gate.undo', 'ticket.revoke'],
        });
        await grantEventAssignment(tx, {
          tenantId: tenantOther,
          eventId: eventOther,
          membershipId: membership.membershipId,
          permissions: ['gate.confirm', 'gate.undo', 'ticket.revoke'],
        });
        await seedEventInventory(tx, HMAC, {
          tenantId: tenantOther,
          eventId: eventOther,
          eventQuota: 3,
          rawCodes: ['D13-B-CODE'],
        });
      });

      const issued = unwrapRedeemOutcome(
        await withTenant(db, tenantId, (tx) =>
          redeemAndIssueTicket(tx, HMAC, 'd13-cred-key', {
            tenantId,
            eventId,
            actorUserId: guest.userId,
            actorEmail: guest.email,
            emailVerified: true,
            rawCode: 'D13-A-CODE',
            idempotencyKey: randomUUID(),
          }),
        ),
      );

      const sessionA = await withTenant(db, tenantId, (tx) =>
        openStaffSession(tx, { tenantId, eventId, userId: staff.userId }),
      );
      const sessionBSameTenant = await withTenant(db, tenantId, (tx) =>
        openStaffSession(tx, { tenantId, eventId, userId: staffB.userId }),
      );
      const sessionBOtherTenant = await withTenant(db, tenantOther, (tx) =>
        openStaffSession(tx, {
          tenantId: tenantOther,
          eventId: eventOther,
          userId: staffB.userId,
        }),
      );

      // Pre-anonymize: victim session is ACTIVE and usable for Gate.
      const beforeRows = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`
          SELECT status FROM staff_sessions
          WHERE id = ${sessionA.sessionId}::uuid AND status = 'ACTIVE'
        `,
      );
      assert.equal(beforeRows[0].status, 'ACTIVE');
      const preHold = await withTenant(db, tenantId, (tx) =>
        reserveCheckin(tx, {
          tenantId,
          eventId,
          ticketId: issued.ticketId,
          staffSessionId: sessionA.sessionId,
          actorUserId: staff.userId,
        }),
      );
      assert.ok(preHold);

      const auditBefore = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`SELECT count(*)::int AS n FROM audit_logs`,
      );
      assert.ok(auditBefore[0].n >= 1);

      const del = await createAccountDeletionRequest(db, {
        userId: staff.userId,
        confirmation: true,
      });
      assert.equal(del.state, 'REQUESTED');

      // Concurrent-ish second apply after first should be idempotent.
      const processed = await processDueAccountAnonymizations(db, 50);
      assert.equal(processed.scanned, 1);
      assert.equal(processed.applied, 1);

      const retry = await applyAccountAnonymization(db, del.requestId);
      assert.equal(retry.applied, false);

      const againProc = await processDueAccountAnonymizations(db, 50);
      assert.equal(againProc.applied, 0);

      const auditAfter = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`SELECT count(*)::int AS n FROM audit_logs`,
      );
      assert.equal(auditAfter[0].n, auditBefore[0].n);

      const sessionsVictim = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`
          SELECT status, revoked_at IS NOT NULL AS revoked
          FROM staff_sessions
          WHERE id = ${sessionA.sessionId}::uuid
            AND user_id = ${staff.userId}::uuid
        `,
      );
      assert.equal(sessionsVictim[0].status, 'REVOKED');
      assert.equal(sessionsVictim[0].revoked, true);

      // Gate assertSessionActive path rejects revoked session (fresh ticket, no prior hold).
      const issued2 = unwrapRedeemOutcome(
        await withTenant(db, tenantId, (tx) =>
          redeemAndIssueTicket(tx, HMAC, 'd13-cred-key', {
            tenantId,
            eventId,
            actorUserId: guest.userId,
            actorEmail: guest.email,
            emailVerified: true,
            rawCode: 'D13-A-CODE-2',
            idempotencyKey: randomUUID(),
          }),
        ),
      );
      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            reserveCheckin(tx, {
              tenantId,
              eventId,
              ticketId: issued2.ticketId,
              staffSessionId: sessionA.sessionId,
              actorUserId: staff.userId,
            }),
          ),
        (e) =>
          e instanceof GateError &&
          e.code === GATE_ERROR_CODES.SESSION_NOT_ACTIVE,
      );

      // Other staff same tenant still ACTIVE.
      const otherSame = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`
          SELECT status FROM staff_sessions
          WHERE id = ${sessionBSameTenant.sessionId}::uuid
        `,
      );
      assert.equal(otherSame[0].status, 'ACTIVE');

      // Other tenant session for different user still ACTIVE.
      const otherTenant = await withTenant(db, tenantOther, (tx) =>
        tx.$queryRaw`
          SELECT status FROM staff_sessions
          WHERE id = ${sessionBOtherTenant.sessionId}::uuid
        `,
      );
      assert.equal(otherTenant[0].status, 'ACTIVE');

      // After COMPLETED: no ACTIVE sessions remain for victim in either tenant.
      const liveA = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`
          SELECT count(*)::int AS n FROM staff_sessions
          WHERE user_id = ${staff.userId}::uuid AND status = 'ACTIVE'
        `,
      );
      const liveB = await withTenant(db, tenantOther, (tx) =>
        tx.$queryRaw`
          SELECT count(*)::int AS n FROM staff_sessions
          WHERE user_id = ${staff.userId}::uuid AND status = 'ACTIVE'
        `,
      );
      assert.equal(liveA[0].n, 0);
      assert.equal(liveB[0].n, 0);
    } finally {
      if (db) await db.$disconnect().catch(() => {});
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
