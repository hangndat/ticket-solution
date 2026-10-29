'use strict';

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
  withPlatformRole,
  createPrismaIdentityUserRepository,
  grantMembership,
  grantEventAssignment,
  saveEventConfigVersion,
  publishEventConfig,
  seedD9DemoDataset,
  listPublishedEvents,
  listPlatformPublishedEvents,
  getPublishedEventDetail,
  PublishedEventsError,
  PUBLISHED_EVENTS_ERROR_CODES,
  D9_DEMO,
  readCodeHmacEnvironment,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS = migrationFiles();

function typedPayload(overrides = {}) {
  return {
    schemaVersion: 1,
    brand: {
      primaryColor: overrides.primaryColor ?? '#245B47',
      organizationName: overrides.orgName ?? 'Pub Org',
    },
    sections: [
      {
        kind: 'hero',
        id: 'hero-1',
        visible: true,
        order: 0,
        body: { title: overrides.title ?? 'Hero', text: 'Hello public' },
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
        body: { title: 'Terms', termsVersion: 'terms-v1', text: 'Be kind' },
      },
    ],
    termsVersion: 'terms-v1',
  };
}

async function startIsolatedPostgres() {
  const name = 'ticket-pub-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=pub_test',
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
        'pub_test',
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
      'postgresql://postgres:' + password + '@127.0.0.1:' + port + '/pub_test',
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
    await admin.query('GRANT CREATE, USAGE ON SCHEMA public TO migration_owner');
    await admin.query('SET ROLE migration_owner');
    for (const file of MIGRATIONS) await admin.query(readFileSync(file, 'utf8'));
    await admin.query('RESET ROLE');
    await admin.query(
      "CREATE ROLE pub_login LOGIN PASSWORD '" +
        password +
        "' NOSUPERUSER NOBYPASSRLS INHERIT",
    );
    await admin.query('GRANT ticket_runtime TO pub_login');
    await admin.query('GRANT ticket_platform_runtime TO pub_login');
  } finally {
    await admin.end().catch(() => {});
  }
  return {
    name,
    url: 'postgresql://pub_login:' + password + '@127.0.0.1:' + port + '/pub_test',
  };
}

test(
  'public published events: 200 demo seed + 404 unpublished',
  { timeout: 240000 },
  async () => {
    let name;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      name = boot.name;
      db = createDatabase(boot.url, 2);
      const hmac = readCodeHmacEnvironment({
        CODE_HMAC_PEPPER: 'pub-events-test-pepper!!',
        CODE_HMAC_VERSION: '1',
      });

      const oidc = 'http://127.0.0.1:8080/realms/ticket';
      const first = await seedD9DemoDataset(db, hmac, { oidcIssuer: oidc });
      assert.equal(first.fixture, true);
      assert.ok(first.configsPublished >= 1);
      const second = await seedD9DemoDataset(db, hmac, { oidcIssuer: oidc });
      assert.equal(second.configsPublished, 0);
      assert.ok(second.configsSkipped >= 1);

      const platformList = await listPlatformPublishedEvents(db, { limit: 20 });
      assert.ok(platformList.items.length >= 1);
      assert.ok(
        platformList.items.some(
          (row) =>
            row.tenantSlug === 'mfest-demo' && row.slug === 'mfest',
        ),
      );
      for (const row of platformList.items) {
        assert.equal('contentStatus' in row, false);
        assert.match(row.tenantId, /^[0-9a-f-]{36}$/i);
      }

      const list = await listPublishedEvents(db, {
        tenantSlug: D9_DEMO.tenants.mfest.slug,
      });
      assert.ok(list);
      assert.equal(list.items.length, 1);
      assert.equal(list.items[0].slug, 'mfest');
      assert.equal(list.items[0].tenantSlug, 'mfest-demo');
      assert.equal(list.items[0].tenantId, D9_DEMO.tenants.mfest.id);
      assert.ok(list.items[0].publishedConfigVersion >= 1);
      assert.equal(list.nextCursor, null);

      const detail = await getPublishedEventDetail(db, {
        tenantSlug: 'mfest-demo',
        eventSlug: 'mfest',
      });
      assert.ok(detail);
      assert.equal(detail.slug, 'mfest');
      assert.equal(detail.tenantId, D9_DEMO.tenants.mfest.id);
      assert.ok(detail.sections.some((s) => s.kind === 'hero'));
      assert.ok(detail.faq.length >= 1);
      assert.ok(
        detail.faq.every(
          (item) =>
            !/fixture|not a real|DEMO-\*/i.test(`${item.q} ${item.a}`),
        ),
      );
      assert.ok(detail.terms);
      assert.equal(detail.terms.version, 'terms-v1');
      assert.ok(
        !/fixture|not a real contract/i.test(detail.terms.bodyMarkdown || ''),
      );
      // No admin / lifecycle fields on projection
      assert.equal('contentStatus' in detail, false);
      assert.equal('revision' in detail, false);

      // Force republish bumps published config version and refreshes marketing.
      const beforeForce = detail.publishedConfigVersion;
      const forced = await seedD9DemoDataset(db, hmac, {
        oidcIssuer: oidc,
        forceRepublishMarketing: true,
      });
      assert.ok(forced.configsPublished >= 1);
      assert.equal(forced.configsSkipped, 0);
      const afterForce = await getPublishedEventDetail(db, {
        tenantSlug: 'mfest-demo',
        eventSlug: 'mfest',
      });
      assert.ok(afterForce);
      assert.ok(afterForce.publishedConfigVersion > beforeForce);
      assert.equal(afterForce.terms.version, 'terms-v1');

      assert.equal(
        await getPublishedEventDetail(db, {
          tenantSlug: 'mfest-demo',
          eventSlug: 'no-such-event',
        }),
        null,
      );
      assert.equal(
        await listPublishedEvents(db, { tenantSlug: 'unknown-tenant' }),
        null,
      );

      await assert.rejects(
        () => listPlatformPublishedEvents(db, { cursor: 'not-opaque' }),
        (error) =>
          error instanceof PublishedEventsError &&
          error.code === PUBLISHED_EVENTS_ERROR_CODES.INVALID_CURSOR,
      );

      // Unpublished draft under same tenant → 404
      const draftId = randomUUID();
      const users = createPrismaIdentityUserRepository(db);
      const manager = await users.upsertFromVerifiedIdentity({
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'pub-manager',
        email: 'pub-manager@example.com',
        emailVerified: true,
      });
      await withTenant(db, D9_DEMO.tenants.mfest.id, async (tx) => {
        await tx.$executeRaw`
          INSERT INTO events (
            tenant_id, id, slug, name, status, content_status, business_status,
            visibility, timezone, revision
          ) VALUES (
            ${D9_DEMO.tenants.mfest.id}::uuid, ${draftId}::uuid, 'draft-only',
            'Draft Only', 'DRAFT', 'DRAFT', 'ACTIVE', 'PUBLIC',
            'Asia/Ho_Chi_Minh', 1
          )
        `;
        const membership = await grantMembership(tx, {
          tenantId: D9_DEMO.tenants.mfest.id,
          userId: manager.userId,
          role: 'MANAGER',
          permissions: ['event.config', 'event.publish'],
        });
        await grantEventAssignment(tx, {
          tenantId: D9_DEMO.tenants.mfest.id,
          eventId: draftId,
          membershipId: membership.membershipId,
          permissions: ['event.config', 'event.publish'],
        });
        await saveEventConfigVersion(tx, {
          tenantId: D9_DEMO.tenants.mfest.id,
          eventId: draftId,
          actorUserId: manager.userId,
          payload: typedPayload({ title: 'Draft Hero' }),
        });
        // intentionally not published
      });

      assert.equal(
        await getPublishedEventDetail(db, {
          tenantSlug: 'mfest-demo',
          eventSlug: 'draft-only',
        }),
        null,
      );

      // Publish draft then visible
      await withTenant(db, D9_DEMO.tenants.mfest.id, async (tx) => {
        await publishEventConfig(tx, {
          tenantId: D9_DEMO.tenants.mfest.id,
          eventId: draftId,
          actorUserId: manager.userId,
          expectedVersion: 1,
        });
      });
      const publishedDraft = await getPublishedEventDetail(db, {
        tenantSlug: 'mfest-demo',
        eventSlug: 'draft-only',
      });
      assert.ok(publishedDraft);
      assert.equal(publishedDraft.name, 'Draft Only');
      const list2 = await listPublishedEvents(db, {
        tenantSlug: 'mfest-demo',
        limit: 10,
      });
      assert.ok(list2);
      assert.equal(list2.items.length, 2);

      const platformAfterDraft = await listPlatformPublishedEvents(db, {
        limit: 50,
      });
      assert.ok(
        platformAfterDraft.items.some((row) => row.slug === 'draft-only'),
      );
      await withTenant(db, D9_DEMO.tenants.mfest.id, async (tx) => {
        await tx.$executeRaw`
          UPDATE events SET visibility = 'UNLISTED'
          WHERE tenant_id = ${D9_DEMO.tenants.mfest.id}::uuid AND id = ${draftId}::uuid
        `;
      });
      const unlistedDetail = await getPublishedEventDetail(db, {
        tenantSlug: 'mfest-demo',
        eventSlug: 'draft-only',
      });
      assert.ok(unlistedDetail);
      assert.equal(unlistedDetail.publishedConfigVersion, publishedDraft.publishedConfigVersion);
      assert.equal(unlistedDetail.sections[0].title, 'Draft Hero');
      const tenantCatalog = await listPublishedEvents(db, { tenantSlug: 'mfest-demo' });
      assert.deepEqual(tenantCatalog.items.map((row) => row.slug), ['mfest']);
      const platformCatalog = await listPlatformPublishedEvents(db, { limit: 50 });
      assert.equal(platformCatalog.items.some((row) => row.slug === 'draft-only'), false);

      await withTenant(db, D9_DEMO.tenants.mfest.id, async (tx) => {
        await tx.$executeRaw`
          UPDATE events SET visibility = 'PUBLIC'
          WHERE tenant_id = ${D9_DEMO.tenants.mfest.id}::uuid AND id = ${draftId}::uuid
        `;
      });
      const page1 = await listPlatformPublishedEvents(db, { limit: 1 });
      if (page1.nextCursor) {
        const page2 = await listPlatformPublishedEvents(db, {
          cursor: page1.nextCursor,
          limit: 1,
        });
        assert.notEqual(page2.items[0]?.id, page1.items[0]?.id);
      }
      await withPlatformRole(db, async (tx) => {
        await tx.$executeRaw`
          UPDATE tenants SET status = 'SUSPENDED'
          WHERE id = ${D9_DEMO.tenants.mfest.id}::uuid
        `;
      });
      assert.equal(
        await getPublishedEventDetail(db, {
          tenantSlug: 'mfest-demo',
          eventSlug: 'draft-only',
        }),
        null,
      );
      assert.equal(await listPublishedEvents(db, { tenantSlug: 'mfest-demo' }), null);
      const suspendedCatalog = await listPlatformPublishedEvents(db, { limit: 50 });
      assert.equal(suspendedCatalog.items.some((row) => row.tenantSlug === 'mfest-demo'), false);
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
