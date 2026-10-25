/** Local #899 rehearsal: real PG/RLS and two built backend revisions, synthetic providers. */
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');

const [oldDir, newDir] = process.argv.slice(2).map((item) => path.resolve(item));
assert.ok(oldDir && newDir, 'pass old and new verified release directories');
const oldManifest = require(path.join(oldDir, 'release-manifest.json'));
const newManifest = require(path.join(newDir, 'release-manifest.json'));
assert.notEqual(oldManifest.sourceSha, newManifest.sourceSha);
assert.equal(oldManifest.workerPendingPushSafe, true);
assert.equal(newManifest.workerPendingPushSafe, true);
const old = require(path.join(oldDir, 'packages/backend/dist'));
const next = require(path.join(newDir, 'packages/backend/dist'));
const { Client } = require(path.join(oldDir, 'packages/backend/node_modules/pg'));
const {
  createDatabase, withTenant, createPrismaIdentityUserRepository,
  grantMembership, grantEventAssignment, seedEventInventory,
  redeemAndIssueTicket, unwrapRedeemOutcome, readCodeHmacEnvironment,
  publishNotificationTemplate, publishEventConfig, saveEventConfigVersion,
  DEFAULT_TICKET_ISSUED_TEMPLATE, registerDeviceToken,
} = old;

// Reuse the application's established TicketIssued fixture body. Keep its PG
// schema setup below explicit so the two migration revisions are observable.
const fixtureSource = readFileSync(path.join(__dirname, '../packages/backend/test/apns-atleast-once.test.cjs'), 'utf8');
const fixtureBody = fixtureSource.slice(
  fixtureSource.indexOf('async function seedTicketIssuedFixture('),
  fixtureSource.indexOf('\ntest(', fixtureSource.indexOf('async function seedTicketIssuedFixture(')),
);
assert.ok(fixtureBody.startsWith('async function seedTicketIssuedFixture('));
const seedTicketIssuedFixture = eval(`(${fixtureBody.trim()})`);
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const migrationDir = (release) => path.join(release, 'packages/backend/prisma/migrations');
const migrationFiles = (release) => readdirSync(migrationDir(release))
  .filter((item) => /^\d/.test(item))
  .sort()
  .map((item) => path.join(migrationDir(release), item, 'migration.sql'));

async function main() {
  const name = `ticket-ar891-pg-${randomBytes(4).toString('hex')}`;
  const password = randomBytes(18).toString('hex');
  const externalUrl = process.env.RELEASE_PG_URL;
  let admin, oldDb, newDb;
  try {
    if (!externalUrl) docker('run', '-d', '--name', name, '--label', 'ticket.task=ar891-t5-pg-rehearsal',
      '-e', `POSTGRES_PASSWORD=${password}`, '-e', 'POSTGRES_DB=release_rehearsal',
      '-p', '127.0.0.1::5432', 'postgres:18.1-alpine');
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        if (externalUrl) { const probe = new Client({ connectionString: externalUrl }); await probe.connect(); await probe.end(); }
        else docker('exec', name, 'pg_isready', '-U', 'postgres', '-d', 'release_rehearsal');
        ready = true; break;
      }
      catch { await new Promise((resolve) => setTimeout(resolve, 400)); }
    }
    assert.ok(ready, 'isolated PG ready');
    const port = externalUrl ? null : docker('port', name, '5432/tcp').split(':').at(-1);
    const url = externalUrl || `postgresql://postgres:${password}@127.0.0.1:${port}/release_rehearsal`;
    admin = new Client({ connectionString: url });
    await admin.connect();
    for (const role of ['ticket_runtime', 'ticket_platform_runtime', 'migration_owner']) {
      await admin.query(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOBYPASSRLS`);
    }
    await admin.query('GRANT CREATE, USAGE ON SCHEMA public TO migration_owner');
    await admin.query('SET ROLE migration_owner');
    const oldMigrations = migrationFiles(oldDir);
    for (const file of oldMigrations) await admin.query(readFileSync(file, 'utf8'));
    await admin.query('RESET ROLE');
    await admin.query('GRANT USAGE ON SCHEMA public TO ticket_runtime');
    await admin.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ticket_runtime');
    await admin.query('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ticket_runtime');
    await admin.query("ALTER DATABASE release_rehearsal SET app.tenant_id TO ''");
    oldDb = old.createDatabase(url, 2);
    newDb = next.createDatabase(url, 2);
    const hmac = old.readCodeHmacEnvironment({ CODE_HMAC_PEPPER: 'release-fixture-pepper', CODE_HMAC_VERSION: '1' });
    const credentialKeyMaterial = 'release-fixture-credential-key';
    const { tenantId, ticketId } = await seedTicketIssuedFixture(oldDb, hmac, credentialKeyMaterial);
    let emailSends = 0;
    const emailBase = old.createNoopEmailAdapter();
    const email = { ...emailBase, async sendTicketIssued(payload) {
      emailSends += 1; return emailBase.sendTicketIssued(payload);
    } };
    let pushSends = 0;
    const failingPush = { async send() {
      pushSends += 1;
      return { ok: false, providerStatus: 'FAILED', reason: 'synthetic temporary',
        invalidateToken: false, retryable: true };
    } };
    const opts = { credentialKeyMaterial, publicWebBaseUrl: 'https://tickets.example.test',
      env: { NODE_ENV: 'test' }, apns: failingPush,
      retryConfig: { maxAttempts: 3, initialBackoffSeconds: 1, maxBackoffSeconds: 1, jitterRatio: 0 } };
    const first = await old.relayOutboxOnce(oldDb, email, 'release-old-worker', 10, opts);
    assert.equal(first.completed, 0, 'pending push must not produce false COMPLETE');
    const before = await old.withTenant(oldDb, tenantId, async (tx) => ({
      outbox: await tx.$queryRaw`SELECT id, status FROM outbox WHERE tenant_id = ${tenantId}::uuid AND aggregate_id = ${ticketId}::uuid AND type = 'TicketIssued'`,
      notes: await tx.$queryRaw`SELECT channel, state FROM notifications WHERE tenant_id = ${tenantId}::uuid ORDER BY channel`,
    }));
    assert.deepEqual(before.notes.map((item) => [item.channel, item.state]), [['email', 'ACCEPTED'], ['push', 'FAILED']]);
    assert.notEqual(before.outbox[0].status, 'COMPLETE');

    // Real additive migration from the second revision, applied while old API
    // stays usable. The first revision did not contain these files.
    const additional = migrationFiles(newDir).filter((file) =>
      !oldMigrations.some((oldFile) => path.basename(path.dirname(oldFile)) === path.basename(path.dirname(file))));
    assert.ok(additional.length > 0, 'two revisions must have an additive migration delta');
    await admin.query('SET ROLE migration_owner');
    for (const file of additional) await admin.query(readFileSync(file, 'utf8'));
    await admin.query('RESET ROLE');
    const smokeOld = await old.withTenant(oldDb, tenantId, (tx) =>
      tx.$queryRaw`SELECT status FROM outbox WHERE tenant_id = ${tenantId}::uuid AND id = ${before.outbox[0].id}::uuid`);
    const smokeNew = await next.withTenant(newDb, tenantId, (tx) =>
      tx.$queryRaw`SELECT status FROM outbox WHERE tenant_id = ${tenantId}::uuid AND id = ${before.outbox[0].id}::uuid`);
    assert.equal(smokeOld[0].status, smokeNew[0].status);

    // Recreate a crashed worker's expired lease over durable email/push state.
    await old.withTenant(oldDb, tenantId, (tx) => tx.$executeRaw`
      UPDATE outbox SET status = 'PROCESSING', lease_owner = 'release-crashed-worker',
        lease_token = ${randomUUID()}::uuid,
        lease_expires_at = clock_timestamp() - interval '1 second', next_attempt_at = NULL
      WHERE tenant_id = ${tenantId}::uuid AND id = ${before.outbox[0].id}::uuid`);
    await old.withTenant(oldDb, tenantId, (tx) => tx.$executeRaw`
      UPDATE notifications SET state = 'PENDING', next_attempt_at = NULL
      WHERE tenant_id = ${tenantId}::uuid AND channel = 'push'`);
    const succeedingPush = { async send() {
      pushSends += 1;
      return { ok: true, providerStatus: 'ACCEPTED', providerRef: 'synthetic:accepted', resolvedEnvironment: 'sandbox' };
    } };
    const recovered = await next.relayOutboxOnce(newDb, email, 'release-new-worker', 10,
      { ...opts, apns: succeedingPush });
    assert.equal(recovered.claimed, 1);
    assert.equal(recovered.completed, 1);
    const after = await next.withTenant(newDb, tenantId, async (tx) => ({
      outbox: await tx.$queryRaw`SELECT status FROM outbox WHERE tenant_id = ${tenantId}::uuid AND id = ${before.outbox[0].id}::uuid`,
      notes: await tx.$queryRaw`SELECT channel, state FROM notifications WHERE tenant_id = ${tenantId}::uuid ORDER BY channel`,
    }));
    assert.equal(after.outbox[0].status, 'COMPLETE');
    assert.deepEqual(after.notes.map((item) => [item.channel, item.state]), [['email', 'ACCEPTED'], ['push', 'ACCEPTED']]);
    assert.equal(emailSends, 1);
    assert.equal(pushSends, 2);
    // Compatible app rollback: old worker resumes against expanded schema and
    // preserves both terminal notification acknowledgements.
    await next.withTenant(newDb, tenantId, (tx) => tx.$executeRaw`
      UPDATE outbox SET status = 'PROCESSING', lease_owner = 'release-rollback-crashed',
        lease_token = ${randomUUID()}::uuid,
        lease_expires_at = clock_timestamp() - interval '1 second', next_attempt_at = NULL
      WHERE tenant_id = ${tenantId}::uuid AND id = ${before.outbox[0].id}::uuid`);
    const rollback = await old.relayOutboxOnce(oldDb, email, 'release-rollback-old-worker', 10,
      { ...opts, apns: succeedingPush });
    assert.equal(rollback.claimed, 1);
    assert.equal(rollback.completed, 1);
    assert.equal(emailSends, 1);
    assert.equal(pushSends, 2);
    const counters = await admin.query("SELECT reclaim_count FROM worker_job_reclaim_counters WHERE job_class = 'relay_outbox'");
    assert.ok(Number(counters.rows[0]?.reclaim_count) >= 1);
    console.log(JSON.stringify({ oldSource: oldManifest.sourceSha, newSource: newManifest.sourceSha,
      additiveMigrations: additional.map((file) => path.basename(path.dirname(file))),
      oldApiAfterExpand: smokeOld[0].status, newApiAfterExpand: smokeNew[0].status,
      before: { outbox: before.outbox[0].status, notes: before.notes },
      after, rollback: { claimed: rollback.claimed, completed: rollback.completed },
      emailSends, pushSends, reclaimCount: Number(counters.rows[0].reclaim_count) }));
  } finally {
    if (oldDb) await oldDb.$disconnect();
    if (newDb) await newDb.$disconnect();
    if (admin) await admin.end().catch(() => {});
    if (!externalUrl) try { docker('rm', '-f', '-v', name); } catch { /* container may not have started */ }
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
