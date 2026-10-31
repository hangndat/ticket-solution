const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { Client } = require('pg');
const { migrationFiles } = require('./migration-files.cjs');
const { createDatabase, withTenant, processClaimedOutbox } = require('../dist');
const {
  reserveEmailBudget,
  settleEmailBudget,
  reconcileExpiredEmailBudget,
} = require('../dist/email-budget');

const docker = (...args) => execFileSync('docker', args, {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}).trim();

function dockerAvailable() {
  try { docker('info', '-f', '{{.ServerVersion}}'); return true; }
  catch { return false; }
}

async function postgres() {
  const name = 'ticket-email-budget-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker('run', '-d', '--name', name, '--label', 'ticket.task=task_ae2e78ca35c0',
    '-e', 'POSTGRES_PASSWORD=' + password, '-e', 'POSTGRES_DB=email_budget_test',
    '-p', '127.0.0.1::5432', 'postgres:18.1-alpine');
  for (let i = 0; i < 100; i++) {
    try { docker('exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'email_budget_test'); break; }
    catch { await new Promise((resolve) => setTimeout(resolve, 400)); }
  }
  const port = docker('port', name, '5432/tcp').split(':').at(-1);
  const url = `postgresql://postgres:${password}@127.0.0.1:${port}/email_budget_test`;
  const admin = new Client({ connectionString: url });
  try {
    await admin.connect();
    await admin.query('CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
    await admin.query('CREATE ROLE ticket_platform_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
    await admin.query('CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS');
    await admin.query('GRANT CREATE, USAGE ON SCHEMA public TO migration_owner');
    await admin.query('SET ROLE migration_owner');
    for (const file of migrationFiles()) await admin.query(readFileSync(file, 'utf8'));
    await admin.query('RESET ROLE');
    await admin.query('GRANT USAGE ON SCHEMA public TO ticket_runtime');
    await admin.query('GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO ticket_runtime');
    await admin.query('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ticket_runtime');
    await admin.query("ALTER DATABASE email_budget_test SET app.tenant_id TO ''");
  } finally { await admin.end().catch(() => {}); }
  return { name, url };
}

async function tenant(db, slug, limit) {
  const tenantId = randomUUID();
  await withTenant(db, tenantId, async (tx) => {
    await tx.tenant.create({ data: { id: tenantId, slug, name: slug } });
    if (limit !== 'missing') await tx.$executeRaw`
      INSERT INTO tenant_limits (tenant_id, email_per_day)
      VALUES (${tenantId}::uuid, ${limit === null ? null : limit}::integer)
    `;
  });
  return tenantId;
}

async function invite(db, tenantId, owner, token = randomUUID(), status = 'PROCESSING') {
  const row = {
    outbox_id: randomUUID(), tenant_id: tenantId, event_id: null,
    type: 'MembershipInvite', aggregate_id: randomUUID(),
    payload_version: 1, lease_token: token, attempts: 1,
  };
  await withTenant(db, tenantId, (tx) => tx.$executeRaw`
    INSERT INTO outbox
      (tenant_id, id, type, aggregate_id, payload, status, attempts,
       lease_owner, lease_token, lease_expires_at)
    VALUES (${tenantId}::uuid, ${row.outbox_id}::uuid, 'MembershipInvite',
      ${row.aggregate_id}::uuid,
      ${JSON.stringify({ inviteId: row.aggregate_id, email: 'fixture@example.test',
        role: 'manager', token: 'fixture-token', expiresAt: '2030-01-01' })}::jsonb,
      ${status}, 1, ${owner}, ${token}, clock_timestamp() + interval '60 seconds')
  `);
  return row;
}

async function counts(db, tenantId) {
  return withTenant(db, tenantId, async (tx) => {
    const usage = await tx.$queryRaw`
      SELECT sent_count, held_count FROM tenant_email_usage
      WHERE tenant_id = ${tenantId}::uuid
        AND usage_date = (clock_timestamp() AT TIME ZONE 'UTC')::date
    `;
    return usage[0] || { sent_count: 0, held_count: 0 };
  });
}

test('JOB04 D: concurrent admission, settlement CAS, config and replay isolation',
  { timeout: 180000, skip: !dockerAvailable() }, async () => {
    let boot, db;
    try {
      boot = await postgres();
      db = createDatabase(boot.url, 6, true);
      const a = await tenant(db, 'budget-a', 1);
      const b = await tenant(db, 'budget-b', null);
      const c = await tenant(db, 'budget-c', 'missing');
      const a1 = await invite(db, a, 'worker-a');
      const a2 = await invite(db, a, 'worker-b');
      const claim = (row) => ({ tenantId: row.tenant_id, outboxId: row.outbox_id, leaseToken: row.lease_token });
      const [first, second] = await Promise.all([
        reserveEmailBudget(db, claim(a1)), reserveEmailBudget(db, claim(a2)),
      ]);
      assert.deepEqual([first.kind, second.kind].sort(), ['deferred', 'reserved']);
      const winning = first.kind === 'reserved' ? first : second;
      const winningRow = first.kind === 'reserved' ? a1 : a2;
      assert.equal((await counts(db, a)).held_count, 1);
      assert.equal((await reserveEmailBudget(db, claim(winningRow))).kind, 'duplicate');
      await settleEmailBudget(db, a, winning.attemptId, 'ACCEPTED', 'smtp:accepted');
      await settleEmailBudget(db, a, winning.attemptId, 'ACCEPTED', 'smtp:accepted');
      assert.deepEqual(await counts(db, a), { sent_count: 1, held_count: 0 });

      const b1 = await invite(db, b, 'worker-b');
      const unlimited = await reserveEmailBudget(db, claim(b1));
      assert.equal(unlimited.kind, 'reserved');
      await settleEmailBudget(db, b, unlimited.attemptId, 'UNKNOWN');
      assert.deepEqual(await counts(db, b), { sent_count: 0, held_count: 1 });
      await withTenant(db, b, (tx) => tx.$executeRaw`
        UPDATE outbox SET lease_expires_at = clock_timestamp() - interval '1 second'
        WHERE tenant_id = ${b}::uuid AND id = ${b1.outbox_id}::uuid
      `);
      assert.equal(await reconcileExpiredEmailBudget(db, b), 0);
      await withTenant(db, b, (tx) => tx.$executeRaw`
        UPDATE outbox SET lease_token = 'reclaim', lease_expires_at = clock_timestamp() + interval '60 seconds'
        WHERE tenant_id = ${b}::uuid AND id = ${b1.outbox_id}::uuid
      `);
      const replay = await reserveEmailBudget(db, { ...claim(b1), leaseToken: 'reclaim' });
      assert.equal(replay.kind, 'reserved');
      await settleEmailBudget(db, b, replay.attemptId, 'RELEASED');
      assert.deepEqual(await counts(db, b), { sent_count: 0, held_count: 1 });

      const c1 = await invite(db, c, 'worker-c');
      assert.equal((await reserveEmailBudget(db, claim(c1))).reason, 'email_budget_config_missing');
      await withTenant(db, c, (tx) => tx.$executeRaw`
        INSERT INTO tenant_limits (tenant_id, email_per_day) VALUES (${c}::uuid, 0)
      `);
      assert.equal((await reserveEmailBudget(db, claim(c1))).kind, 'deferred');
      await withTenant(db, c, (tx) => tx.$executeRaw`
        UPDATE tenant_limits SET email_per_day = NULL WHERE tenant_id = ${c}::uuid
      `);
      const recovered = await reserveEmailBudget(db, claim(c1));
      assert.equal(recovered.kind, 'reserved');
      await settleEmailBudget(db, c, recovered.attemptId, 'ACCEPTED', 'smtp:c');
      assert.deepEqual(await counts(db, c), { sent_count: 1, held_count: 0 });

      await withTenant(db, a, (tx) => tx.$executeRaw`
        UPDATE tenant_limits SET email_per_day = 0 WHERE tenant_id = ${a}::uuid
      `);
      assert.equal((await reserveEmailBudget(db, claim(first.kind === 'reserved' ? a2 : a1))).kind, 'deferred');
      assert.deepEqual(await counts(db, a), { sent_count: 1, held_count: 0 });
    } finally {
      if (db) await db.$disconnect();
      if (boot) docker('rm', '-f', '-v', boot.name);
    }
  });

test('JOB04 D: worker invite calls SMTP once and defers another at tenant cap',
  { timeout: 180000, skip: !dockerAvailable() }, async () => {
    let boot, db;
    try {
      boot = await postgres();
      db = createDatabase(boot.url, 6, true);
      const id = await tenant(db, 'budget-worker', 1);
      const rows = [
        await invite(db, id, 'worker-x', randomUUID(), 'LEASED'),
        await invite(db, id, 'worker-y', randomUUID(), 'LEASED'),
      ];
      let calls = 0;
      const email = {
        async sendTicketIssued() { throw new Error('unused'); },
        async sendMembershipInvite() {
          calls += 1;
          return { providerRef: 'smtp:invite', providerStatus: 'ACCEPTED' };
        },
      };
      await Promise.all(rows.map((row, i) => processClaimedOutbox(db, email, [row], {
        credentialKeyMaterial: '', leaseOwner: i === 0 ? 'worker-x' : 'worker-y',
        publicWebBaseUrl: 'https://tickets.example.test', env: { NODE_ENV: 'test' },
      })));
      assert.equal(calls, 1);
      assert.deepEqual(await counts(db, id), { sent_count: 1, held_count: 0 });
      const status = await withTenant(db, id, (tx) => tx.$queryRaw`
        SELECT status, payload->>'emailBudgetDeferred' AS reason FROM outbox
        WHERE tenant_id = ${id}::uuid ORDER BY status
      `);
      assert.deepEqual(status.map((row) => row.status).sort(), ['COMPLETE', 'PENDING']);
      assert.equal(status.find((row) => row.status === 'PENDING').reason, 'email_budget_deferred');
    } finally {
      if (db) await db.$disconnect();
      if (boot) docker('rm', '-f', '-v', boot.name);
    }
  });
