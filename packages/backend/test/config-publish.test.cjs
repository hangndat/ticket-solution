const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { readFileSync } = require('node:fs');
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
  saveEventConfigVersion,
  publishEventConfig,
  importRedemptionCodes,
  readEventQuota,
  InventoryError,
  INVENTORY_ERROR_CODES,
  readCodeHmacEnvironment,
  hashRedemptionCode,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const MIGRATIONS = [
  '202610160001_foundation',
  '202610160002_d1_users',
  '202610160003_d1_membership',
  '202610160004_d2_issue_ticket',
  '202610170005_d3_gate',
  '202610170006_d4_config_publish',
].map((name) => path.join(__dirname, '../prisma/migrations', name, 'migration.sql'));

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

test('config publish is versioned, immutable, and does not rewrite tickets', { timeout: 120000 }, async () => {
  let name;
  let db;
  try {
    const boot = await startIsolatedPostgres();
    name = boot.name;
    db = createDatabase(boot.url, 2);
    const users = createPrismaIdentityUserRepository(db);
    const manager = await users.upsertFromVerifiedIdentity({
      issuer: 'http://127.0.0.1:8080/realms/ticket',
      subject: 'manager',
      email: 'manager@example.com',
      emailVerified: true,
    });
    const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const eventId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    await withTenant(db, tenantId, async (tx) => {
      await tx.tenant.create({ data: { id: tenantId, slug: 'cfg', name: 'Cfg' } });
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

    const first = await withTenant(db, tenantId, (tx) =>
      saveEventConfigVersion(tx, {
        tenantId,
        eventId,
        actorUserId: manager.userId,
        payload: { title: 'Fun Fest', brand: 'Sunburst' },
      }),
    );
    assert.equal(first.version, 1);
    const second = await withTenant(db, tenantId, (tx) =>
      saveEventConfigVersion(tx, {
        tenantId,
        eventId,
        actorUserId: manager.userId,
        payload: { title: 'Fun Fest', brand: 'Northline' },
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

    await assert.rejects(
      () =>
        withTenant(db, tenantId, (tx) =>
          tx.$executeRaw`UPDATE event_config_versions SET payload = '{"title":"changed"}'::jsonb WHERE version = 2`,
        ),
      (error) => String(error.message).includes('append-only'),
    );

    const stored = await withTenant(db, tenantId, (tx) =>
      tx.$queryRaw`SELECT status, published_config_version, payload FROM events e JOIN event_config_versions c ON c.tenant_id = e.tenant_id AND c.event_id = e.id AND c.version = e.published_config_version WHERE e.id = ${eventId}::uuid`,
    );
    assert.equal(stored[0].status, 'PUBLISHED');
    assert.equal(stored[0].published_config_version, 2);
    assert.equal(stored[0].payload.title, 'Fun Fest');
    assert.equal(stored[0].payload.brand, 'Northline');

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
    const quota = await withTenant(db, tenantId, (tx) =>
      readEventQuota(tx, { tenantId, eventId, actorUserId: manager.userId }),
    );
    assert.equal(quota.capacity, 10);
    assert.equal(quota.allocated, 0);
    const storedCodes = await withTenant(db, tenantId, (tx) =>
      tx.$queryRaw`SELECT code_hmac FROM redemption_codes WHERE event_id = ${eventId}::uuid`,
    );
    const hashes = storedCodes.map((row) => row.code_hmac).sort();
    assert.deepEqual(
      hashes,
      ['INVITE-1', 'INVITE-2'].map((code) => hashRedemptionCode(hmac, code)).sort(),
    );
    assert.ok(!JSON.stringify(storedCodes).includes('INVITE-1'));
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
