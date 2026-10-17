const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const {
  createDatabase,
  withTenant,
  createPrismaIdentityUserRepository,
  grantMembership,
  grantEventAssignment,
  seedEventInventory,
  readCodeHmacEnvironment,
  redeemAndIssueTicket,
  decideRedemption,
  expirePendingRequest,
  getOwnerRedemptionStatus,
  listStaffPendingRedemptions,
  saveEventConfigVersion,
  publishEventConfig,
  ISSUE_ERROR_CODES,
  APPROVAL_ERROR_CODES,
  APPROVAL_PENDING,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS = [
  '202610160001_foundation',
  '202610160002_d1_users',
  '202610160003_d1_membership',
  '202610160004_d2_issue_ticket',
  '202610170005_d3_gate',
  '202610170006_d4_config_publish',
  '202610170007_d4_manual_approval',
  '202610170008_d4_report_retry',
  '202610170009_n1_notification_delivery',
  '202610170010_e_be_event_lifecycle',
  '202610170011_b_be_config_assets',
  '202610170012_f_be_form_consent',
].map((name) =>
  path.join(__dirname, '../prisma/migrations', name, 'migration.sql'),
);

const HMAC = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'f-be-form-consent-pepper!!',
  CODE_HMAC_VERSION: '1',
});
const CRED = 'f-be-form-consent-cred-key';

const FORM = {
  formVersion: 'form-v1',
  fields: [
    { id: 'full_name', label: 'Full name', type: 'text', required: true },
    { id: 'email', label: 'Email', type: 'email', required: true },
    {
      id: 'shirt',
      label: 'Shirt',
      type: 'select',
      required: true,
      options: [
        { id: 's', label: 'S' },
        { id: 'm', label: 'M' },
      ],
    },
    { id: 'agree', label: 'Agree', type: 'checkbox', required: true },
  ],
};

const ANSWERS = {
  full_name: 'Ada',
  email: 'ada@example.com',
  shirt: 'm',
  agree: true,
};

async function startIsolatedPostgres() {
  const name = 'ticket-f-be-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=f_be_test',
    '-p',
    '127.0.0.1::5432',
    'postgres:18.1-alpine',
  );
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
        'f_be_test',
      );
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  const binding = docker('port', name, '5432/tcp');
  const port = binding.split(':').at(-1);
  const adminConfig = {
    connectionString:
      'postgresql://postgres:' + password + '@127.0.0.1:' + port + '/f_be_test',
    connectionTimeoutMillis: 1000,
    query_timeout: 8000,
  };
  let admin;
  for (let i = 0; i < 30; i++) {
    const candidate = new Client(adminConfig);
    try {
      await candidate.connect();
      await candidate.query('SELECT 1');
      admin = candidate;
      break;
    } catch {
      await candidate.end().catch(() => {});
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  assert.ok(admin);
  await admin.query(
    'CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS',
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
    "CREATE ROLE fbe_login LOGIN PASSWORD '" +
      password +
      "' NOSUPERUSER NOBYPASSRLS INHERIT",
  );
  await admin.query('GRANT ticket_runtime TO fbe_login');
  await admin.end();
  return {
    name,
    url:
      'postgresql://fbe_login:' +
      password +
      '@127.0.0.1:' +
      port +
      '/f_be_test',
  };
}

test(
  'F-BE: form/consent, pending expiry race, owner/staff status, no PII audit',
  { timeout: 240000 },
  async () => {
    const pg = await startIsolatedPostgres();
    const db = createDatabase(pg.url);
    const users = createPrismaIdentityUserRepository(db);
    const issuer = 'https://issuer.example/realms/fbe';
    try {
      const owner = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'owner',
        email: 'owner@example.com',
        emailVerified: true,
      });
      const staff = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'staff',
        email: 'staff@example.com',
        emailVerified: true,
      });
      const other = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'other',
        email: 'other@example.com',
        emailVerified: true,
      });

      const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const eventId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

      await withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantId, slug: 'fbe', name: 'FBE' },
        });
        await tx.event.create({
          data: {
            tenantId,
            id: eventId,
            slug: 'gala',
            name: 'Gala',
            status: 'DRAFT',
            maxTicketsPerAttendee: 2,
          },
        });
        const membership = await grantMembership(tx, {
          tenantId,
          userId: staff.userId,
          role: 'MANAGER',
          permissions: ['redemption.approve', 'event.config', 'event.publish'],
        });
        await grantEventAssignment(tx, {
          tenantId,
          eventId,
          membershipId: membership.membershipId,
          permissions: ['redemption.approve', 'event.config', 'event.publish'],
        });

        // AUTO inventory
        await seedEventInventory(tx, HMAC, {
          tenantId,
          eventId,
          eventQuota: 10,
          rawCodes: ['AUTO-1'],
          sourceName: 'AutoSource',
        });

        // MANUAL inventory (separate source/type via second seed would collide quota names —
        // insert MANUAL source + codes against existing type).
        const types = await tx.$queryRaw`
          SELECT id FROM ticket_types
          WHERE tenant_id = ${tenantId}::uuid AND event_id = ${eventId}::uuid
          LIMIT 1
        `;
        const ticketTypeId = types[0].id;
        const manualSource = randomUUID();
        await tx.$executeRaw`
          INSERT INTO issuance_sources (
            tenant_id, event_id, id, name, approval_mode,
            pending_ttl_hours, max_pending_per_user, created_at, updated_at
          ) VALUES (
            ${tenantId}::uuid, ${eventId}::uuid, ${manualSource}::uuid,
            'Manual', 'MANUAL', 24, 5, now(), now()
          )
        `;
        await tx.$executeRaw`
          INSERT INTO source_ticket_types (tenant_id, event_id, source_id, ticket_type_id)
          VALUES (
            ${tenantId}::uuid, ${eventId}::uuid, ${manualSource}::uuid, ${ticketTypeId}::uuid
          )
        `;
        for (const raw of ['MANUAL-1', 'RACE-1']) {
          const id = randomUUID();
          const { hashRedemptionCode } = require('../dist');
          const codeHmac = hashRedemptionCode(HMAC, raw);
          await tx.$executeRaw`
            INSERT INTO redemption_codes (
              tenant_id, event_id, id, code_hmac, code_pepper_version,
              source_id, ticket_type_id, status, created_at, updated_at
            ) VALUES (
              ${tenantId}::uuid, ${eventId}::uuid, ${id}::uuid,
              ${codeHmac}, ${HMAC.version}, ${manualSource}::uuid, ${ticketTypeId}::uuid,
              'AVAILABLE', now(), now()
            )
          `;
        }

        const saved = await saveEventConfigVersion(tx, {
          tenantId,
          eventId,
          actorUserId: staff.userId,
          payload: {
            schemaVersion: 1,
            brand: { primaryColor: '#111', organizationName: 'Org' },
            sections: [
              {
                kind: 'terms',
                id: 'terms-1',
                visible: true,
                order: 0,
                body: { termsVersion: 'terms-v1', bodyMarkdown: 'Rules' },
              },
            ],
            formDefinitionId: 'form-v1',
            termsVersion: 'terms-v1',
            form: FORM,
          },
        });
        await publishEventConfig(tx, {
          tenantId,
          eventId,
          actorUserId: staff.userId,
          expectedVersion: saved.version,
        });
      });

      const redeemInput = (rawCode, key, answers = ANSWERS) => ({
        tenantId,
        eventId,
        actorUserId: owner.userId,
        actorEmail: owner.email,
        emailVerified: true,
        rawCode,
        idempotencyKey: key,
        formVersion: 'form-v1',
        termsVersion: 'terms-v1',
        answers,
        termsAccepted: true,
      });

      const auto = await withTenant(db, tenantId, (tx) =>
        redeemAndIssueTicket(tx, HMAC, CRED, redeemInput('AUTO-1', randomUUID())),
      );
      assert.equal(auto.ok, true);

      const keyA = randomUUID();
      const pending = await withTenant(db, tenantId, (tx) =>
        redeemAndIssueTicket(tx, HMAC, CRED, redeemInput('MANUAL-1', keyA)),
      );
      assert.equal(pending.ok, 'pending');
      assert.equal(pending.result.code, APPROVAL_PENDING);
      assert.ok(pending.result.expiresAt);

      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            redeemAndIssueTicket(
              tx,
              HMAC,
              CRED,
              redeemInput('MANUAL-1', keyA, {
                ...ANSWERS,
                full_name: 'Changed',
              }),
            ),
          ),
        (err) => err.code === ISSUE_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      );

      const replay = await withTenant(db, tenantId, (tx) =>
        redeemAndIssueTicket(tx, HMAC, CRED, redeemInput('MANUAL-1', keyA)),
      );
      assert.equal(replay.ok, 'pending');
      assert.equal(replay.result.replayed, true);

      const status = await withTenant(db, tenantId, (tx) =>
        getOwnerRedemptionStatus(tx, {
          tenantId,
          requestId: pending.result.requestId,
          ownerUserId: owner.userId,
        }),
      );
      assert.equal(status.status, 'PENDING_REVIEW');

      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            getOwnerRedemptionStatus(tx, {
              tenantId,
              requestId: pending.result.requestId,
              ownerUserId: other.userId,
            }),
          ),
        (err) => err.code === ISSUE_ERROR_CODES.REDEMPTION_NOT_FOUND,
      );

      const staffPage = await withTenant(db, tenantId, (tx) =>
        listStaffPendingRedemptions(tx, {
          tenantId,
          eventId,
          actorUserId: staff.userId,
        }),
      );
      const item = staffPage.items.find(
        (row) => row.requestId === pending.result.requestId,
      );
      assert.ok(item);
      assert.equal(item.actorEmailMasked, 'o***@example.com');

      const race = await withTenant(db, tenantId, (tx) =>
        redeemAndIssueTicket(tx, HMAC, CRED, redeemInput('RACE-1', randomUUID())),
      );
      assert.equal(race.ok, 'pending');

      await withTenant(db, tenantId, (tx) =>
        expirePendingRequest(tx, {
          tenantId,
          eventId,
          requestId: race.result.requestId,
          force: true,
          actorUserId: staff.userId,
        }),
      );
      const afterExpire = await withTenant(db, tenantId, (tx) =>
        decideRedemption(tx, CRED, {
          tenantId,
          eventId,
          requestId: race.result.requestId,
          actorUserId: staff.userId,
          decision: 'approve',
          idempotencyKey: randomUUID(),
        }),
      );
      assert.equal(afterExpire.ok, false);
      assert.equal(
        afterExpire.rejection.code,
        APPROVAL_ERROR_CODES.PENDING_EXPIRED,
      );

      const expiredStatus = await withTenant(db, tenantId, (tx) =>
        getOwnerRedemptionStatus(tx, {
          tenantId,
          requestId: race.result.requestId,
          ownerUserId: owner.userId,
        }),
      );
      assert.equal(expiredStatus.status, 'EXPIRED');

      const approved = await withTenant(db, tenantId, (tx) =>
        decideRedemption(tx, CRED, {
          tenantId,
          eventId,
          requestId: pending.result.requestId,
          actorUserId: staff.userId,
          decision: 'approve',
          idempotencyKey: randomUUID(),
        }),
      );
      assert.equal(approved.ok, true);
      const issuedStatus = await withTenant(db, tenantId, (tx) =>
        getOwnerRedemptionStatus(tx, {
          tenantId,
          requestId: pending.result.requestId,
          ownerUserId: owner.userId,
        }),
      );
      assert.equal(issuedStatus.status, 'ISSUED');
      assert.ok(issuedStatus.ticketId);

      const audits = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`
          SELECT sanitized_diff::text AS diff
          FROM audit_logs
          WHERE tenant_id = ${tenantId}::uuid AND event_id = ${eventId}::uuid
        `,
      );
      for (const row of audits) {
        const diff = row.diff ?? '';
        assert.equal(diff.includes('ada@example.com'), false);
        assert.equal(diff.includes('"Ada"'), false);
        assert.equal(diff.includes('full_name'), false);
      }

      // Concurrent approve-vs-expire: one outcome
      const race2Code = 'RACE-2';
      await withTenant(db, tenantId, async (tx) => {
        const types = await tx.$queryRaw`
          SELECT id FROM ticket_types
          WHERE tenant_id = ${tenantId}::uuid AND event_id = ${eventId}::uuid
          LIMIT 1
        `;
        const sources = await tx.$queryRaw`
          SELECT id FROM issuance_sources
          WHERE tenant_id = ${tenantId}::uuid AND approval_mode = 'MANUAL'
          LIMIT 1
        `;
        const { hashRedemptionCode } = require('../dist');
        const id = randomUUID();
        await tx.$executeRaw`
          INSERT INTO redemption_codes (
            tenant_id, event_id, id, code_hmac, code_pepper_version,
            source_id, ticket_type_id, status, created_at, updated_at
          ) VALUES (
            ${tenantId}::uuid, ${eventId}::uuid, ${id}::uuid,
            ${hashRedemptionCode(HMAC, race2Code)}, ${HMAC.version},
            ${sources[0].id}::uuid, ${types[0].id}::uuid,
            'AVAILABLE', now(), now()
          )
        `;
      });
      const race2 = await withTenant(db, tenantId, (tx) =>
        redeemAndIssueTicket(
          tx,
          HMAC,
          CRED,
          redeemInput(race2Code, randomUUID()),
        ),
      );
      assert.equal(race2.ok, 'pending');
      const [expireOutcome, approveOutcome] = await Promise.all([
        withTenant(db, tenantId, (tx) =>
          expirePendingRequest(tx, {
            tenantId,
            eventId,
            requestId: race2.result.requestId,
            force: true,
          }),
        ),
        withTenant(db, tenantId, (tx) =>
          decideRedemption(tx, CRED, {
            tenantId,
            eventId,
            requestId: race2.result.requestId,
            actorUserId: staff.userId,
            decision: 'approve',
            idempotencyKey: randomUUID(),
          }),
        ),
      ]);
      const expireWon = expireOutcome.expired === true;
      const approveWon = approveOutcome.ok === true;
      assert.equal(
        expireWon !== approveWon,
        true,
        'exactly one of expire/approve must win',
      );
      if (approveWon) {
        assert.equal(expireOutcome.expired, false);
      } else {
        assert.equal(approveOutcome.ok, false);
        assert.equal(
          approveOutcome.rejection.code,
          APPROVAL_ERROR_CODES.PENDING_EXPIRED,
        );
      }
    } finally {
      await db.$disconnect();
      try {
        docker('rm', '-f', pg.name);
      } catch {
        /* ignore */
      }
    }
  },
);
