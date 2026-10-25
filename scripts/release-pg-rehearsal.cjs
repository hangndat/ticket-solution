/** Local #899 rehearsal: real PG/RLS and two built backend revisions, synthetic providers. */
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { readFileSync, readdirSync, mkdtempSync, cpSync, copyFileSync, mkdirSync, writeFileSync, rmSync, symlinkSync } = require('node:fs');
const os = require('node:os');
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
const migrateDeploy = (release, url) => execFileSync('pnpm',
 ['--filter', '@ticket/backend', 'exec', 'prisma', 'migrate', 'deploy'],
 { cwd: release, env: { ...process.env, MIGRATION_DATABASE_URL: url }, encoding: 'utf8' }).trim();
const prismaFixture = (release, url, config, ...args) => spawnSync('pnpm',
 ['--filter', '@ticket/backend', 'exec', 'prisma', '--config', config, 'migrate', ...args],
 { cwd: release, env: { ...process.env, MIGRATION_DATABASE_URL: url }, encoding: 'utf8' });

async function main() {
  const name = `ticket-ar891-pg-${randomBytes(4).toString('hex')}`;
  const password = randomBytes(18).toString('hex');
  const externalUrl = process.env.RELEASE_PG_URL;
 let admin, oldDb, newDb, recoveryRoot;
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
  await admin.query("CREATE ROLE ticket_app LOGIN NOSUPERUSER NOBYPASSRLS INHERIT PASSWORD 'synthetic-runtime-only'");
  await admin.query('GRANT ticket_runtime TO ticket_app');
  await admin.query("ALTER ROLE migration_owner LOGIN PASSWORD 'synthetic-migration-only'");
    await admin.query('GRANT CREATE, USAGE ON SCHEMA public TO migration_owner');
    const oldMigrations = migrationFiles(oldDir);
  const migrationConnection = new URL(url);
  migrationConnection.username = 'migration_owner';
  migrationConnection.password = 'synthetic-migration-only';
  const migrationUrl = migrationConnection.toString();
  const runtimeConnection = new URL(url);
  runtimeConnection.username = 'ticket_app';
  runtimeConnection.password = 'synthetic-runtime-only';
  const runtimeUrl = runtimeConnection.toString();
  const oldDeploy = migrateDeploy(oldDir, migrationUrl);
    await admin.query('GRANT USAGE ON SCHEMA public TO ticket_runtime');
    await admin.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ticket_runtime');
    await admin.query('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ticket_runtime');
    await admin.query("ALTER DATABASE release_rehearsal SET app.tenant_id TO ''");
  oldDb = old.createDatabase(runtimeUrl, 2);
  newDb = next.createDatabase(runtimeUrl, 2);
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
  const newDeploy = migrateDeploy(newDir, migrationUrl);
  const migrationRows = await admin.query('SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY migration_name');
  assert.equal(migrationRows.rows.length, migrationFiles(newDir).length);
  assert.ok(migrationRows.rows.every((row) => row.finished_at && !row.rolled_back_at));
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
  // Synthetic migration lives only in a temporary source tree, never in the
  // business migration chain. Its first statement commits before the fault.
  recoveryRoot = mkdtempSync(path.join(os.tmpdir(), 'ar891-forward-repair-'));
  const fixtureSchema = path.join(recoveryRoot, 'schema.prisma');
  const fixtureConfig = path.join(recoveryRoot, 'prisma.config.ts');
  symlinkSync(path.join(newDir, 'packages/backend/node_modules'), path.join(recoveryRoot, 'node_modules'));
  writeFileSync(fixtureConfig,
   `import { defineConfig } from 'prisma/config';\nexport default defineConfig({ schema: ${JSON.stringify(fixtureSchema)}, migrations: { path: ${JSON.stringify(path.join(recoveryRoot, 'migrations'))} }, datasource: { url: process.env['MIGRATION_DATABASE_URL'] ?? '' } });\n`);
  copyFileSync(path.join(newDir, 'packages/backend/prisma/schema.prisma'), fixtureSchema);
  cpSync(migrationDir(newDir), path.join(recoveryRoot, 'migrations'), { recursive: true });
  const brokenName = '209901010001_ar891_synthetic_failure';
  const brokenDir = path.join(recoveryRoot, 'migrations', brokenName);
  mkdirSync(brokenDir);
  writeFileSync(path.join(brokenDir, 'migration.sql'),
   "ALTER TABLE outbox ADD COLUMN rehearsal_repair_note text;\n" +
   `UPDATE outbox SET rehearsal_repair_note = 'PARTIAL' WHERE tenant_id = '${tenantId}';\n` +
   'SELECT 1 / 0;\n');
  const failed = prismaFixture(newDir, migrationUrl, fixtureConfig, 'deploy');
  assert.notEqual(failed.status, 0, `synthetic migration must fail: ${failed.stdout} ${failed.stderr}`);
  const failedRow = await admin.query('SELECT finished_at, rolled_back_at, logs FROM _prisma_migrations WHERE migration_name = $1', [brokenName]);
  assert.equal(failedRow.rows.length, 1);
  assert.equal(failedRow.rows[0].finished_at, null);
  assert.equal(failedRow.rows[0].rolled_back_at, null);
  assert.match(failedRow.rows[0].logs ?? '', /division by zero/i);
  const partial = await admin.query('SELECT rehearsal_repair_note FROM outbox WHERE tenant_id = $1', [tenantId]);
  assert.ok(partial.rows.some((row) => row.rehearsal_repair_note === 'PARTIAL'), 'partial write must survive failure');
  const repairSql = `UPDATE outbox SET rehearsal_repair_note = 'REPAIRED' WHERE tenant_id = '${tenantId}' AND rehearsal_repair_note = 'PARTIAL'`;
  await admin.query(repairSql);
  const repairedBeforeRepeat = await admin.query('SELECT id, tenant_id, status, rehearsal_repair_note FROM outbox ORDER BY id');
  await admin.query(repairSql);
  const repairedAfterRepeat = await admin.query('SELECT id, tenant_id, status, rehearsal_repair_note FROM outbox ORDER BY id');
  assert.deepEqual(repairedAfterRepeat.rows, repairedBeforeRepeat.rows);
  const resolved = prismaFixture(newDir, migrationUrl, fixtureConfig, 'resolve', '--applied', brokenName);
  assert.equal(resolved.status, 0, resolved.stderr);
  const forwardName = '209901010002_ar891_synthetic_forward_repair';
  const forwardDir = path.join(recoveryRoot, 'migrations', forwardName);
  mkdirSync(forwardDir);
  writeFileSync(path.join(forwardDir, 'migration.sql'),
   "UPDATE outbox SET rehearsal_repair_note = 'REPAIRED' WHERE rehearsal_repair_note = 'PARTIAL';\n");
  const forward = prismaFixture(newDir, migrationUrl, fixtureConfig, 'deploy');
  assert.equal(forward.status, 0, forward.stderr);
  const forwardAgain = prismaFixture(newDir, migrationUrl, fixtureConfig, 'deploy');
  assert.equal(forwardAgain.status, 0, forwardAgain.stderr);
  const recoveredMigrationRows = await admin.query('SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations WHERE migration_name IN ($1, $2) ORDER BY migration_name', [brokenName, forwardName]);
  assert.equal(recoveredMigrationRows.rows.filter((row) => row.finished_at && !row.rolled_back_at).length, 2);
  assert.equal(recoveredMigrationRows.rows.filter((row) => !row.finished_at && row.rolled_back_at).length, 1);
  const repairedAfterDeploy = await admin.query('SELECT id, tenant_id, status, rehearsal_repair_note FROM outbox ORDER BY id');
  assert.deepEqual(repairedAfterDeploy.rows, repairedBeforeRepeat.rows);
  const oldAfterRepair = await old.withTenant(oldDb, tenantId, (tx) => tx.$queryRaw`SELECT status FROM outbox WHERE tenant_id = ${tenantId}::uuid AND id = ${before.outbox[0].id}::uuid`);
  const newAfterRepair = await next.withTenant(newDb, tenantId, (tx) => tx.$queryRaw`SELECT status FROM outbox WHERE tenant_id = ${tenantId}::uuid AND id = ${before.outbox[0].id}::uuid`);
  const deniedTenant = await old.withTenant(oldDb, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   (tx) => tx.$queryRaw`SELECT id FROM outbox WHERE id = ${before.outbox[0].id}::uuid`);
  assert.equal(oldAfterRepair[0].status, 'COMPLETE');
  assert.deepEqual(oldAfterRepair, newAfterRepair);
  assert.equal(deniedTenant.length, 0);
    console.log(JSON.stringify({ oldSource: oldManifest.sourceSha, newSource: newManifest.sourceSha,
   oldDeploy: oldDeploy.split('\n').at(-1), newDeploy: newDeploy.split('\n').at(-1),
   prismaMigrationCount: migrationRows.rows.length,
      additiveMigrations: additional.map((file) => path.basename(path.dirname(file))),
      oldApiAfterExpand: smokeOld[0].status, newApiAfterExpand: smokeNew[0].status,
      before: { outbox: before.outbox[0].status, notes: before.notes },
      after, rollback: { claimed: rollback.claimed, completed: rollback.completed },
   emailSends, pushSends, reclaimCount: Number(counters.rows[0].reclaim_count),
   forwardRecovery: { failedMigration: brokenName, durablePartialRows: partial.rows.length,
    repairedRows: repairedAfterDeploy.rows.length, forwardMigration: forwardName,
    repeatRepairUnchanged: true, repeatDeployUnchanged: true, oldNewStatus: oldAfterRepair[0].status,
    wrongTenantRows: deniedTenant.length } }));
  } finally {
    if (oldDb) await oldDb.$disconnect();
    if (newDb) await newDb.$disconnect();
    if (admin) await admin.end().catch(() => {});
  if (recoveryRoot) rmSync(recoveryRoot, { recursive: true, force: true });
    if (!externalUrl) try { docker('rm', '-f', '-v', name); } catch { /* container may not have started */ }
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
