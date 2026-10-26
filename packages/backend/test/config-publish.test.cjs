const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { migrationFiles } = require('./migration-files.cjs');
const path = require('node:path');
const { Client } = require('pg');
const {
  createDatabase,
  withTenant,
  createPrismaIdentityUserRepository,
  grantMembership,
  grantEventAssignment,
  ConfigError,
  CONFIG_ERROR_CODES,
  AuthzError,
  AUTHZ_ERROR_CODES,
  saveEventConfigVersion,
  publishEventConfig,
  listEventConfigVersions,
  previewEventConfigVersion,
  rollbackEventConfig,
  importRedemptionCodes,
  InventoryError,
  INVENTORY_ERROR_CODES,
  readCodeHmacEnvironment,
  createMemoryObjectStore,
  initEventAssetUpload,
  finalizeEventAssetUpload,
  reencodeRasterAsset,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const MIGRATIONS = migrationFiles();

/** 1×1 PNG */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function typedPayload(overrides = {}) {
  return {
    schemaVersion: 1,
    brand: {
      primaryColor: '#0B3D2E',
      organizationName: overrides.orgName ?? 'MFest',
      ...(overrides.logoAssetId ? { logoAssetId: overrides.logoAssetId } : {}),
      ...(overrides.bannerAssetId ? { bannerAssetId: overrides.bannerAssetId } : {}),
    },
    sections: [
      { kind: 'hero', id: 'hero-1', visible: true, order: 0, body: { title: overrides.title ?? 'MFest', text: 'Hello' } },
      { kind: 'info', id: 'info-1', visible: true, order: 1, body: { title: 'Info', text: 'Details' } },
      { kind: 'redeem', id: 'redeem-1', visible: true, order: 2, body: { title: 'Redeem', text: 'Code' } },
      { kind: 'guide', id: 'guide-1', visible: false, order: 3, body: { title: 'Guide', text: '' } },
      {
        kind: 'faq',
        id: 'faq-1',
        visible: true,
        order: 4,
        body: { title: 'FAQ', items: [{ question: 'When?', answer: 'Sat' }] },
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
  const name = 'ticket-d4-cfg-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker(
    'run', '-d', '--name', name,
    '-e', 'POSTGRES_PASSWORD=' + password,
    '-e', 'POSTGRES_DB=d4_cfg_test',
    '-p', '127.0.0.1::5432',
    'postgres:18.1-alpine',
  );
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try {
      docker('exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'd4_cfg_test');
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  assert.ok(ready, 'database must become ready');
  const port = docker('port', name, '5432/tcp').split(':').at(-1);
  const admin = new Client({
    connectionString: 'postgresql://postgres:' + password + '@127.0.0.1:' + port + '/d4_cfg_test',
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
    await admin.query('CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
    await admin.query('CREATE ROLE ticket_platform_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
    await admin.query('CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS');
    await admin.query('GRANT CREATE, USAGE ON SCHEMA public TO migration_owner');
    await admin.query('SET ROLE migration_owner');
    for (const file of MIGRATIONS) await admin.query(readFileSync(file, 'utf8'));
    await admin.query('RESET ROLE');
    await admin.query(
      "CREATE ROLE d4_login LOGIN PASSWORD '" + password + "' NOSUPERUSER NOBYPASSRLS INHERIT",
    );
    await admin.query('GRANT ticket_runtime TO d4_login');
  } finally {
    await admin.end().catch(() => {});
  }
  return {
    name,
    url: 'postgresql://d4_login:' + password + '@127.0.0.1:' + port + '/d4_cfg_test',
  };
}

async function seedManager(db, tenantId, eventId) {
  const users = createPrismaIdentityUserRepository(db);
  const manager = await users.upsertFromVerifiedIdentity({
    issuer: 'http://127.0.0.1:8080/realms/ticket',
    subject: 'manager',
    email: 'manager@example.com',
    emailVerified: true,
  });
  await withTenant(db, tenantId, async (tx) => {
    await tx.tenant.create({
      data: { id: tenantId, slug: 'cfg-' + tenantId.slice(0, 8), name: 'Cfg Tenant Org' },
    });
    await tx.event.create({
      data: { tenantId, id: eventId, slug: 'launch', name: 'Launch', status: 'DRAFT' },
    });
    const membership = await grantMembership(tx, {
      tenantId,
      userId: manager.userId,
      role: 'MANAGER',
      permissions: ['event.config', 'event.publish', 'inventory.import'],
    });
    await grantEventAssignment(tx, {
      tenantId,
      eventId,
      membershipId: membership.membershipId,
      permissions: ['event.config', 'event.publish', 'inventory.import'],
    });
  });
  return manager;
}

test('config publish is versioned, immutable, and does not rewrite tickets', { timeout: 180000 }, async () => {
  let name;
  let db;
  try {
    const boot = await startIsolatedPostgres();
    name = boot.name;
    db = createDatabase(boot.url, 2);
    const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const eventId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const manager = await seedManager(db, tenantId, eventId);

    const first = await withTenant(db, tenantId, (tx) =>
      saveEventConfigVersion(tx, {
        tenantId,
        eventId,
        actorUserId: manager.userId,
        payload: typedPayload({ title: 'MFest', orgName: 'MFest' }),
      }),
    );
    assert.equal(first.version, 1);
    const second = await withTenant(db, tenantId, (tx) =>
      saveEventConfigVersion(tx, {
        tenantId,
        eventId,
        actorUserId: manager.userId,
        payload: typedPayload({ title: 'MFest', orgName: 'Northline' }),
      }),
    );
    assert.equal(second.version, 2);

    await assert.rejects(
      () =>
        withTenant(db, tenantId, (tx) =>
          publishEventConfig(tx, {
            tenantId,
            eventId,
            actorUserId: manager.userId,
            expectedVersion: 1,
          }),
        ),
      (error) =>
        error instanceof ConfigError &&
        error.code === CONFIG_ERROR_CODES.CONFIG_VERSION_MISMATCH,
    );

    const published = await withTenant(db, tenantId, (tx) =>
      publishEventConfig(tx, {
        tenantId,
        eventId,
        actorUserId: manager.userId,
        expectedVersion: 2,
      }),
    );
    assert.equal(published.publishedConfigVersion, 2);
    assert.equal(published.brandSnapshot.organizationName, 'Northline');
    assert.equal(published.revision, 2);

    await assert.rejects(
      () =>
        withTenant(db, tenantId, (tx) =>
          tx.$executeRaw`UPDATE event_config_versions SET payload = '{"title":"changed"}'::jsonb WHERE version = 2`,
        ),
      (error) => String(error.message).includes('append-only'),
    );

    const stored = await withTenant(db, tenantId, (tx) =>
      tx.$queryRaw`SELECT status, published_config_version, published_brand_snapshot, payload FROM events e JOIN event_config_versions c ON c.tenant_id = e.tenant_id AND c.event_id = e.id AND c.version = e.published_config_version WHERE e.id = ${eventId}::uuid`,
    );
    assert.equal(stored[0].status, 'PUBLISHED');
    assert.equal(stored[0].published_config_version, 2);
    assert.equal(stored[0].payload.brand.organizationName, 'Northline');
    assert.equal(stored[0].published_brand_snapshot.organizationName, 'Northline');

    const history = await withTenant(db, tenantId, (tx) =>
      listEventConfigVersions(tx, {
        tenantId,
        eventId,
        actorUserId: manager.userId,
        limit: 10,
      }),
    );
    assert.equal(history.items.length, 2);
    assert.equal(history.items[0].version, 2);
    assert.equal(history.items[0].published, true);

    const preview = await withTenant(db, tenantId, (tx) =>
      previewEventConfigVersion(tx, {
        tenantId,
        eventId,
        actorUserId: manager.userId,
        version: 1,
      }),
    );
    assert.equal(preview.cacheControl, 'no-store');
    assert.equal(preview.payload.brand.organizationName, 'MFest');
    // Draft version 1 must not change live pointer.
    const live = await withTenant(db, tenantId, (tx) =>
      tx.$queryRaw`SELECT published_config_version FROM events WHERE id = ${eventId}::uuid`,
    );
    assert.equal(live[0].published_config_version, 2);

    const hmac = readCodeHmacEnvironment({
      CODE_HMAC_PEPPER: 'd4-import-pepper!!',
      CODE_HMAC_VERSION: '1',
    });
    const imported = await withTenant(db, tenantId, (tx) =>
      importRedemptionCodes(tx, hmac, {
        tenantId,
        eventId,
        actorUserId: manager.userId,
        rawCodes: ['INVITE-1', 'INVITE-2'],
        eventQuota: 10,
      }),
    );
    assert.equal(imported.imported, 2);
    const quotaBefore = await withTenant(db, tenantId, (tx) =>
      tx.$queryRaw`SELECT capacity, allocated FROM quota_buckets WHERE event_id = ${eventId}::uuid AND scope = 'EVENT'`,
    );
    const codesBefore = await withTenant(db, tenantId, (tx) =>
      tx.$queryRaw`SELECT COUNT(*)::int AS n FROM redemption_codes WHERE event_id = ${eventId}::uuid`,
    );

    // Semantic rollback: new version from v1, live becomes 3; tickets/quota untouched.
    const rolled = await withTenant(db, tenantId, (tx) =>
      rollbackEventConfig(tx, {
        tenantId,
        eventId,
        actorUserId: manager.userId,
        targetVersion: 1,
        expectedPublishedVersion: 2,
        expectedRevision: 2,
        idempotencyKey: randomUUID(),
      }),
    );
    assert.equal(rolled.newVersion, 3);
    assert.equal(rolled.publishedVersion, 3);
    assert.equal(rolled.sourceVersion, 1);
    assert.equal(rolled.revision, 3);

    const after = await withTenant(db, tenantId, (tx) =>
      tx.$queryRaw`SELECT published_config_version, published_brand_snapshot, revision FROM events WHERE id = ${eventId}::uuid`,
    );
    assert.equal(after[0].published_config_version, 3);
    assert.equal(after[0].published_brand_snapshot.organizationName, 'MFest');
    assert.equal(after[0].revision, 3);

    const quotaAfter = await withTenant(db, tenantId, (tx) =>
      tx.$queryRaw`SELECT capacity, allocated FROM quota_buckets WHERE event_id = ${eventId}::uuid AND scope = 'EVENT'`,
    );
    const codesAfter = await withTenant(db, tenantId, (tx) =>
      tx.$queryRaw`SELECT COUNT(*)::int AS n FROM redemption_codes WHERE event_id = ${eventId}::uuid`,
    );
    assert.deepEqual(quotaAfter, quotaBefore);
    assert.deepEqual(codesAfter, codesBefore);

    const immutableCount = await withTenant(db, tenantId, (tx) =>
      tx.$queryRaw`SELECT COUNT(*)::int AS n FROM event_config_versions WHERE event_id = ${eventId}::uuid`,
    );
    assert.equal(immutableCount[0].n, 3);

    await assert.rejects(
      () =>
        withTenant(db, tenantId, (tx) =>
          saveEventConfigVersion(tx, {
            tenantId,
            eventId,
            actorUserId: manager.userId,
            payload: { title: 'raw', brand: 'string-not-object' },
          }),
        ),
      (error) =>
        error instanceof ConfigError &&
        (error.code === CONFIG_ERROR_CODES.CONFIG_INCOMPATIBLE ||
          error.code === CONFIG_ERROR_CODES.CONFIG_SCHEMA_UNSUPPORTED),
    );

    await assert.rejects(
      () =>
        withTenant(db, tenantId, (tx) =>
          saveEventConfigVersion(tx, {
            tenantId,
            eventId,
            actorUserId: manager.userId,
            payload: typedPayload({ title: '<script>alert(1)</script>' }),
          }),
        ),
      (error) =>
        error instanceof ConfigError &&
        error.code === CONFIG_ERROR_CODES.CONFIG_INCOMPATIBLE,
    );

    await assert.rejects(
      () =>
        withTenant(db, tenantId, (tx) =>
          importRedemptionCodes(tx, hmac, {
            tenantId,
            eventId,
            actorUserId: manager.userId,
            rawCodes: ['INVITE-1'],
          }),
        ),
      (error) =>
        error instanceof InventoryError &&
        error.code === INVENTORY_ERROR_CODES.CODE_DUPLICATE,
    );
    const stillPublished = await withTenant(db, tenantId, (tx) =>
      tx.$queryRaw`SELECT status FROM events WHERE id = ${eventId}::uuid`,
    );
    assert.equal(stillPublished[0].status, 'PUBLISHED');
  } finally {
    if (db) await db.$disconnect();
    if (name) execFileSync('docker', ['rm', '-f', name], { stdio: 'ignore' });
  }
});

test('asset quarantine finalize rejects fake MIME/HTML and accepts reencoded PNG', { timeout: 180000 }, async () => {
  let name;
  let db;
  try {
    const boot = await startIsolatedPostgres();
    name = boot.name;
    db = createDatabase(boot.url, 2);
    const tenantId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const eventId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const otherEvent = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const manager = await seedManager(db, tenantId, eventId);
    await withTenant(db, tenantId, async (tx) => {
      await tx.event.create({
        data: {
          tenantId,
          id: otherEvent,
          slug: 'other',
          name: 'Other',
          status: 'DRAFT',
        },
      });
      const membership = await tx.$queryRaw`
        SELECT id FROM memberships WHERE tenant_id = ${tenantId}::uuid AND user_id = ${manager.userId}::uuid
      `;
      await grantEventAssignment(tx, {
        tenantId,
        eventId: otherEvent,
        membershipId: membership[0].id,
        permissions: ['event.config', 'event.publish'],
      });
    });

    const store = createMemoryObjectStore();

    // HTML disguised as PNG must fail decode/magic.
    await assert.rejects(
      () => reencodeRasterAsset(Buffer.from('<!DOCTYPE html><html><body>x</body></html>')),
      (error) =>
        error instanceof ConfigError && error.code === CONFIG_ERROR_CODES.ASSET_INVALID,
    );

    const init = await withTenant(db, tenantId, (tx) =>
      initEventAssetUpload(tx, store, {
        tenantId,
        eventId,
        actorUserId: manager.userId,
        body: {
          filename: 'logo.png',
          contentType: 'image/png',
          byteLength: PNG_1X1.length,
        },
      }),
    );
    assert.ok(init.assetId);
    assert.ok(init.uploadUrl.startsWith('memory://'));

    const key = `tenants/${tenantId}/events/${eventId}/assets/quarantine/${init.assetId}`;
    await store.putObject(key, PNG_1X1, 'image/png');

    const ready = await withTenant(db, tenantId, (tx) =>
      finalizeEventAssetUpload(tx, store, {
        tenantId,
        eventId,
        actorUserId: manager.userId,
        assetId: init.assetId,
      }),
    );
    assert.equal(ready.status, 'READY');
    assert.equal(ready.contentType, 'image/png');
    assert.equal(ready.widthPx, 1);
    assert.equal(ready.heightPx, 1);

    // Cross-event asset id rejected on save.
    await assert.rejects(
      () =>
        withTenant(db, tenantId, (tx) =>
          saveEventConfigVersion(tx, {
            tenantId,
            eventId: otherEvent,
            actorUserId: manager.userId,
            payload: typedPayload({ logoAssetId: init.assetId }),
          }),
        ),
      (error) =>
        error instanceof ConfigError &&
        error.code === CONFIG_ERROR_CODES.ASSET_NOT_FOUND,
    );

    const fakeInit = await withTenant(db, tenantId, (tx) =>
      initEventAssetUpload(tx, store, {
        tenantId,
        eventId,
        actorUserId: manager.userId,
        body: {
          filename: 'evil.png',
          contentType: 'image/png',
          byteLength: 64,
        },
      }),
    );
    const fakeKey = `tenants/${tenantId}/events/${eventId}/assets/quarantine/${fakeInit.assetId}`;
    await store.putObject(
      fakeKey,
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'),
      'image/png',
    );
    await assert.rejects(
      () =>
        withTenant(db, tenantId, (tx) =>
          finalizeEventAssetUpload(tx, store, {
            tenantId,
            eventId,
            actorUserId: manager.userId,
            assetId: fakeInit.assetId,
          }),
        ),
      (error) =>
        error instanceof ConfigError && error.code === CONFIG_ERROR_CODES.ASSET_INVALID,
    );

    // Stale rollback revision conflict.
    await withTenant(db, tenantId, (tx) =>
      saveEventConfigVersion(tx, {
        tenantId,
        eventId,
        actorUserId: manager.userId,
        payload: typedPayload({ logoAssetId: init.assetId, orgName: 'With Logo' }),
      }),
    );
    await withTenant(db, tenantId, (tx) =>
      publishEventConfig(tx, {
        tenantId,
        eventId,
        actorUserId: manager.userId,
        expectedVersion: 1,
      }),
    );
    await assert.rejects(
      () =>
        withTenant(db, tenantId, (tx) =>
          rollbackEventConfig(tx, {
            tenantId,
            eventId,
            actorUserId: manager.userId,
            targetVersion: 1,
            expectedPublishedVersion: 1,
            expectedRevision: 1,
            idempotencyKey: randomUUID(),
          }),
        ),
      (error) =>
        error instanceof ConfigError &&
        error.code === CONFIG_ERROR_CODES.REVISION_CONFLICT,
    );
  } finally {
    if (db) await db.$disconnect();
    if (name) execFileSync('docker', ['rm', '-f', name], { stdio: 'ignore' });
  }
});

test('config save CAS: expectedVersion precondition rejects stale/invalid writers and serializes concurrent saves', { timeout: 180000 }, async () => {
  let name;
  let db;
  try {
    const boot = await startIsolatedPostgres();
    name = boot.name;
    db = createDatabase(boot.url, 2);
    const tenantId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    const eventId = '11111111-1111-4111-8111-111111111111';
    const manager = await seedManager(db, tenantId, eventId);

    // first0: expectedVersion 0 is valid before any save exists.
    const first = await withTenant(db, tenantId, (tx) =>
      saveEventConfigVersion(tx, {
        tenantId,
        eventId,
        actorUserId: manager.userId,
        payload: typedPayload({ title: 'v1' }),
        expectedVersion: 0,
      }),
    );
    assert.equal(first.version, 1);

    // stale: caller read version 0 but version 1 already exists.
    await assert.rejects(
      () =>
        withTenant(db, tenantId, (tx) =>
          saveEventConfigVersion(tx, {
            tenantId,
            eventId,
            actorUserId: manager.userId,
            payload: typedPayload({ title: 'stale' }),
            expectedVersion: 0,
          }),
        ),
      (error) =>
        error instanceof ConfigError &&
        error.code === CONFIG_ERROR_CODES.REVISION_CONFLICT,
    );

    // invalid shapes must reject, not silently coerce.
    for (const invalid of [-1, 1.5, null, 'latest']) {
      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            saveEventConfigVersion(tx, {
              tenantId,
              eventId,
              actorUserId: manager.userId,
              payload: typedPayload({ title: 'invalid' }),
              expectedVersion: invalid,
            }),
          ),
        (error) =>
          error instanceof ConfigError &&
          error.code === CONFIG_ERROR_CODES.CONFIG_VERSION_INVALID,
      );
    }

    // legacy compat: omitted expectedVersion keeps unconditional-save semantics
    // even though the caller's view (version 1) is already stale.
    const legacy = await withTenant(db, tenantId, (tx) =>
      saveEventConfigVersion(tx, {
        tenantId,
        eventId,
        actorUserId: manager.userId,
        payload: typedPayload({ title: 'legacy-caller' }),
      }),
    );
    assert.equal(legacy.version, 2);

    // concurrent same expectedVersion: exactly one append succeeds, the other
    // observes the conflict instead of appending a stale payload.
    const baseline = 2;
    const results = await Promise.allSettled([
      withTenant(db, tenantId, (tx) =>
        saveEventConfigVersion(tx, {
          tenantId,
          eventId,
          actorUserId: manager.userId,
          payload: typedPayload({ title: 'racer-A' }),
          expectedVersion: baseline,
        }),
      ),
      withTenant(db, tenantId, (tx) =>
        saveEventConfigVersion(tx, {
          tenantId,
          eventId,
          actorUserId: manager.userId,
          payload: typedPayload({ title: 'racer-B' }),
          expectedVersion: baseline,
        }),
      ),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    assert.equal(fulfilled.length, 1, 'exactly one concurrent save must win');
    assert.equal(rejected.length, 1, 'exactly one concurrent save must conflict');
    assert.ok(
      rejected[0].reason instanceof ConfigError &&
        rejected[0].reason.code === CONFIG_ERROR_CODES.REVISION_CONFLICT,
    );
    assert.equal(fulfilled[0].value.version, baseline + 1);

    const rows = await withTenant(db, tenantId, (tx) =>
      tx.$queryRaw`SELECT version, payload FROM event_config_versions WHERE tenant_id = ${tenantId}::uuid AND event_id = ${eventId}::uuid ORDER BY version`,
    );
    assert.equal(rows.length, baseline + 1, 'no stale payload was appended');
    const winnerTitle = rows[rows.length - 1].payload.sections[0].body.title;
    assert.ok(winnerTitle === 'racer-A' || winnerTitle === 'racer-B');

    // auth negative: RBAC — a membership without event.config must still be
    // denied even when it supplies a correct expectedVersion.
    const viewer = await createPrismaIdentityUserRepository(
      db,
    ).upsertFromVerifiedIdentity({
      issuer: 'http://127.0.0.1:8080/realms/ticket',
      subject: 'viewer',
      email: 'viewer@example.com',
      emailVerified: true,
    });
    await withTenant(db, tenantId, async (tx) => {
      const viewerMembership = await grantMembership(tx, {
        tenantId,
        userId: viewer.userId,
        role: 'VIEWER',
        permissions: ['event.publish'],
      });
      await grantEventAssignment(tx, {
        tenantId,
        eventId,
        membershipId: viewerMembership.membershipId,
        permissions: ['event.publish'],
      });
    });
    const currentLatest = rows.length;
    await assert.rejects(
      () =>
        withTenant(db, tenantId, (tx) =>
          saveEventConfigVersion(tx, {
            tenantId,
            eventId,
            actorUserId: viewer.userId,
            payload: typedPayload({ title: 'no-permission' }),
            expectedVersion: currentLatest,
          }),
        ),
      (error) =>
        error instanceof AuthzError &&
        error.code === AUTHZ_ERROR_CODES.PERMISSION_DENIED,
    );

    // auth negative: tenant isolation under real RLS runtime role — a manager
    // from a second tenant has no membership/assignment row scoped to the
    // first tenant's event, so deny-by-default rejects before any row lock.
    const otherTenantId = '22222222-2222-4222-8222-222222222222';
    const otherManager = await seedManager(
      db,
      otherTenantId,
      '33333333-3333-4333-8333-333333333333',
    );
    await assert.rejects(
      () =>
        withTenant(db, otherTenantId, (tx) =>
          saveEventConfigVersion(tx, {
            tenantId: otherTenantId,
            eventId,
            actorUserId: otherManager.userId,
            payload: typedPayload({ title: 'cross-tenant' }),
            expectedVersion: currentLatest,
          }),
        ),
      (error) =>
        error instanceof AuthzError &&
        error.code === AUTHZ_ERROR_CODES.EVENT_ASSIGNMENT_REQUIRED,
    );

    // no stale append from any of the rejected negative-path attempts above.
    const finalRows = await withTenant(db, tenantId, (tx) =>
      tx.$queryRaw`SELECT COUNT(*)::int AS n FROM event_config_versions WHERE tenant_id = ${tenantId}::uuid AND event_id = ${eventId}::uuid`,
    );
    assert.equal(finalRows[0].n, baseline + 1);
  } finally {
    if (db) await db.$disconnect();
    if (name) execFileSync('docker', ['rm', '-f', name], { stdio: 'ignore' });
  }
});
