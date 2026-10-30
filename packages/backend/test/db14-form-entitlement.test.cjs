'use strict';

/**
 * DB-14 (PLAN §6.1): form/terms version evidence, structural config allowlist,
 * entitlement snapshot on ticket immutable when brand/config/ticket_type changes.
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
  grantMembership,
  grantEventAssignment,
  seedEventInventory,
  readCodeHmacEnvironment,
  redeemAndIssueTicket,
  saveEventConfigVersion,
  publishEventConfig,
  ConfigError,
  CONFIG_ERROR_CODES,
  ISSUE_ERROR_CODES,
  hashFormDefinition,
  hashTermsContent,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS = migrationFiles();
const TASK_ID = 'task_c9a18a129eab';
const HMAC = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'db14-form-ent-pepper!!!',
  CODE_HMAC_VERSION: '1',
});
const CRED = 'db14-form-ent-cred-key';

const ENTITLEMENT_V1 = {
  gateAccess: 'standard',
  tier: 'db14-v1',
  perks: ['lounge'],
};

const FORM_V1 = {
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

const FORM_V2 = {
  formVersion: 'form-v2',
  fields: FORM_V1.fields,
};

const ANSWERS_V1 = {
  full_name: 'Ada',
  email: 'ada@example.com',
  shirt: 'm',
  agree: true,
};

function typedPayload(overrides = {}) {
  return {
    schemaVersion: 1,
    brand: {
      primaryColor: '#0B3D2E',
      organizationName: overrides.orgName ?? 'DB-14 Org v1',
    },
    sections: [
      {
        kind: 'hero',
        id: 'hero-1',
        visible: true,
        order: 0,
        body: {
          title: overrides.heroTitle ?? 'DB-14',
          text: overrides.heroText ?? 'Hello',
        },
      },
      {
        kind: 'info',
        id: 'info-1',
        visible: true,
        order: 1,
        body: { title: 'Info', text: 'Details' },
      },
      {
        kind: 'redeem',
        id: 'redeem-1',
        visible: true,
        order: 2,
        body: { title: 'Redeem', text: 'Code' },
      },
      {
        kind: 'guide',
        id: 'guide-1',
        visible: false,
        order: 3,
        body: { title: 'Guide', text: '' },
      },
      {
        kind: 'faq',
        id: 'faq-1',
        visible: true,
        order: 4,
        body: {
          title: 'FAQ',
          items: [{ question: 'When?', answer: 'Sat' }],
        },
      },
      {
        kind: 'terms',
        id: 'terms-1',
        visible: true,
        order: 5,
        body: {
          title: 'Terms',
          termsVersion: overrides.termsSectionVersion ?? 'terms-v1',
          text: overrides.termsText ?? 'Be kind v1',
        },
      },
    ],
    formDefinitionId: 'form-v1',
    termsVersion: overrides.termsVersion ?? 'terms-v1',
    form: overrides.form ?? FORM_V1,
  };
}

async function startIsolatedPostgres() {
  const name = 'ticket-db14-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '--label',
    'ticket.task=' + TASK_ID,
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=db14_test',
    '-p',
    '127.0.0.1::5432',
    'postgres:18.1-alpine',
  );
  let ready = false;
  for (let i = 0; i < 80; i++) {
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
        'db14_test',
      );
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  assert.ok(ready, 'database must become ready');
  const port = docker('port', name, '5432/tcp').split(':').at(-1);
  const admin = new Client({
    connectionString:
      'postgresql://postgres:' + password + '@127.0.0.1:' + port + '/db14_test',
  });
  try {
    for (let i = 0; i < 30; i++) {
      try {
        await admin.connect();
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 400));
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
    await admin.query(
      'GRANT CREATE, USAGE ON SCHEMA public TO migration_owner',
    );
    await admin.query('SET ROLE migration_owner');
    for (const file of MIGRATIONS) await admin.query(readFileSync(file, 'utf8'));
    await admin.query('RESET ROLE');
    await admin.query(
      "CREATE ROLE db14_login LOGIN PASSWORD '" +
        password +
        "' NOSUPERUSER NOBYPASSRLS INHERIT",
    );
    await admin.query('GRANT ticket_runtime TO db14_login');
  } finally {
    await admin.end().catch(() => {});
  }
  return {
    name,
    url:
      'postgresql://db14_login:' +
      password +
      '@127.0.0.1:' +
      port +
      '/db14_test',
  };
}

test(
  'DB-14: form/terms version, allowlist rejection, immutable entitlement snapshot',
  { timeout: 240000 },
  async () => {
    const pg = await startIsolatedPostgres();
    const db = createDatabase(pg.url);
    const users = createPrismaIdentityUserRepository(db);
    const issuer = 'https://issuer.example/realms/db14';
    try {
      const owner = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'owner',
        email: 'owner@example.com',
        emailVerified: true,
      });
      const attendee = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'attendee',
        email: 'attendee@example.com',
        emailVerified: true,
      });

      const tenantId = randomUUID();
      const eventId = randomUUID();
      let ticketTypeId;

      await withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantId, slug: 'db14', name: 'DB14' },
        });
        await tx.event.create({
          data: {
            tenantId,
            id: eventId,
            slug: 'gala',
            name: 'Gala',
            status: 'DRAFT',
          },
        });
        const membership = await grantMembership(tx, {
          tenantId,
          userId: owner.userId,
          role: 'MANAGER',
          permissions: ['event.config', 'event.publish', 'redemption.approve'],
        });
        await grantEventAssignment(tx, {
          tenantId,
          eventId,
          membershipId: membership.membershipId,
          permissions: ['event.config', 'event.publish', 'redemption.approve'],
        });

        const inventory = await seedEventInventory(tx, HMAC, {
          tenantId,
          eventId,
          eventQuota: 10,
          rawCodes: ['DB14-A', 'DB14-B'],
        });
        ticketTypeId = inventory.ticketTypeId;

        await tx.$executeRaw`
          UPDATE ticket_types
          SET entitlement_snapshot = ${JSON.stringify(ENTITLEMENT_V1)}::jsonb
          WHERE tenant_id = ${tenantId}::uuid AND id = ${ticketTypeId}::uuid
        `;

        const saved = await saveEventConfigVersion(tx, {
          tenantId,
          eventId,
          actorUserId: owner.userId,
          payload: typedPayload(),
        });
        await publishEventConfig(tx, {
          tenantId,
          eventId,
          actorUserId: owner.userId,
          expectedVersion: saved.version,
        });
      });

      const basePayload = typedPayload();
      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            saveEventConfigVersion(tx, {
              tenantId,
              eventId,
              actorUserId: owner.userId,
              payload: typedPayload({
                heroText: '<script>alert(1)</script>',
              }),
            }),
          ),
        (error) =>
          error instanceof ConfigError &&
          error.code === CONFIG_ERROR_CODES.CONFIG_INCOMPATIBLE,
      );

      const heroWithUnknown = typedPayload().sections.map((s) =>
        s.kind === 'hero'
          ? {
              ...s,
              body: { ...s.body, customHtml: '<p>x</p>' },
            }
          : s,
      );
      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            saveEventConfigVersion(tx, {
              tenantId,
              eventId,
              actorUserId: owner.userId,
              payload: { ...basePayload, sections: heroWithUnknown },
            }),
          ),
        (error) =>
          error instanceof ConfigError &&
          error.code === CONFIG_ERROR_CODES.CONFIG_INCOMPATIBLE,
      );

      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            saveEventConfigVersion(tx, {
              tenantId,
              eventId,
              actorUserId: owner.userId,
              payload: typedPayload({
                form: {
                  formVersion: 'form-v1',
                  fields: [
                    {
                      id: 'x',
                      label: 'X',
                      type: 'html',
                      required: true,
                    },
                  ],
                },
              }),
            }),
          ),
        (error) =>
          error instanceof ConfigError &&
          error.code === CONFIG_ERROR_CODES.CONFIG_INCOMPATIBLE,
      );

      const redeemInput = (rawCode, termsVersion = 'terms-v1', formVersion = 'form-v1') => ({
        tenantId,
        eventId,
        actorUserId: attendee.userId,
        actorEmail: attendee.email,
        emailVerified: true,
        rawCode,
        idempotencyKey: randomUUID(),
        formVersion,
        termsVersion,
        answers: ANSWERS_V1,
        termsAccepted: true,
      });

      const issued = await withTenant(db, tenantId, (tx) =>
        redeemAndIssueTicket(tx, HMAC, CRED, redeemInput('DB14-A')),
      );
      assert.equal(issued.ok, true);
      const ticketId = issued.result.ticketId;
      const requestId = issued.result.requestId;

      const expectedFormHash = hashFormDefinition(FORM_V1);
      const expectedTermsHash = hashTermsContent({
        termsVersion: 'terms-v1',
        body: 'Be kind v1',
      });
      const expectedFormHashV2 = hashFormDefinition(FORM_V2);
      const expectedTermsHashV2 = hashTermsContent({
        termsVersion: 'terms-v2',
        body: 'Be kind v2',
      });
      assert.notEqual(expectedFormHashV2, expectedFormHash);
      assert.notEqual(expectedTermsHashV2, expectedTermsHash);

      const rows = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`
          SELECT t.entitlement_snapshot::text AS entitlement,
                 r.form_version, r.terms_version,
                 r.form_definition_hash, r.terms_content_hash
          FROM tickets t
          INNER JOIN redemption_requests r
            ON r.tenant_id = t.tenant_id AND r.id = t.request_id
          WHERE t.tenant_id = ${tenantId}::uuid AND t.id = ${ticketId}::uuid
        `,
      );
      assert.equal(rows.length, 1);
      assert.deepEqual(JSON.parse(rows[0].entitlement), ENTITLEMENT_V1);
      assert.equal(rows[0].form_version, 'form-v1');
      assert.equal(rows[0].terms_version, 'terms-v1');
      assert.equal(rows[0].form_definition_hash, expectedFormHash);
      assert.equal(rows[0].terms_content_hash, expectedTermsHash);

      await withTenant(db, tenantId, async (tx) => {
        const savedV2 = await saveEventConfigVersion(tx, {
          tenantId,
          eventId,
          actorUserId: owner.userId,
          payload: typedPayload({
            orgName: 'DB-14 Org v2',
            heroTitle: 'Rebrand',
            termsVersion: 'terms-v2',
            termsSectionVersion: 'terms-v2',
            termsText: 'Be kind v2',
            form: {
              ...FORM_V1,
              formVersion: 'form-v2',
            },
          }),
        });
        await publishEventConfig(tx, {
          tenantId,
          eventId,
          actorUserId: owner.userId,
          expectedVersion: savedV2.version,
        });

        await tx.$executeRaw`
          UPDATE ticket_types
          SET entitlement_snapshot = '{"tier":"forged-after-publish"}'::jsonb
          WHERE tenant_id = ${tenantId}::uuid AND id = ${ticketTypeId}::uuid
        `;
      });

      const afterRebrand = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`
          SELECT t.entitlement_snapshot::text AS entitlement,
                 r.form_version, r.terms_version,
                 r.form_definition_hash, r.terms_content_hash
          FROM tickets t
          INNER JOIN redemption_requests r
            ON r.tenant_id = t.tenant_id AND r.id = t.request_id
          WHERE t.tenant_id = ${tenantId}::uuid AND t.id = ${ticketId}::uuid
        `,
      );
      assert.deepEqual(JSON.parse(afterRebrand[0].entitlement), ENTITLEMENT_V1);
      assert.equal(afterRebrand[0].form_version, 'form-v1');
      assert.equal(afterRebrand[0].terms_version, 'terms-v1');
      assert.equal(afterRebrand[0].form_definition_hash, expectedFormHash);
      assert.equal(afterRebrand[0].terms_content_hash, expectedTermsHash);

      const stale = await withTenant(db, tenantId, (tx) =>
        redeemAndIssueTicket(
          tx,
          HMAC,
          CRED,
          redeemInput('DB14-B', 'terms-v1', 'form-v2'),
        ),
      );
      assert.equal(stale.ok, false);
      assert.equal(stale.rejection.code, ISSUE_ERROR_CODES.TERMS_VERSION_STALE);

      const issuedV2 = await withTenant(db, tenantId, (tx) =>
        redeemAndIssueTicket(
          tx,
          HMAC,
          CRED,
          redeemInput('DB14-B', 'terms-v2', 'form-v2'),
        ),
      );
      assert.equal(issuedV2.ok, true);
      assert.notEqual(issuedV2.result.requestId, requestId);

      const v2TicketId = issuedV2.result.ticketId;
      const v2Rows = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`
          SELECT r.form_version, r.terms_version,
                 r.form_definition_hash, r.terms_content_hash
          FROM tickets t
          INNER JOIN redemption_requests r
            ON r.tenant_id = t.tenant_id AND r.id = t.request_id
          WHERE t.tenant_id = ${tenantId}::uuid AND t.id = ${v2TicketId}::uuid
        `,
      );
      assert.equal(v2Rows[0].form_version, 'form-v2');
      assert.equal(v2Rows[0].terms_version, 'terms-v2');
      assert.equal(v2Rows[0].form_definition_hash, expectedFormHashV2);
      assert.equal(v2Rows[0].terms_content_hash, expectedTermsHashV2);

      const v1Again = await withTenant(db, tenantId, (tx) =>
        tx.$queryRaw`
          SELECT t.entitlement_snapshot::text AS entitlement,
                 r.form_version, r.terms_version,
                 r.form_definition_hash, r.terms_content_hash
          FROM tickets t
          INNER JOIN redemption_requests r
            ON r.tenant_id = t.tenant_id AND r.id = t.request_id
          WHERE t.tenant_id = ${tenantId}::uuid AND t.id = ${ticketId}::uuid
        `,
      );
      assert.deepEqual(JSON.parse(v1Again[0].entitlement), ENTITLEMENT_V1);
      assert.equal(v1Again[0].form_version, 'form-v1');
      assert.equal(v1Again[0].terms_version, 'terms-v1');
      assert.equal(v1Again[0].form_definition_hash, expectedFormHash);
      assert.equal(v1Again[0].terms_content_hash, expectedTermsHash);
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
