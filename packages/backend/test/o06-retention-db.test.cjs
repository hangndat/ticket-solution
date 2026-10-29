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

async function database() {
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
  const admin = new Client({ connectionString:
    `postgresql://postgres:${password}@127.0.0.1:${port}/o06_retention` });
  const runtimeUrl = `postgresql://o06_login:${password}@127.0.0.1:${port}/o06_retention`;
  await admin.connect();
  await admin.query('CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
  await admin.query('CREATE ROLE ticket_platform_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
  await admin.query('CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS');
  await admin.query('GRANT CREATE, USAGE ON SCHEMA public TO migration_owner');
  await admin.query('SET ROLE migration_owner');
  for (const file of migrationFiles()) await admin.query(readFileSync(file, 'utf8'));
  await admin.query('RESET ROLE');
  await admin.query(`CREATE ROLE o06_login LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS INHERIT`);
  await admin.query('GRANT ticket_runtime TO o06_login');
  const runtime = new Client({ connectionString: runtimeUrl });
  await runtime.connect();
  return { name, admin, runtime, runtimeUrl };
}

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

test('O06 POL-02/03: clocks, tenant scope, replay, fenced leases and claim race',
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

      const claims = (await runtime.query(
        "SELECT * FROM claim_expired_retention_objects(20,'worker-a')")).rows;
      assert.deepEqual(new Set(claims.map((row) => row.export_id)),
        new Set([due.exported, future.exported, cancelledFuture.exported, otherTenant.exported]));
      assert.equal((await runtime.query(
        "SELECT count(*)::int AS n FROM claim_expired_retention_objects(20,'worker-b')"))
        .rows[0].n, 0);
      const first = claims.find((row) => row.export_id === due.exported);
      assert.equal((await runtime.query(
        'SELECT apply_export_object_purge($1,$2,$3,$4) AS applied',
        [first.tenant_id, first.export_id, 'worker-a', first.lease_token])).rows[0].applied, true);
      assert.equal((await runtime.query(
        'SELECT apply_export_object_purge($1,$2,$3,$4) AS applied',
        [first.tenant_id, first.export_id, 'worker-a', first.lease_token])).rows[0].applied, false);
      const purged = (await admin.query('SELECT object_key,purged_at,row_count,status FROM exports WHERE id=$1',
        [due.exported])).rows[0];
      assert.equal(purged.object_key, null);
      assert.ok(purged.purged_at);
      assert.equal(purged.row_count, 1);
      assert.equal(purged.status, 'READY');

      const stale = claims.find((row) => row.export_id === otherTenant.exported);
      await admin.query(`UPDATE exports SET object_purge_lease_expires_at=clock_timestamp()-interval '1 second'
        WHERE tenant_id=$1 AND id=$2`, [stale.tenant_id, stale.export_id]);
      const reclaimed = (await runtime.query(
        "SELECT * FROM claim_expired_retention_objects(20,'worker-b')")).rows;
      const fresh = reclaimed.find((row) => row.export_id === otherTenant.exported);
      assert.ok(fresh);
      assert.notEqual(fresh.lease_token, stale.lease_token);
      assert.equal((await runtime.query('SELECT apply_export_object_purge($1,$2,$3,$4) AS applied',
        [stale.tenant_id, stale.export_id, 'worker-a', stale.lease_token])).rows[0].applied, false);
      assert.equal((await runtime.query('SELECT apply_export_object_purge($1,$2,$3,$4) AS applied',
        [fresh.tenant_id, fresh.export_id, 'worker-b', fresh.lease_token])).rows[0].applied, true);

      const raceExport = randomUUID();
      await admin.query(`INSERT INTO exports (tenant_id,event_id,id,actor_user_id,status,object_key)
        VALUES ($1,$2,$3,$4,'READY',$5)`,
      [tenantA, due.event, raceExport, user, 'exports/' + raceExport]);
      const competitor = new Client({ connectionString: db.runtimeUrl });
      await competitor.connect();
      try {
        const [a, b] = await Promise.all([
          runtime.query("SELECT * FROM claim_expired_retention_objects(1,'race-a')"),
          competitor.query("SELECT * FROM claim_expired_retention_objects(1,'race-b')"),
        ]);
        assert.equal(a.rows.length + b.rows.length, 1);
        assert.equal([...a.rows, ...b.rows][0].export_id, raceExport);
      } finally {
        await competitor.end();
      }
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

test('O06 export claim fences the clock before a late editor can commit',
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
      assert.equal((await runtime.query("SELECT * FROM claim_expired_retention_objects(1,'worker-a')")).rows.length,
        0, 'claim skips an event with a concurrent clock change');
      await admin.query('COMMIT');
      assert.equal((await runtime.query("SELECT * FROM claim_expired_retention_objects(1,'worker-a')")).rows.length, 0);
      await admin.query('UPDATE events SET ends_at=clock_timestamp()-interval \'91 days\' WHERE id=$1',
        [row.event]);

      await runtime.query('BEGIN');
      const claims = (await runtime.query("SELECT * FROM claim_expired_retention_objects(1,'worker-a')")).rows;
      assert.equal(claims.length, 1);
      let editorDone = false;
      const editor = admin.query('UPDATE events SET ends_at=clock_timestamp()+interval \'1 day\' WHERE id=$1',
        [row.event]).catch((error) => {
        editorDone = true;
        assert.match(error.message, /EVENT_RETENTION_FENCED/);
      });
      await pause();
      assert.equal(editorDone, false, 'editor waits for claim transaction');
      await runtime.query('COMMIT');
      await editor;
      assert.equal(editorDone, true);
      const state = (await admin.query('SELECT export_retention_fenced_at FROM events WHERE id=$1',
        [row.event])).rows[0];
      assert.ok(state.export_retention_fenced_at);
      assert.equal((await runtime.query('SELECT apply_export_object_purge($1,$2,$3,$4) AS applied',
        [tenant, row.exported, 'worker-a', claims[0].lease_token])).rows[0].applied, true);
      await assert.rejects(admin.query('UPDATE exports SET status=\'PROCESSING\', object_key=\'retry\' WHERE id=$1',
        [row.exported]), /EXPORT_OBJECT_PURGED/);
    } finally {
      if (db?.runtime) await db.runtime.end().catch(() => {});
      if (db?.admin) await db.admin.end().catch(() => {});
      if (db?.name) docker('rm', '-f', db.name);
    }
  });

test('O06 delete failure and crash-after-delete reclaim with a new lease token',
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
      const queryDb = { $queryRaw: async (parts, ...values) => {
        const sql = parts.reduce((text, part, i) => text + (i ? '$' + i : '') + part, '');
        return (await runtime.query(sql, values)).rows;
      } };
      let deletes = 0;
      const failingStore = { deleteObject: async (key) => {
        deletes += 1;
        assert.equal(key, 'exports/' + row.exported);
        const state = (await admin.query('SELECT export_retention_fenced_at FROM events WHERE id=$1',
          [row.event])).rows[0];
        assert.ok(state.export_retention_fenced_at, 'fence committed before DELETE');
        throw new Error('isolated object store unavailable');
      } };
      assert.deepEqual(await processDueObjectRetentions(queryDb, failingStore, 'worker-a', 1),
        { scanned: 1, applied: 0, failed: 1 });
      assert.equal(deletes, 1);
      const old = (await admin.query('SELECT object_purge_lease_token FROM exports WHERE id=$1',
        [row.exported])).rows[0].object_purge_lease_token;
      await admin.query(`UPDATE exports SET object_purge_lease_expires_at=clock_timestamp()-interval '1 second'
        WHERE id=$1`, [row.exported]);
      const missingStore = { deleteObject: async (key) => {
        deletes += 1;
        assert.equal(key, 'exports/' + row.exported);
        // Simulates MinIO returning 404 after a worker deleted bytes then crashed.
      } };
      assert.deepEqual(await processDueObjectRetentions(queryDb, missingStore, 'worker-b', 1),
        { scanned: 1, applied: 1, failed: 0 });
      assert.equal(deletes, 2);
      assert.equal((await runtime.query('SELECT apply_export_object_purge($1,$2,$3,$4) AS applied',
        [tenant, row.exported, 'worker-a', old])).rows[0].applied, false);
      const purged = (await admin.query('SELECT object_key,purged_at,row_count FROM exports WHERE id=$1',
        [row.exported])).rows[0];
      assert.equal(purged.object_key, null);
      assert.ok(purged.purged_at);
      assert.equal(purged.row_count, 1);
    } finally {
      if (db?.runtime) await db.runtime.end().catch(() => {});
      if (db?.admin) await db.admin.end().catch(() => {});
      if (db?.name) docker('rm', '-f', db.name);
    }
  });
