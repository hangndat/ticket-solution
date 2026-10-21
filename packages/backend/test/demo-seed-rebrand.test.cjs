'use strict';

/**
 * D9 Fun Fest → MFest rebrand idempotency on isolated PostgreSQL.
 * Covers: old fixture slug migrate, fresh+repeat, unknown slug / collision fail-closed,
 * published marketing skip (ADR-19), data/codes preserved.
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
  seedD9DemoDataset,
  listPublishedEvents,
  getPublishedEventDetail,
  saveEventConfigVersion,
  publishEventConfig,
  D9_DEMO,
  readCodeHmacEnvironment,
  hashRedemptionCode,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS = migrationFiles();
const MFEST_ID = D9_DEMO.tenants.mfest.id;
const MFEST_EVENT_ID = D9_DEMO.events.mfest.id;
const OIDC = 'http://127.0.0.1:8080/realms/ticket';

async function startIsolatedPostgres() {
  const name = 'ticket-d9-rebrand-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=d9_rebrand_test',
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
        'd9_rebrand_test',
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
      'postgresql://postgres:' +
      password +
      '@127.0.0.1:' +
      port +
      '/d9_rebrand_test',
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
      "CREATE ROLE d9_rebrand_login LOGIN PASSWORD '" +
        password +
        "' NOSUPERUSER NOBYPASSRLS INHERIT",
    );
    await admin.query('GRANT ticket_runtime TO d9_rebrand_login');
    await admin.query('GRANT ticket_platform_runtime TO d9_rebrand_login');
  } finally {
    await admin.end().catch(() => {});
  }
  return {
    name,
    url:
      'postgresql://d9_rebrand_login:' +
      password +
      '@127.0.0.1:' +
      port +
      '/d9_rebrand_test',
  };
}

async function insertLegacyFunFestFixture(db, hmac) {
  const oldCode = 'DEMO-FUN-001';
  const codeHmac = hashRedemptionCode(hmac, oldCode);
  const codeId = randomUUID();
  await withTenant(db, MFEST_ID, async (tx) => {
    await tx.tenant.create({
      data: {
        id: MFEST_ID,
        slug: 'demo-fun',
        name: 'FUN Collective · Demo',
        status: 'ACTIVE',
        defaultTimezone: 'Asia/Ho_Chi_Minh',
      },
    });
    await tx.$executeRaw`
      INSERT INTO events (
        tenant_id, id, slug, name, status, content_status, business_status,
        visibility, timezone, starts_at, venue_name,
        redemption_opens_at, redemption_closes_at,
        check_in_opens_at, check_in_closes_at,
        published_brand_snapshot, revision
      ) VALUES (
        ${MFEST_ID}::uuid, ${MFEST_EVENT_ID}::uuid, 'fun-fest',
        'FUN FEST · Demo', 'PUBLISHED', 'PUBLISHED', 'ACTIVE', 'PUBLIC',
        'Asia/Ho_Chi_Minh', ${D9_DEMO.events.mfest.startsAt},
        ${D9_DEMO.events.mfest.venueName},
        now() - interval '1 hour', now() + interval '365 days',
        now() - interval '1 hour', now() + interval '365 days',
        '{"fixture":true,"organizationName":"FUN Collective · Demo"}'::jsonb, 1
      )
    `;
    await tx.$executeRaw`
      INSERT INTO ticket_types (
        tenant_id, event_id, id, label, entitlement_snapshot, created_at, updated_at
      ) VALUES (
        ${MFEST_ID}::uuid, ${MFEST_EVENT_ID}::uuid,
        ${D9_DEMO.events.mfest.ticketTypeId}::uuid,
        'General', '{"fixture":true}'::jsonb, now(), now()
      )
    `;
    // Legacy source label; re-seed UPDATEs name to D9_DEMO.events.mfest.sourceName.
    await tx.$executeRaw`
      INSERT INTO issuance_sources (
        tenant_id, event_id, id, name, approval_mode, created_at, updated_at
      ) VALUES (
        ${MFEST_ID}::uuid, ${MFEST_EVENT_ID}::uuid,
        ${D9_DEMO.events.mfest.sourceId}::uuid,
        'Demo VIP (fixture)', 'AUTO', now(), now()
      )
    `;
    await tx.$executeRaw`
      INSERT INTO redemption_codes (
        tenant_id, event_id, id, code_hmac, code_pepper_version,
        source_id, ticket_type_id, status, created_at, updated_at
      ) VALUES (
        ${MFEST_ID}::uuid, ${MFEST_EVENT_ID}::uuid, ${codeId}::uuid,
        ${codeHmac}, ${hmac.version},
        ${D9_DEMO.events.mfest.sourceId}::uuid,
        ${D9_DEMO.events.mfest.ticketTypeId}::uuid,
        'AVAILABLE', now(), now()
      )
    `;
  });
  return { oldCode, codeId, codeHmac };
}

test(
  'D9 rebrand: legacy demo-fun fixture reseed migrates slug, keeps id/codes; marketing skip; collision/unknown fail',
  { timeout: 300000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 2);
      const hmac = readCodeHmacEnvironment({
        CODE_HMAC_PEPPER: 'd9-rebrand-test-pepper!!',
        CODE_HMAC_VERSION: '1',
      });

      // --- legacy fixture → reseed migrates ---
      const legacy = await insertLegacyFunFestFixture(db, hmac);
      const migrated = await seedD9DemoDataset(db, hmac, { oidcIssuer: OIDC });
      assert.equal(migrated.fixture, true);
      assert.ok(migrated.configsPublished >= 1);

      const tenantRow = await withTenant(db, MFEST_ID, async (tx) =>
        tx.tenant.findUnique({ where: { id: MFEST_ID } }),
      );
      assert.ok(tenantRow);
      assert.equal(tenantRow.id, MFEST_ID);
      assert.equal(tenantRow.slug, 'mfest-demo');
      assert.match(tenantRow.name, /MFest/);

      const eventRow = await withTenant(db, MFEST_ID, async (tx) =>
        tx.event.findUnique({
          where: { tenantId_id: { tenantId: MFEST_ID, id: MFEST_EVENT_ID } },
        }),
      );
      assert.ok(eventRow);
      assert.equal(eventRow.slug, 'mfest');
      assert.match(eventRow.name, /MFest/);
      assert.equal(eventRow.venueName, D9_DEMO.events.mfest.venueName);
      assert.equal(tenantRow.name, 'MFest');
      assert.ok(!/· Demo/.test(tenantRow.name));

      const sourceRows = await withTenant(db, MFEST_ID, async (tx) =>
        tx.$queryRaw`
          SELECT name FROM issuance_sources
          WHERE tenant_id = ${MFEST_ID}::uuid
            AND id = ${D9_DEMO.events.mfest.sourceId}::uuid
        `,
      );
      assert.equal(sourceRows[0].name, D9_DEMO.events.mfest.sourceName);

      const oldCodeStillThere = await withTenant(db, MFEST_ID, async (tx) =>
        tx.$queryRaw`
          SELECT id FROM redemption_codes
          WHERE tenant_id = ${MFEST_ID}::uuid
            AND event_id = ${MFEST_EVENT_ID}::uuid
            AND id = ${legacy.codeId}::uuid
        `,
      );
      assert.equal(oldCodeStillThere.length, 1);

      const list = await listPublishedEvents(db, {
        tenantSlug: 'mfest-demo',
      });
      assert.ok(list);
      assert.equal(list.items.some((i) => i.slug === 'mfest'), true);
      assert.equal(
        await listPublishedEvents(db, { tenantSlug: 'demo-fun' }),
        null,
      );

      const detail = await getPublishedEventDetail(db, {
        tenantSlug: 'mfest-demo',
        eventSlug: 'mfest',
      });
      assert.ok(detail);
      assert.ok(detail.sections.some((s) => s.kind === 'hero'));

      // published config not overwritten on second seed
      const again = await seedD9DemoDataset(db, hmac, { oidcIssuer: OIDC });
      assert.equal(again.configsPublished, 0);
      assert.ok(again.configsSkipped >= 1);

      // --- fresh DB path: seed + projection + repeat ---
      await db.$disconnect().catch(() => {});
      docker('rm', '-f', name);
      name = undefined;

      const boot2 = await startIsolatedPostgres();
      name = boot2.name;
      db = createDatabase(boot2.url, 2);
      const hmac2 = readCodeHmacEnvironment({
        CODE_HMAC_PEPPER: 'd9-rebrand-test-pepper!!',
        CODE_HMAC_VERSION: '1',
      });
      const first = await seedD9DemoDataset(db, hmac2, { oidcIssuer: OIDC });
      assert.ok(first.configsPublished >= 1);
      const second = await seedD9DemoDataset(db, hmac2, { oidcIssuer: OIDC });
      assert.equal(second.configsPublished, 0);
      assert.ok(second.configsSkipped >= 1);
      const freshDetail = await getPublishedEventDetail(db, {
        tenantSlug: 'mfest-demo',
        eventSlug: 'mfest',
      });
      assert.ok(freshDetail);

      // --- unknown slug on D9 UUID → fail-closed ---
      await db.$disconnect().catch(() => {});
      docker('rm', '-f', name);
      name = undefined;

      const boot3 = await startIsolatedPostgres();
      name = boot3.name;
      db = createDatabase(boot3.url, 2);
      const hmac3 = readCodeHmacEnvironment({
        CODE_HMAC_PEPPER: 'd9-rebrand-test-pepper!!',
        CODE_HMAC_VERSION: '1',
      });
      await withTenant(db, MFEST_ID, async (tx) => {
        await tx.tenant.create({
          data: {
            id: MFEST_ID,
            slug: 'hijacked-not-legacy',
            name: 'Hijack · Demo',
            status: 'ACTIVE',
            defaultTimezone: 'Asia/Ho_Chi_Minh',
          },
        });
      });
      await assert.rejects(
        () => seedD9DemoDataset(db, hmac3, { oidcIssuer: OIDC }),
        /exists with slug=hijacked-not-legacy/,
      );

      // --- collision: legacy demo-fun + other owner of mfest-demo ---
      await db.$disconnect().catch(() => {});
      docker('rm', '-f', name);
      name = undefined;

      const boot4 = await startIsolatedPostgres();
      name = boot4.name;
      db = createDatabase(boot4.url, 2);
      const hmac4 = readCodeHmacEnvironment({
        CODE_HMAC_PEPPER: 'd9-rebrand-test-pepper!!',
        CODE_HMAC_VERSION: '1',
      });
      const otherId = randomUUID();
      await withTenant(db, MFEST_ID, async (tx) => {
        await tx.tenant.create({
          data: {
            id: MFEST_ID,
            slug: 'demo-fun',
            name: 'FUN Collective · Demo',
            status: 'ACTIVE',
            defaultTimezone: 'Asia/Ho_Chi_Minh',
          },
        });
      });
      await withTenant(db, otherId, async (tx) => {
        await tx.tenant.create({
          data: {
            id: otherId,
            slug: 'mfest-demo',
            name: 'Someone Else',
            status: 'ACTIVE',
            defaultTimezone: 'Asia/Ho_Chi_Minh',
          },
        });
      });
      await assert.rejects(
        () => seedD9DemoDataset(db, hmac4, { oidcIssuer: OIDC }),
        /rebrand blocked: slug mfest-demo/,
      );
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (name) {
        try {
          docker('rm', '-f', name);
        } catch {
          /* ignore */
        }
      }
    }
  },
);

test(
  'D9 seed upgrades published marketing when terms section missing',
  { timeout: 120_000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 2);
      const hmac = readCodeHmacEnvironment({
        CODE_HMAC_PEPPER: 'd9-terms-upgrade-pepper!!',
        CODE_HMAC_VERSION: '1',
      });
      const first = await seedD9DemoDataset(db, hmac, { oidcIssuer: OIDC });
      const actorUserId = first.staffUserIds[0];
      assert.ok(actorUserId);
      await withTenant(db, MFEST_ID, async (tx) => {
        const detail = await getPublishedEventDetail(db, {
          tenantSlug: 'mfest-demo',
          eventSlug: 'mfest',
        });
        assert.ok(detail);
        const rows = await tx.$queryRaw`
          SELECT v.payload
          FROM events e
          INNER JOIN event_config_versions v
            ON v.tenant_id = e.tenant_id
           AND v.event_id = e.id
           AND v.version = e.published_config_version
          WHERE e.tenant_id = ${MFEST_ID}::uuid
            AND e.id = ${MFEST_EVENT_ID}::uuid
        `;
        const raw = rows[0]?.payload;
        assert.ok(raw && typeof raw === 'object' && !Array.isArray(raw));
        const payload = { ...raw };
        if (Array.isArray(payload.sections)) {
          payload.sections = payload.sections.map((s) => {
            if (s?.kind !== 'terms') return s;
            const body =
              s.body && typeof s.body === 'object' && !Array.isArray(s.body)
                ? { ...s.body }
                : {};
            body.termsVersion = 'legacy-v0';
            body.text = '';
            return { ...s, body };
          });
        }
        delete payload.termsVersion;
        const saved = await saveEventConfigVersion(tx, {
          tenantId: MFEST_ID,
          eventId: MFEST_EVENT_ID,
          actorUserId,
          payload,
        });
        await publishEventConfig(tx, {
          tenantId: MFEST_ID,
          eventId: MFEST_EVENT_ID,
          actorUserId,
          expectedVersion: saved.version,
        });
      });
      const stripped = await getPublishedEventDetail(db, {
        tenantSlug: 'mfest-demo',
        eventSlug: 'mfest',
      });
      assert.ok(stripped?.terms);
      assert.notEqual(stripped.terms.version, 'terms-v1');

      const upgraded = await seedD9DemoDataset(db, hmac, { oidcIssuer: OIDC });
      assert.ok(upgraded.configsPublished >= 1);

      const after = await getPublishedEventDetail(db, {
        tenantSlug: 'mfest-demo',
        eventSlug: 'mfest',
      });
      assert.ok(after?.terms);
      assert.equal(after.terms.version, 'terms-v1');
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (name) {
        try {
          docker('rm', '-f', name);
        } catch {
          /* ignore */
        }
      }
    }
  },
);
