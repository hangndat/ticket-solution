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
  withActor,
  createPrismaIdentityUserRepository,
  seedEventInventory,
  redeemAndIssueTicket,
  unwrapRedeemOutcome,
  listTicketsForOwner,
  listAllTicketsForOwner,
  listOwnerTicketsAggregated,
  getTicketForOwner,
  readCodeHmacEnvironment,
  grantMembership,
  grantEventAssignment,
  saveEventConfigVersion,
  publishEventConfig,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS = migrationFiles();
const HMAC = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'w1-aggregate-test-pepper',
  CODE_HMAC_VERSION: '1',
});
const CRED_KEY = 'w1-aggregate-test-cred-key';

async function startIsolatedPostgres() {
  const name = 'ticket-w1-agg-' + randomBytes(6).toString('hex');
  const password = randomBytes(24).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=w1_agg_test',
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
        'w1_agg_test',
      );
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  assert.ok(ready, 'postgres must become ready');
  const binding = docker('port', name, '5432/tcp');
  const port = binding.split(':').at(-1);
  const admin = new Client({
    connectionString:
      'postgresql://postgres:' +
      password +
      '@127.0.0.1:' +
      port +
      '/w1_agg_test',
  });
  await admin.connect();
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
    "CREATE ROLE w1_login LOGIN PASSWORD '" +
      password +
      "' NOSUPERUSER NOBYPASSRLS INHERIT",
  );
  await admin.query('GRANT ticket_runtime TO w1_login');
  await admin.end();
  return {
    name,
    url:
      'postgresql://w1_login:' +
      password +
      '@127.0.0.1:' +
      port +
      '/w1_agg_test',
  };
}

async function seedTenantEvent(db, tenantId, eventId, slug) {
  await withTenant(db, tenantId, async (tx) => {
    await tx.tenant.create({
      data: { id: tenantId, slug: 'tenant-' + slug, name: 'T ' + slug },
    });
    await tx.event.create({
      data: {
        tenant: { connect: { id: tenantId } },
        id: eventId,
        slug,
        name: 'Event ' + slug,
        venueName: slug === 'one' ? 'Venue One' : null,
        timezone: slug === 'one' ? 'Asia/Manila' : 'Asia/Ho_Chi_Minh',
        startsAt: slug === 'one' ? new Date('2026-12-01T00:00:00Z') : null,
        status: 'PUBLISHED',
      },
    });
    await seedEventInventory(tx, HMAC, {
      tenantId,
      eventId,
      eventQuota: 5,
      rawCodes: ['CODE-' + slug],
    });
  });
}

test(
  'W1: owner aggregate lists all tenants; RLS isolates other owners; tenant filter unchanged',
  { timeout: 240000 },
  async () => {
    let container;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      container = boot.name;
      db = createDatabase(boot.url, 4);
      const users = createPrismaIdentityUserRepository(db);
      const userA = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'user_a',
        email: 'a@example.com',
        emailVerified: true,
      });
      const userB = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'user_b',
        email: 'b@example.com',
        emailVerified: true,
      });

      const T1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const T2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      const E1 = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
      const E2 = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

      await seedTenantEvent(db, T1, E1, 'one');
      await seedTenantEvent(db, T2, E2, 'two');
      const bannerAssetId = 'abababab-abab-4bab-8bab-abababababab';
      const manager = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'banner-publisher',
        email: 'banner-publisher@example.com',
        emailVerified: true,
      });
      await withTenant(db, T1, async (tx) => {
        await tx.$executeRaw`
          UPDATE events SET visibility = 'PUBLIC', business_status = 'ACTIVE'
          WHERE tenant_id = ${T1}::uuid AND id = ${E1}::uuid
        `;
        const membership = await grantMembership(tx, {
          tenantId: T1, userId: manager.userId, role: 'MANAGER',
          permissions: ['event.config', 'event.publish'],
        });
        await grantEventAssignment(tx, {
          tenantId: T1, eventId: E1, membershipId: membership.membershipId,
          permissions: ['event.config', 'event.publish'],
        });
        await tx.$executeRaw`
          INSERT INTO event_assets (
            tenant_id, event_id, id, status, quarantine_key, ready_key,
            original_filename, content_type, byte_length, width_px, height_px,
            sha256, created_by, finalized_at
          ) VALUES (
            ${T1}::uuid, ${E1}::uuid, ${bannerAssetId}::uuid, 'READY',
            'test/quarantine/banner', 'test/ready/banner', 'banner.png',
            'image/png', 10, 760, 200, 'test-sha', ${manager.userId}::uuid, now()
          )
        `;
        const payload = {
          schemaVersion: 1,
          brand: { primaryColor: '#245B47', organizationName: 'Org', bannerAssetId },
          sections: ['hero', 'info', 'redeem', 'guide', 'faq', 'terms'].map(
            (kind, order) => ({
              kind, id: `banner-${kind}`, visible: true, order,
              body: kind === 'terms'
                ? { title: 'Terms', termsVersion: 'terms-v1', text: 'Terms' }
                : kind === 'faq'
                  ? { title: 'FAQ', items: [] }
                  : { title: kind, text: kind },
            }),
          ),
          termsVersion: 'terms-v1',
        };
        const saved = await saveEventConfigVersion(tx, {
          tenantId: T1, eventId: E1, actorUserId: manager.userId, payload,
        });
        await publishEventConfig(tx, {
          tenantId: T1, eventId: E1, actorUserId: manager.userId,
          expectedVersion: saved.version,
        });
      });
      process.env.PUBLISHED_ASSET_PUBLIC_BASE = 'https://api.example.test';
      await withTenant(db, T1, async (tx) => {
        await seedEventInventory(tx, HMAC, {
          tenantId: T1,
          eventId: E1,
          eventQuota: 5,
          rawCodes: ['CODE-one-b'],
        });
      });

      const ticketA1 = await withTenant(db, T1, async (tx) => {
        const outcome = await redeemAndIssueTicket(tx, HMAC, CRED_KEY, {
          tenantId: T1,
          eventId: E1,
          actorUserId: userA.userId,
          actorEmail: userA.email,
          emailVerified: true,
          rawCode: 'CODE-one',
          idempotencyKey: randomUUID(),
          termsVersion: 'terms-v1',
          termsAccepted: true,
        });
        return unwrapRedeemOutcome(outcome);
      });
      const ticketA2 = await withTenant(db, T2, async (tx) => {
        const outcome = await redeemAndIssueTicket(tx, HMAC, CRED_KEY, {
          tenantId: T2,
          eventId: E2,
          actorUserId: userA.userId,
          actorEmail: userA.email,
          emailVerified: true,
          rawCode: 'CODE-two',
          idempotencyKey: randomUUID(),
        });
        return unwrapRedeemOutcome(outcome);
      });
      await withTenant(db, T1, async (tx) => {
        const outcome = await redeemAndIssueTicket(tx, HMAC, CRED_KEY, {
          tenantId: T1,
          eventId: E1,
          actorUserId: userB.userId,
          actorEmail: userB.email,
          emailVerified: true,
          rawCode: 'CODE-one-b',
          idempotencyKey: randomUUID(),
          termsVersion: 'terms-v1',
          termsAccepted: true,
        });
        unwrapRedeemOutcome(outcome);
      });

      await withTenant(
        db,
        T1,
        (tx) => tx.$executeRaw`
        UPDATE ticket_types SET label = 'Owner Type One'
        WHERE tenant_id = ${T1}::uuid AND event_id = ${E1}::uuid AND id = ${ticketA1.ticketTypeId}::uuid
      `,
      );

      const aggregate = await listOwnerTicketsAggregated(db, userA.userId);
      const ids = aggregate.map((t) => t.ticketId).sort();
      assert.deepEqual(ids, [ticketA1.ticketId, ticketA2.ticketId].sort());
      const tenants = new Set(aggregate.map((t) => t.tenantId));
      assert.equal(tenants.size, 2);
      assert.ok(tenants.has(T1));
      assert.ok(tenants.has(T2));
      assert.equal(
        aggregate.find((t) => t.tenantId === T1).startsAt.toISOString(),
        '2026-12-01T00:00:00.000Z',
      );
      assert.equal(aggregate.find((t) => t.tenantId === T2).startsAt, null);
      const expectedBannerUrl =
        'https://api.example.test/v1/public/tenants/tenant-one/events/one/assets/' +
        bannerAssetId;
      assert.equal(aggregate.find((t) => t.tenantId === T1).bannerUrl, expectedBannerUrl);
      assert.equal(
        aggregate.find((t) => t.tenantId === T1).venueName,
        'Venue One',
      );
      assert.equal(
        aggregate.find((t) => t.tenantId === T1).eventTimezone,
        'Asia/Manila',
      );
      assert.equal(
        aggregate.find((t) => t.tenantId === T1).ticketTypeLabel,
        'Owner Type One',
      );
      assert.equal(aggregate.find((t) => t.tenantId === T2).venueName, null);
      assert.equal(
        aggregate.find((t) => t.tenantId === T2).eventTimezone,
        'Asia/Ho_Chi_Minh',
      );

      const detail = await withTenant(db, T1, (tx) =>
        getTicketForOwner(tx, T1, userA.userId, ticketA1.ticketId),
      );
      assert.equal(detail.ticketTypeLabel, 'Owner Type One');
      assert.equal(detail.venueName, 'Venue One');
      assert.equal(detail.bannerUrl, expectedBannerUrl);

      const assertNoOwnerBanner = async () => {
        const list = await withTenant(db, T1, (tx) =>
          listTicketsForOwner(tx, T1, userA.userId),
        );
        assert.equal(list.find((ticket) => ticket.ticketId === ticketA1.ticketId).bannerUrl, null);
        const aggregateRows = await listOwnerTicketsAggregated(db, userA.userId);
        assert.equal(aggregateRows.find((ticket) => ticket.ticketId === ticketA1.ticketId).bannerUrl, null);
        const detailRow = await withTenant(db, T1, (tx) =>
          getTicketForOwner(tx, T1, userA.userId, ticketA1.ticketId),
        );
        assert.equal(detailRow.bannerUrl, null);
      };
      const wrongEventId = randomUUID();
      const wrongEventAssetId = randomUUID();
      await withTenant(db, T1, async (tx) => {
        await tx.$executeRaw`
          INSERT INTO events (tenant_id, id, slug, name, status, timezone)
          VALUES (${T1}::uuid, ${wrongEventId}::uuid, 'wrong-banner-event',
                  'Wrong Banner Event', 'PUBLISHED', 'UTC')
        `;
        await tx.$executeRaw`
          INSERT INTO event_assets (
            tenant_id, event_id, id, status, quarantine_key, ready_key,
            original_filename, content_type, byte_length, width_px, height_px,
            sha256, created_by, finalized_at
          ) VALUES (
            ${T1}::uuid, ${wrongEventId}::uuid, ${wrongEventAssetId}::uuid,
            'READY', 'wrong/quarantine', 'wrong/ready', 'wrong.png',
            'image/png', 10, 760, 200, 'wrong-sha', ${manager.userId}::uuid, now()
          )
        `;
        await tx.$executeRaw`
          UPDATE events
          SET published_brand_snapshot = jsonb_set(
            published_brand_snapshot, '{bannerAssetId}', to_jsonb(${wrongEventAssetId}::text)
          )
          WHERE tenant_id = ${T1}::uuid AND id = ${E1}::uuid
        `;
      });
      await assertNoOwnerBanner();
      await withTenant(db, T1, (tx) => tx.$executeRaw`
        UPDATE events
        SET published_brand_snapshot = jsonb_set(
          published_brand_snapshot, '{bannerAssetId}', to_jsonb(${bannerAssetId}::text)
        )
        WHERE tenant_id = ${T1}::uuid AND id = ${E1}::uuid
      `);
      await withTenant(db, T1, (tx) => tx.$executeRaw`
        UPDATE events SET visibility = 'UNLISTED'
        WHERE tenant_id = ${T1}::uuid AND id = ${E1}::uuid
      `);
      await assertNoOwnerBanner();
      await withTenant(db, T1, (tx) => tx.$executeRaw`
        UPDATE events SET content_status = 'ARCHIVED'
        WHERE tenant_id = ${T1}::uuid AND id = ${E1}::uuid
      `);
      await assertNoOwnerBanner();
      await withTenant(db, T1, (tx) => tx.$executeRaw`
        UPDATE events SET content_status = 'PUBLISHED'
        WHERE tenant_id = ${T1}::uuid AND id = ${E1}::uuid
      `);
      await withTenant(db, T1, (tx) => tx.$executeRaw`
        UPDATE events SET visibility = 'PUBLIC', content_status = 'DRAFT'
        WHERE tenant_id = ${T1}::uuid AND id = ${E1}::uuid
      `);
      await assertNoOwnerBanner();
      await withTenant(db, T1, (tx) => tx.$executeRaw`
        UPDATE events SET content_status = 'PUBLISHED'
        WHERE tenant_id = ${T1}::uuid AND id = ${E1}::uuid
      `);
      await withTenant(db, T1, (tx) => tx.$executeRaw`
        UPDATE event_assets SET status = 'QUARANTINE', ready_key = NULL,
          content_type = NULL, byte_length = NULL, width_px = NULL,
          height_px = NULL, finalized_at = NULL
        WHERE tenant_id = ${T1}::uuid AND id = ${bannerAssetId}::uuid
      `);
      await assertNoOwnerBanner();
      await withTenant(db, T1, (tx) => tx.$executeRaw`
        UPDATE event_assets SET status = 'READY', ready_key = 'test/ready/banner',
          content_type = 'image/png', byte_length = 10, width_px = 760,
          height_px = 200, finalized_at = now()
        WHERE tenant_id = ${T1}::uuid AND id = ${bannerAssetId}::uuid
      `);
      await withTenant(db, T1, (tx) => tx.$executeRaw`
        UPDATE events SET published_config_version = NULL
        WHERE tenant_id = ${T1}::uuid AND id = ${E1}::uuid
      `);
      await assertNoOwnerBanner();

      const otherEventId = randomUUID();
      const otherTypeId = randomUUID();
      await withTenant(db, T1, async (tx) => {
        await tx.$executeRaw`
          INSERT INTO events (tenant_id, id, slug, name, status, timezone)
          VALUES (${T1}::uuid, ${otherEventId}::uuid, 'other-event', 'Other Event', 'PUBLISHED', 'UTC')
        `;
        await tx.$executeRaw`
          INSERT INTO ticket_types (tenant_id, event_id, id, label)
          VALUES (${T1}::uuid, ${otherEventId}::uuid, ${otherTypeId}::uuid, 'Wrong Event Type')
        `;
        await tx.$executeRaw`
          UPDATE tickets SET ticket_type_id = ${otherTypeId}::uuid
          WHERE tenant_id = ${T1}::uuid AND id = ${ticketA1.ticketId}::uuid
        `;
        const mismatchedType = await getTicketForOwner(tx, T1, userA.userId, ticketA1.ticketId);
        assert.equal(mismatchedType.ticketTypeLabel, null);
        await tx.$executeRaw`
          UPDATE tickets SET ticket_type_id = ${ticketA1.ticketTypeId}::uuid
          WHERE tenant_id = ${T1}::uuid AND id = ${ticketA1.ticketId}::uuid
        `;
      });

      const bView = await listOwnerTicketsAggregated(db, userB.userId);
      assert.equal(bView.length, 1);
      assert.equal(bView[0].tenantId, T1);
      assert.ok(
        !bView.some(
          (t) =>
            t.ticketId === ticketA1.ticketId ||
            t.ticketId === ticketA2.ticketId,
        ),
      );

      const t1Only = await withTenant(db, T1, (tx) =>
        listTicketsForOwner(tx, T1, userA.userId),
      );
      assert.equal(t1Only.length, 1);
      assert.equal(t1Only[0].ticketId, ticketA1.ticketId);
      assert.equal(
        t1Only[0].startsAt.toISOString(),
        '2026-12-01T00:00:00.000Z',
      );
      assert.equal(t1Only[0].ticketTypeLabel, 'Owner Type One');
      assert.equal(t1Only[0].bannerUrl, null);

      const crossLeak = await withActor(db, userB.userId, (tx) =>
        listAllTicketsForOwner(tx, userA.userId),
      );
      assert.equal(crossLeak.length, 0);

      const roles =
        await db.$queryRaw`SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user`;
      assert.equal(roles[0].rolbypassrls, false);
    } finally {
      if (db) await db.$disconnect();
      if (container) {
        try {
          docker('rm', '-f', container);
        } catch {
          /* ignore */
        }
      }
    }
  },
);
