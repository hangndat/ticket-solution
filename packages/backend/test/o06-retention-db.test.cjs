'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { Client } = require('pg');
const { migrationFiles } = require('./migration-files.cjs');
const { processDueObjectRetentions } = require('../dist/retention-o06');

const docker = (...args) => execFileSync('docker', args, {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}).trim();

async function database(beforeDueMigration, productionAcl = false) {
  const name = 'ticket-o06-retention-' + randomBytes(5).toString('hex');
  const password = randomBytes(20).toString('hex');
  docker('run', '-d', '--name', name, '-e', 'POSTGRES_PASSWORD=' + password,
    '-e', 'POSTGRES_DB=o06_retention', '-p', '127.0.0.1::5432', 'postgres:18.1-alpine');
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try {
      docker('exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'o06_retention');
      ready = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  assert.ok(ready, 'isolated Postgres must become ready');
  const port = docker('port', name, '5432/tcp').split(':').at(-1);
  const adminUrl = `postgresql://postgres:${password}@127.0.0.1:${port}/o06_retention`;
  const admin = new Client({ connectionString: adminUrl });
  const runtimeUrl = `postgresql://o06_login:${password}@127.0.0.1:${port}/o06_retention`;
  await admin.connect();
  await admin.query('CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
  await admin.query('CREATE ROLE ticket_platform_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
  await admin.query('CREATE ROLE ticket_retention_operator NOLOGIN NOSUPERUSER NOBYPASSRLS');
  await admin.query('CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS');
  await admin.query('GRANT CREATE, USAGE ON SCHEMA public TO migration_owner');
  await admin.query('SET ROLE migration_owner');
  for (const file of migrationFiles()) {
    if (file.includes('202610290007_o06_operator_due_events') && beforeDueMigration) {
      await beforeDueMigration(admin);
    }
    if (file.includes('202610290008_o06_definer_table_acl') && productionAcl) {
      // The old local harness owns every table as migration_owner. Production
      // owns these four as ticket_owner and grants only two preexisting ACLs.
      await admin.query('RESET ROLE');
      await admin.query('CREATE ROLE ticket_owner NOLOGIN NOBYPASSRLS');
      for (const table of ['events', 'event_attendees', 'redemption_requests', 'exports']) {
        await admin.query(`ALTER TABLE public.${table} OWNER TO ticket_owner`);
      }
      await admin.query('GRANT SELECT, UPDATE ON public.exports TO migration_owner');
      await admin.query('GRANT SELECT ON public.redemption_requests TO migration_owner');
    }
    await admin.query(readFileSync(file, 'utf8'));
  }
  await admin.query('RESET ROLE');
  await admin.query(`CREATE ROLE o06_login LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS INHERIT`);
  await admin.query('GRANT ticket_runtime TO o06_login');
  const runtime = new Client({ connectionString: runtimeUrl });
  await runtime.connect();
  const operatorQuery = async (sql, params = []) => {
    await admin.query('SET ROLE ticket_retention_operator');
    try { return await admin.query(sql, params); }
    finally { await admin.query('RESET ROLE'); }
  };
  return { name, admin, adminUrl, runtime, runtimeUrl, operatorQuery };
}

test('O06 definer ACL works on production-shaped table ownership and row-bearing paths',
  { timeout: 240000 }, async () => {
    let db;
    try {
      db = await database(undefined, true);
      const { admin, runtime, operatorQuery } = db;
      const tenant = randomUUID();
      const user = randomUUID();
      await admin.query('INSERT INTO tenants (id,slug,name) VALUES ($1,$2,$2)',
        [tenant, 'o06-acl']);
      await admin.query('INSERT INTO users (id,issuer,subject,email) VALUES ($1,$2,$3,$4)',
        [user, 'o06-acl', user, 'fixture@example.test']);
      const pii = await seedEvent(admin, tenant, user, 'acl-pii', -366 * 86400);
      const due = await seedEvent(admin, tenant, user, 'acl-due', -91 * 86400);
      const claimable = await seedEvent(admin, tenant, user, 'acl-claim', -10 * 86400);
      const pending = randomUUID();
      await admin.query(`INSERT INTO exports (tenant_id,event_id,id,actor_user_id,status)
        VALUES ($1,$2,$3,$4,'PENDING')`, [tenant, claimable.event, pending, user]);

      assert.equal((await admin.query(`SELECT count(*)::int AS n FROM pg_class c
        WHERE c.oid IN ('public.events'::regclass, 'public.event_attendees'::regclass,
          'public.redemption_requests'::regclass, 'public.exports'::regclass)
          AND pg_get_userbyid(c.relowner) = 'ticket_owner' AND c.relforcerowsecurity`)).rows[0].n, 4);
      for (const table of ['events', 'event_attendees']) {
        assert.equal((await admin.query(`SELECT has_table_privilege('migration_owner',
          'public.${table}', 'SELECT') AS broad_select,
          has_table_privilege('migration_owner', 'public.${table}', 'UPDATE') AS broad_update`))
          .rows[0].broad_select, false);
      }
      assert.equal((await admin.query(`SELECT has_table_privilege('migration_owner',
        'public.redemption_requests', 'UPDATE') AS broad_update`)).rows[0].broad_update, false);
      assert.equal((await runtime.query('SELECT count(*)::int AS n FROM events')).rows[0].n, 0,
        'runtime cannot scan events across tenants without tenant context');

      const claimed = (await runtime.query(
        "SELECT * FROM claim_exports_batch(20,'acl-fixture',3600)")).rows;
      assert.ok(claimed.some((row) => row.export_id === pending));
      const piiDue = (await runtime.query(
        'SELECT * FROM list_due_ticket_pii_anonymizations(10)')).rows;
      assert.ok(piiDue.some((row) => row.event_id === pii.event));
      const dueRows = (await operatorQuery(
        'SELECT * FROM list_export_retention_due_events(clock_timestamp(),100)')).rows;
      assert.ok(dueRows.some((row) => row.event_id === due.event && row.unpurged_count === '1'));
      const generation = randomUUID();
      assert.equal((await operatorQuery('SELECT fence_export_retention_event($1,$2,$3) AS ok',
        [tenant, due.event, generation])).rows[0].ok, true);
      assert.equal((await operatorQuery(
        'SELECT export_retention_operator_status($1,$2,$3) AS value',
        [tenant, due.event, generation])).rows[0].value.matched, true);
      const hash = 'a'.repeat(64);
      assert.equal((await operatorQuery(
        'SELECT record_export_retention_inventory($1,$2,$3,$4::jsonb) AS ok',
        [tenant, due.event, generation, JSON.stringify({ emptyInventory: true,
          writerExitHash: hash, serverBarrierHash: hash, inventoryHash: hash })])).rows[0].ok, true);
      assert.equal((await operatorQuery('SELECT finalize_export_retention_event($1,$2,$3) AS n',
        [tenant, due.event, generation])).rows[0].n, 1);
      assert.equal((await runtime.query('SELECT apply_ticket_pii_anonymization($1,$2) AS ok',
        [tenant, pii.event])).rows[0].ok, true);
      const scrubbed = (await admin.query(`SELECT a.canonical_email, r.answers_json,
        e.ticket_pii_anonymized_at FROM events e
        JOIN event_attendees a ON a.tenant_id=e.tenant_id AND a.event_id=e.id
        JOIN redemption_requests r ON r.tenant_id=e.tenant_id AND r.event_id=e.id
        WHERE e.tenant_id=$1 AND e.id=$2`, [tenant, pii.event])).rows[0];
      assert.equal(scrubbed.canonical_email, null);
      assert.equal(scrubbed.answers_json, null);
      assert.ok(scrubbed.ticket_pii_anonymized_at);
      await assert.rejects(admin.query(
        'UPDATE event_attendees SET canonical_email=$1 WHERE id=$2',
        ['late@example.test', pii.attendee]), /EVENT_PII_ANONYMIZED/);
      await assert.rejects(admin.query(
        'UPDATE redemption_requests SET answers_json=$1 WHERE id=$2',
        [JSON.stringify({ late: true }), pii.request]), /EVENT_PII_ANONYMIZED/);
      assert.ok((await runtime.query('SELECT * FROM worker_due_job_snapshot()')).rows.length > 0);
      await assert.rejects(runtime.query(
        'SELECT * FROM list_export_retention_due_events(clock_timestamp(),10)'), /permission denied/);
      await assert.rejects(runtime.query('SELECT fence_export_retention_event($1,$2,$3)',
        [tenant, due.event, randomUUID()]), /permission denied/);
    } finally {
      if (db?.runtime) await db.runtime.end().catch(() => {});
      if (db?.admin) await db.admin.end().catch(() => {});
      if (db?.name) docker('rm', '-f', db.name);
    }
  });

test('O06 operator pages legacy and new due events with overdue and completion markers',
  { timeout: 240000 }, async () => {
    let db;
    const legacyTenant = randomUUID();
    const legacyEvent = randomUUID();
    try {
      db = await database(async (admin) => {
        await admin.query('INSERT INTO tenants (id,slug,name) VALUES ($1,$2,$2)',
          [legacyTenant, 'o06-legacy-due']);
        await admin.query(`INSERT INTO events (tenant_id,id,slug,name,ends_at)
          VALUES ($1,$2,'legacy-due','legacy-due',clock_timestamp()-interval '91 days')`,
        [legacyTenant, legacyEvent]);
      });
      const { admin, runtime, operatorQuery } = db;
      const tenant = randomUUID();
      const user = randomUUID();
      await admin.query('INSERT INTO tenants (id,slug,name) VALUES ($1,$2,$2)',
        [tenant, 'o06-inventory']);
      await admin.query('INSERT INTO users (id,issuer,subject,email) VALUES ($1,$2,$3,$4)',
        [user, 'o06-inventory', user, 'fixture@example.test']);
      const due = await seedEvent(admin, tenant, user, 'inventory-due', -89 * 86400 - 60);
      const overdue = await seedEvent(admin, tenant, user, 'inventory-overdue', -91 * 86400);
      const cancelled = await seedEvent(admin, tenant, user, 'inventory-cancelled',
        -91 * 86400, -1 * 86400);
      const noEnd = await seedEvent(admin, tenant, user, 'inventory-no-end', null);
      const tooEarly = await seedEvent(admin, tenant, user, 'inventory-early', -88 * 86400);
      const generation = randomUUID();
      const hash = 'c'.repeat(64);
      assert.equal((await operatorQuery('SELECT fence_export_retention_event($1,$2,$3) AS ok',
        [tenant, overdue.event, generation])).rows[0].ok, true);
      assert.equal((await operatorQuery('SELECT record_export_retention_inventory($1,$2,$3,$4::jsonb) AS ok',
        [tenant, overdue.event, generation, JSON.stringify({ emptyInventory: true,
          writerExitHash: hash, serverBarrierHash: hash, inventoryHash: hash })])).rows[0].ok, true);
      assert.equal((await operatorQuery('SELECT finalize_export_retention_event($1,$2,$3) AS n',
        [tenant, overdue.event, generation])).rows[0].n, 1);

      await assert.rejects(runtime.query(
        'SELECT * FROM list_export_retention_due_events(clock_timestamp(),10)'), /permission denied/);
      await assert.rejects(operatorQuery(
        'SELECT * FROM list_export_retention_due_events(clock_timestamp(),0)'), /invalid retention due-event page/);
      await assert.rejects(operatorQuery(
        'SELECT * FROM list_export_retention_due_events(clock_timestamp(),1,clock_timestamp())'),
      /invalid retention due-event page/);
      const asOf = (await admin.query('SELECT clock_timestamp() AS value')).rows[0].value;
      const all = [];
      let cursor = [null, null, null];
      for (let page = 0; page < 10; page++) {
        const rows = (await operatorQuery(
          'SELECT * FROM list_export_retention_due_events($1,$2,$3,$4,$5)',
          [asOf, 2, ...cursor])).rows;
        all.push(...rows);
        if (rows.length < 2) break;
        const last = rows.at(-1);
        cursor = [last.deadline_cursor, last.tenant_id, last.event_id];
      }
      assert.equal(all.length, 4);
      assert.equal(new Set(all.map((row) => row.event_id)).size, 4);
      assert.deepEqual(new Set(all.map((row) => row.event_id)),
        new Set([legacyEvent, due.event, overdue.event, cancelled.event]));
      assert.ok(!all.some((row) => [noEnd.event, tooEarly.event].includes(row.event_id)));
      const legacy = all.find((row) => row.event_id === legacyEvent);
      assert.equal(legacy.unpurged_count, '0');
      assert.equal(legacy.completed, false, 'no export rows cannot prove an empty object prefix');
      assert.ok(legacy.deadline < asOf, 'pre-migration overdue event appears immediately');
      assert.equal(all.find((row) => row.event_id === due.event).completed, false);
      assert.equal(all.find((row) => row.event_id === overdue.event).completed, true);
      assert.equal(all.find((row) => row.event_id === cancelled.event).completed, false);
      for (let i = 1; i < all.length; i++) {
        const previous = all[i - 1];
        const current = all[i];
        assert.ok(`${previous.deadline.toISOString()}/${previous.tenant_id}/${previous.event_id}` <
          `${current.deadline.toISOString()}/${current.tenant_id}/${current.event_id}`);
      }
    } finally {
      if (db?.runtime) await db.runtime.end().catch(() => {});
      if (db?.admin) await db.admin.end().catch(() => {});
      if (db?.name) docker('rm', '-f', db.name);
    }
  });

async function seedEvent(db, tenant, user, label, endsOffset, cancelledOffset = null) {
  const event = randomUUID();
  const attendee = randomUUID();
  const type = randomUUID();
  const source = randomUUID();
  const code = randomUUID();
  const request = randomUUID();
  const exported = randomUUID();
  await db.query(`INSERT INTO events (tenant_id,id,slug,name,ends_at,business_status,cancelled_at)
    VALUES ($1,$2,$3,$3,
      CASE WHEN $4::integer IS NULL THEN NULL ELSE clock_timestamp() + $4::integer * interval '1 second' END,
      CASE WHEN $5::integer IS NULL THEN 'ACTIVE' ELSE 'CANCELLED' END,
      CASE WHEN $5::integer IS NULL THEN NULL ELSE clock_timestamp() + $5::integer * interval '1 second' END)`,
  [tenant, event, label, endsOffset, cancelledOffset]);
  await db.query('INSERT INTO event_attendees (tenant_id,event_id,id,user_id,canonical_email) VALUES ($1,$2,$3,$4,$5)',
    [tenant, event, attendee, user, label + '@example.test']);
  await db.query('INSERT INTO ticket_types (tenant_id,event_id,id,label) VALUES ($1,$2,$3,$4)',
    [tenant, event, type, label]);
  await db.query('INSERT INTO issuance_sources (tenant_id,event_id,id,name) VALUES ($1,$2,$3,$4)',
    [tenant, event, source, label]);
  await db.query(`INSERT INTO redemption_codes
    (tenant_id,event_id,id,code_hmac,source_id,ticket_type_id)
    VALUES ($1,$2,$3,$4,$5,$6)`, [tenant, event, code, randomUUID(), source, type]);
  await db.query(`INSERT INTO redemption_requests
    (tenant_id,event_id,id,actor_user_id,redemption_code_id,status,answers_json,
     terms_accepted,consent_accepted_at,form_definition_hash,terms_content_hash)
    VALUES ($1,$2,$3,$4,$5,'ISSUED',$6::jsonb,true,clock_timestamp(),'form-hash','terms-hash')`,
  [tenant, event, request, user, code, JSON.stringify({ phone: 'fixture-only' })]);
  await db.query(`INSERT INTO exports
    (tenant_id,event_id,id,actor_user_id,status,object_key,row_count)
    VALUES ($1,$2,$3,$4,'READY',$5,1)`, [tenant, event, exported, user, 'exports/' + exported]);
  return { tenant, event, attendee, request, exported };
}

test('O06 DB clocks, tenant scope, operator fence and no-finalize gates',
  { timeout: 240000 }, async () => {
    let db;
    try {
      db = await database();
      const { admin, runtime } = db;
      const tenantA = randomUUID();
      const tenantB = randomUUID();
      const user = randomUUID();
      await admin.query('INSERT INTO tenants (id,slug,name) VALUES ($1,$2,$2),($3,$4,$4)',
        [tenantA, 'o06-a', tenantB, 'o06-b']);
      await admin.query('INSERT INTO users (id,issuer,subject,email) VALUES ($1,$2,$3,$4)',
        [user, 'o06-test', user, 'user@example.test']);

      const day = 86400;
      const due = await seedEvent(admin, tenantA, user, 'due', -365 * day - 10);
      const future = await seedEvent(admin, tenantA, user, 'future', -365 * day + 20);
      const noEnd = await seedEvent(admin, tenantA, user, 'no-end', null);
      const cancelledNoEnd = await seedEvent(admin, tenantA, user,
        'cancelled-no-end', null, -400 * day);
      const cancelledDue = await seedEvent(admin, tenantA, user,
        'cancelled-due', -10 * day, -365 * day - 10);
      const cancelledFuture = await seedEvent(admin, tenantA, user,
        'cancelled-future', -365 * day - 10, -10 * day);
      const otherTenant = await seedEvent(admin, tenantB, user,
        'other-tenant', -365 * day - 10);
      const beforeFence = await seedEvent(admin, tenantA, user,
        'before-day-89', -89 * day + 60);
      // Simulate a corrupt/legacy CANCELLED row; normal schema disallows this state.
      await admin.query('ALTER TABLE events DROP CONSTRAINT events_cancel_fields_chk');
      await admin.query('UPDATE events SET cancelled_at = NULL WHERE tenant_id = $1 AND id = $2',
        [tenantA, cancelledFuture.event]);

      const dueRows = (await runtime.query('SELECT * FROM list_due_ticket_pii_anonymizations(20)')).rows;
      assert.deepEqual(new Set(dueRows.map((row) => row.event_id)),
        new Set([due.event, cancelledDue.event, otherTenant.event]));
      assert.equal((await runtime.query('SELECT apply_ticket_pii_anonymization($1,$2) AS applied',
        [tenantA, due.event])).rows[0].applied, true);
      assert.equal((await runtime.query('SELECT apply_ticket_pii_anonymization($1,$2) AS applied',
        [tenantA, due.event])).rows[0].applied, false);
      assert.equal((await runtime.query('SELECT apply_ticket_pii_anonymization($1,$2) AS applied',
        [tenantA, future.event])).rows[0].applied, false);
      assert.equal((await runtime.query('SELECT apply_ticket_pii_anonymization($1,$2) AS applied',
        [tenantA, cancelledFuture.event])).rows[0].applied, false);
      assert.equal((await runtime.query('SELECT apply_ticket_pii_anonymization($1,$2) AS applied',
        [tenantA, noEnd.event])).rows[0].applied, false);
      assert.equal((await runtime.query('SELECT apply_ticket_pii_anonymization($1,$2) AS applied',
        [tenantA, cancelledNoEnd.event])).rows[0].applied, false);
      assert.equal((await runtime.query('SELECT apply_ticket_pii_anonymization($1,$2) AS applied',
        [tenantA, cancelledDue.event])).rows[0].applied, true);

      const pii = (await admin.query(`SELECT e.id, e.ticket_pii_anonymized_at,
        a.canonical_email, r.answers_json, r.terms_accepted, r.form_definition_hash,
        r.terms_content_hash, x.object_key
        FROM events e
        JOIN event_attendees a ON a.tenant_id=e.tenant_id AND a.event_id=e.id
        JOIN redemption_requests r ON r.tenant_id=e.tenant_id AND r.event_id=e.id
        JOIN exports x ON x.tenant_id=e.tenant_id AND x.event_id=e.id
        WHERE e.tenant_id=$1`, [tenantA])).rows;
      for (const row of pii) {
        const scrubbed = [due.event, cancelledDue.event].includes(row.id);
        assert.equal(row.ticket_pii_anonymized_at !== null, scrubbed);
        assert.equal(row.canonical_email === null, scrubbed);
        assert.equal(row.answers_json === null, scrubbed);
        assert.equal(row.terms_accepted, true);
        assert.equal(row.form_definition_hash, 'form-hash');
        assert.equal(row.terms_content_hash, 'terms-hash');
        assert.ok(row.object_key);
      }
      const bPii = (await admin.query('SELECT canonical_email FROM event_attendees WHERE tenant_id=$1',
        [tenantB])).rows;
      assert.ok(bPii[0].canonical_email, 'tenant B remains untouched by tenant A apply');
      await runtime.query('BEGIN');
      await runtime.query("SELECT set_config('app.tenant_id',$1,true)", [tenantA]);
      assert.equal((await runtime.query('SELECT count(*)::int AS n FROM event_attendees WHERE tenant_id=$1',
        [tenantB])).rows[0].n, 0);
      assert.equal((await runtime.query('UPDATE event_attendees SET canonical_email=NULL WHERE tenant_id=$1',
        [tenantB])).rowCount, 0);
      await runtime.query('ROLLBACK');

      await assert.rejects(runtime.query(
        "SELECT * FROM claim_expired_retention_objects(1,'worker-a')"), /permission denied/);
      await assert.rejects(runtime.query(
        'SELECT apply_export_object_purge($1,$2,$3,$4)',
        [tenantA, due.exported, 'worker-a', randomUUID()]), /permission denied/);
      assert.equal((await db.operatorQuery('SELECT finalize_export_retention_event($1,$2,$3) AS n',
        [tenantA, due.event, randomUUID()])).rows[0].n, 0);
      const earlyGeneration = randomUUID();
      assert.equal((await db.operatorQuery('SELECT fence_export_retention_event($1,$2,$3) AS ok',
        [tenantA, beforeFence.event, earlyGeneration])).rows[0].ok, false,
      'fence cannot begin before day 89');
      assert.equal((await db.operatorQuery('SELECT fence_export_retention_event($1,$2,$3) AS ok',
        [tenantA, cancelledDue.event, randomUUID()])).rows[0].ok, false,
      'cancelled_at does not replace ends_at');
      assert.equal((await db.operatorQuery('SELECT fence_export_retention_event($1,$2,$3) AS ok',
        [tenantA, cancelledNoEnd.event, randomUUID()])).rows[0].ok, false,
      'null ends_at remains outside the sweep');
      await admin.query(`UPDATE events SET ends_at=clock_timestamp()-interval '89 days 2 seconds'
        WHERE tenant_id=$1 AND id=$2`, [tenantA, beforeFence.event]);
      await admin.query(`UPDATE exports SET expires_at=clock_timestamp()+interval '5 days'
        WHERE tenant_id=$1 AND id=$2`, [tenantA, beforeFence.exported]);
      assert.equal((await db.operatorQuery('SELECT fence_export_retention_event($1,$2,$3) AS ok',
        [tenantA, beforeFence.event, earlyGeneration])).rows[0].ok, true);
      const earlyHash = 'b'.repeat(64);
      assert.equal((await db.operatorQuery(
        'SELECT record_export_retention_inventory($1,$2,$3,$4::jsonb) AS ok',
        [tenantA, beforeFence.event, earlyGeneration, JSON.stringify({
          emptyInventory: true, writerExitHash: earlyHash,
          serverBarrierHash: earlyHash, inventoryHash: earlyHash,
        })])).rows[0].ok, true, 'inventory may be recorded on day 89');
      assert.equal((await db.operatorQuery('SELECT finalize_export_retention_event($1,$2,$3) AS n',
        [tenantA, beforeFence.event, earlyGeneration])).rows[0].n, 1,
      'legacy READY expiry must not postpone purge beyond day 90');
      const earlyPurge = (await admin.query(`SELECT x.purged_at, x.expires_at,
        e.ends_at + interval '90 days' AS deadline FROM exports x
        JOIN events e ON e.tenant_id=x.tenant_id AND e.id=x.event_id
        WHERE x.tenant_id=$1 AND x.id=$2`, [tenantA, beforeFence.exported])).rows[0];
      assert.ok(earlyPurge.purged_at < earlyPurge.deadline);
      assert.ok(earlyPurge.expires_at > earlyPurge.deadline,
        'old download TTL can be cut short by mandatory retention');
      const generation = randomUUID();
      assert.equal((await db.operatorQuery('SELECT fence_export_retention_event($1,$2,$3) AS ok',
        [tenantA, due.event, generation])).rows[0].ok, true);
      const pendingId = randomUUID();
      await admin.query(`INSERT INTO exports (tenant_id,event_id,id,actor_user_id,status)
        VALUES ($1,$2,$3,$4,'PENDING')`, [tenantA, due.event, pendingId, user]);
      const claimedAfterFence = (await runtime.query(
        "SELECT * FROM claim_exports_batch(20,'export-worker',3600)")).rows;
      assert.ok(!claimedAfterFence.some((row) => row.export_id === pendingId));
      assert.equal((await db.operatorQuery('SELECT finalize_export_retention_event($1,$2,$3) AS n',
        [tenantA, due.event, generation])).rows[0].n, 0, 'fence alone cannot finalize');
      const beforeInventory = (await admin.query('SELECT object_key,purged_at FROM exports WHERE id=$1',
        [due.exported])).rows[0];
      assert.ok(beforeInventory.object_key);
      assert.equal(beforeInventory.purged_at, null);
      const hash = 'a'.repeat(64);
      const evidence = { emptyInventory: true, writerExitHash: hash,
        serverBarrierHash: hash, inventoryHash: hash };
      await assert.rejects(db.operatorQuery(
        'SELECT record_export_retention_inventory($1,$2,$3,$4::jsonb)',
        [tenantA, due.event, generation, JSON.stringify({ emptyInventory: true })]),
      /invalid retention inventory attestation/);
      assert.equal((await db.operatorQuery('SELECT fence_export_retention_event($1,$2,$3) AS ok',
        [tenantB, due.event, randomUUID()])).rows[0].ok, false,
      'operator functions still require exact tenant/event identity');
      assert.equal((await db.operatorQuery(
        'SELECT record_export_retention_inventory($1,$2,$3,$4::jsonb) AS ok',
        [tenantA, due.event, generation, JSON.stringify(evidence)])).rows[0].ok, true);
      assert.equal((await db.operatorQuery('SELECT finalize_export_retention_event($1,$2,$3) AS n',
        [tenantA, due.event, randomUUID()])).rows[0].n, 0, 'generation must match');
      await admin.query(`UPDATE exports SET lease_expires_at=clock_timestamp()+interval '1 minute'
        WHERE tenant_id=$1 AND id=$2`, [tenantA, due.exported]);
      assert.equal((await db.operatorQuery('SELECT finalize_export_retention_event($1,$2,$3) AS n',
        [tenantA, due.event, generation])).rows[0].n, 0, 'live lease blocks finalize');
      const blockedStatus = (await db.operatorQuery(
        'SELECT export_retention_operator_status($1,$2,$3) AS value',
        [tenantA, due.event, generation])).rows[0].value;
      assert.equal(blockedStatus.matched, true);
      assert.equal(Number(blockedStatus.activeLeaseCount), 1);
      assert.equal(Number(blockedStatus.unpurgedCount), 2);
      await admin.query(`UPDATE exports SET lease_expires_at=clock_timestamp()-interval '1 second'
        WHERE tenant_id=$1 AND id=$2`, [tenantA, due.exported]);
      assert.equal((await db.operatorQuery('SELECT finalize_export_retention_event($1,$2,$3) AS n',
        [tenantA, due.event, generation])).rows[0].n, 2);
      const completeStatus = (await db.operatorQuery(
        'SELECT export_retention_operator_status($1,$2,$3) AS value',
        [tenantA, due.event, generation])).rows[0].value;
      assert.equal(completeStatus.inventoryRecorded, true);
      assert.equal(Number(completeStatus.unpurgedCount), 0);
      assert.equal(Number(completeStatus.activeLeaseCount), 0);
      const purged = (await admin.query('SELECT object_key,purged_at FROM exports WHERE id=$1',
        [due.exported])).rows[0];
      assert.equal(purged.object_key, null);
      assert.ok(purged.purged_at);
      const pendingPurged = (await admin.query('SELECT status,purged_at FROM exports WHERE id=$1',
        [pendingId])).rows[0];
      assert.equal(pendingPurged.status, 'FAILED');
      assert.ok(pendingPurged.purged_at);
      const untouched = (await admin.query('SELECT object_key,purged_at FROM exports WHERE id=$1',
        [noEnd.exported])).rows[0];
      assert.ok(untouched.object_key);
      assert.equal(untouched.purged_at, null);
    } finally {
      if (db?.runtime) await db.runtime.end().catch(() => {});
      if (db?.admin) await db.admin.end().catch(() => {});
      if (db?.name) docker('rm', '-f', db.name);
    }
  });

const pause = (ms = 75) => new Promise((resolve) => setTimeout(resolve, ms));

test('O06 PII writer and sweep serialize on event lock in both orders',
  { timeout: 240000 }, async () => {
    let db;
    try {
      db = await database();
      const { admin, runtime } = db;
      const tenant = randomUUID();
      const user = randomUUID();
      await admin.query('INSERT INTO tenants (id,slug,name) VALUES ($1,$2,$3)',
        [tenant, 'o06-race', 'o06-race']);
      await admin.query('INSERT INTO users (id,issuer,subject,email) VALUES ($1,$2,$3,$4)',
        [user, 'o06-race', user, 'fixture@example.test']);
      const first = await seedEvent(admin, tenant, user, 'race-first', -366 * 86400);
      await admin.query('BEGIN');
      await admin.query('UPDATE event_attendees SET canonical_email=$1 WHERE id=$2',
        ['writer@example.test', first.attendee]);
      let applied = false;
      const sweep = runtime.query('SELECT apply_ticket_pii_anonymization($1,$2) AS applied',
        [tenant, first.event]).then((result) => { applied = true; return result; });
      await pause();
      assert.equal(applied, false, 'sweep waits for uncommitted PII writer');
      await admin.query('COMMIT');
      assert.equal((await sweep).rows[0].applied, true);
      assert.equal((await admin.query('SELECT canonical_email FROM event_attendees WHERE id=$1',
        [first.attendee])).rows[0].canonical_email, null);
      assert.equal((await runtime.query('SELECT apply_ticket_pii_anonymization($1,$2) AS applied',
        [tenant, first.event])).rows[0].applied, false);
      await assert.rejects(admin.query('UPDATE redemption_requests SET answers_json=$1 WHERE id=$2',
        [JSON.stringify({ late: true }), first.request]), /EVENT_PII_ANONYMIZED/);
      await assert.rejects(admin.query(`INSERT INTO event_attendees
        (tenant_id,event_id,id,user_id,canonical_email) VALUES ($1,$2,$3,$4,$5)`,
      [tenant, first.event, randomUUID(), user, 'late-insert@example.test']), /EVENT_PII_ANONYMIZED/);
      const code = (await admin.query('SELECT redemption_code_id FROM redemption_requests WHERE id=$1',
        [first.request])).rows[0].redemption_code_id;
      await assert.rejects(admin.query(`INSERT INTO redemption_requests
        (tenant_id,event_id,id,actor_user_id,redemption_code_id,status,answers_json)
        VALUES ($1,$2,$3,$4,$5,'PENDING_REVIEW',$6::jsonb)`,
      [tenant, first.event, randomUUID(), user, code, JSON.stringify({ late: true })]),
      /EVENT_PII_ANONYMIZED/);

      const second = await seedEvent(admin, tenant, user, 'race-second', -366 * 86400);
      await runtime.query('BEGIN');
      assert.equal((await runtime.query('SELECT apply_ticket_pii_anonymization($1,$2) AS applied',
        [tenant, second.event])).rows[0].applied, true);
      let rejected = false;
      const writer = admin.query('UPDATE event_attendees SET canonical_email=$1 WHERE id=$2',
        ['too-late@example.test', second.attendee]).catch((error) => {
        rejected = true;
        assert.match(error.message, /EVENT_PII_ANONYMIZED/);
      });
      await pause();
      assert.equal(rejected, false, 'writer waits behind sweep lock');
      await runtime.query('COMMIT');
      await writer;
      assert.equal(rejected, true);
      await assert.rejects(admin.query('UPDATE events SET ends_at=ends_at + interval \'1 day\' WHERE id=$1',
        [second.event]), /EVENT_RETENTION_FENCED/);
    } finally {
      if (db?.runtime) await db.runtime.end().catch(() => {});
      if (db?.admin) await db.admin.end().catch(() => {});
      if (db?.name) docker('rm', '-f', db.name);
    }
  });

test('O06 operator fence locks the event clock before a late editor can commit',
  { timeout: 240000 }, async () => {
    let db;
    try {
      db = await database();
      const { admin, runtime } = db;
      const tenant = randomUUID();
      const user = randomUUID();
      await admin.query('INSERT INTO tenants (id,slug,name) VALUES ($1,$2,$3)',
        [tenant, 'o06-export-race', 'o06-export-race']);
      await admin.query('INSERT INTO users (id,issuer,subject,email) VALUES ($1,$2,$3,$4)',
        [user, 'o06-export-race', user, 'fixture@example.test']);
      const row = await seedEvent(admin, tenant, user, 'export-race', -91 * 86400);
      await admin.query('BEGIN');
      await admin.query('UPDATE events SET ends_at=clock_timestamp()+interval \'1 day\' WHERE id=$1',
        [row.event]);
      assert.equal((await db.operatorQuery('SELECT fence_export_retention_event($1,$2,$3) AS ok',
        [tenant, row.event, randomUUID()])).rows[0].ok, false);
      await admin.query('COMMIT');
      assert.equal((await db.operatorQuery('SELECT fence_export_retention_event($1,$2,$3) AS ok',
        [tenant, row.event, randomUUID()])).rows[0].ok, false);
      await admin.query('UPDATE events SET ends_at=clock_timestamp()-interval \'91 days\' WHERE id=$1',
        [row.event]);

      await admin.query('BEGIN');
      const generation = randomUUID();
      assert.equal((await db.operatorQuery('SELECT fence_export_retention_event($1,$2,$3) AS ok',
        [tenant, row.event, generation])).rows[0].ok, true);
      const competitor = new Client({ connectionString: db.adminUrl });
      await competitor.connect();
      let editorDone = false;
      const editor = competitor.query('UPDATE events SET ends_at=clock_timestamp()+interval \'1 day\' WHERE id=$1',
        [row.event]).catch((error) => {
        editorDone = true;
        assert.match(error.message, /EVENT_RETENTION_FENCED/);
      });
      await pause();
      assert.equal(editorDone, false, 'editor waits for claim transaction');
      await admin.query('COMMIT');
      await editor;
      await competitor.end();
      assert.equal(editorDone, true);
      const state = (await admin.query('SELECT export_retention_fenced_at FROM events WHERE id=$1',
        [row.event])).rows[0];
      assert.ok(state.export_retention_fenced_at);
      assert.equal((await db.operatorQuery('SELECT finalize_export_retention_event($1,$2,$3) AS n',
        [tenant, row.event, generation])).rows[0].n, 0);
    } finally {
      if (db?.runtime) await db.runtime.end().catch(() => {});
      if (db?.admin) await db.admin.end().catch(() => {});
      if (db?.name) docker('rm', '-f', db.name);
    }
  });

test('O06 online retention worker refuses deletion and finalization',
  { timeout: 240000 }, async () => {
    let db;
    try {
      db = await database();
      const { admin, runtime } = db;
      const tenant = randomUUID();
      const user = randomUUID();
      await admin.query('INSERT INTO tenants (id,slug,name) VALUES ($1,$2,$3)',
        [tenant, 'o06-delete', 'o06-delete']);
      await admin.query('INSERT INTO users (id,issuer,subject,email) VALUES ($1,$2,$3,$4)',
        [user, 'o06-delete', user, 'fixture@example.test']);
      const row = await seedEvent(admin, tenant, user, 'delete-retry', -91 * 86400);
      let deletes = 0;
      const store = { deleteObject: async () => {
        deletes += 1;
      } };
      await assert.rejects(processDueObjectRetentions({}, store, 'worker-a', 1),
        /EXPORT_RETENTION_OFFLINE_BARRIER_REQUIRED/);
      assert.equal(deletes, 0);
      const purged = (await admin.query('SELECT object_key,purged_at,row_count FROM exports WHERE id=$1',
        [row.exported])).rows[0];
      assert.ok(purged.object_key);
      assert.equal(purged.purged_at, null);
      assert.equal(purged.row_count, 1);
    } finally {
      if (db?.runtime) await db.runtime.end().catch(() => {});
      if (db?.admin) await db.admin.end().catch(() => {});
      if (db?.name) docker('rm', '-f', db.name);
    }
  });
