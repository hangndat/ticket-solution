/** Isolated PG fault: a locked pending sweep must settle before the next poll. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { createServer: createHttpServer } = require('node:http');
const { createServer: createNetServer } = require('node:net');
const { once } = require('node:events');
const { Client } = require('pg');
const { migrationFiles } = require('./migration-files.cjs');
const {
  createDatabase, claimOutboxBatch, collectWorkerDueJobSnapshot,
  createSmtpEmailAdapter, metricsQuantileSeconds, renderPrometheusText,
  resetMetricsForTests,
} = require('../dist');
const { WorkerRelay } = require('../../../apps/worker/dist');

const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('PG lock cancels reconcile, next due row expires, shutdown and reclaim stay bounded',
  { timeout: 120000 }, async () => {
    const name = 'ticket-worker-cancel-' + randomBytes(4).toString('hex');
    const password = randomBytes(16).toString('hex');
    let admin;
    let locker;
    let db;
    let restarted;
    let relay;
    let loadRelay;
    let objectServer;
    let smtpServer;
    const smtpSockets = new Set();
    try {
      docker('run', '-d', '--name', name, '--label', 'ticket.task=task_d27b9a0ecf64',
        '-e', 'POSTGRES_PASSWORD=' + password, '-e', 'POSTGRES_DB=worker_cancel',
        '-p', '127.0.0.1::5432', 'postgres:18.1-alpine');
      const port = docker('port', name, '5432/tcp').split(':').at(-1);
      const adminUrl = `postgresql://postgres:${password}@127.0.0.1:${port}/worker_cancel`;
      for (let i = 0; i < 60; i++) {
        try {
          docker('exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'worker_cancel');
          break;
        } catch { await delay(200); }
      }
      admin = new Client({ connectionString: adminUrl });
      await admin.connect();
      await admin.query('CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
      await admin.query('CREATE ROLE ticket_platform_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
      await admin.query('CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS');
      await admin.query('GRANT CREATE, USAGE ON SCHEMA public TO migration_owner');
      await admin.query('SET ROLE migration_owner');
      for (const file of migrationFiles()) await admin.query(readFileSync(file, 'utf8'));
      await admin.query('RESET ROLE');
      await admin.query(`CREATE ROLE worker_login LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS INHERIT`);
      await admin.query('GRANT ticket_runtime TO worker_login');
      const url = `postgresql://worker_login:${password}@127.0.0.1:${port}/worker_cancel`;
      const tenant = randomUUID(), event = randomUUID(), user = randomUUID();
      const type = randomUUID(), source = randomUUID(), code = randomUUID(), request = randomUUID();
      const outbox = randomUUID();
      await admin.query('INSERT INTO tenants(id,slug,name) VALUES($1,$2,$3)', [tenant,'cancel-fixture','Cancel fixture']);
      await admin.query('INSERT INTO events(tenant_id,id,slug,name) VALUES($1,$2,$3,$4)', [tenant,event,'event','Event']);
      await admin.query('INSERT INTO users(id,issuer,subject,email) VALUES($1,$2,$3,$4)', [user,'fixture','user','fixture@example.test']);
      await admin.query('INSERT INTO ticket_types(tenant_id,event_id,id,label) VALUES($1,$2,$3,$4)', [tenant,event,type,'Entry']);
      await admin.query('INSERT INTO issuance_sources(tenant_id,event_id,id,name) VALUES($1,$2,$3,$4)', [tenant,event,source,'Source']);
      await admin.query("INSERT INTO redemption_codes(tenant_id,event_id,id,code_hmac,source_id,ticket_type_id,status,active_request_id) VALUES($1,$2,$3,'fixture-hmac',$4,$5,'HELD',$6)", [tenant,event,code,source,type,request]);
      await admin.query("INSERT INTO redemption_requests(tenant_id,event_id,id,actor_user_id,redemption_code_id,status,expires_at) VALUES($1,$2,$3,$4,$5,'PENDING_REVIEW',clock_timestamp()-interval '2 seconds')", [tenant,event,request,user,code]);

      db = createDatabase(url, 2, true, { statementTimeoutMs: 15000, lockTimeoutMs: 2000, poolWaitTimeoutMs: 1000 });
      locker = new Client({ connectionString: adminUrl });
      await locker.connect();
      await locker.query('BEGIN');
      await locker.query('LOCK TABLE redemption_requests IN ACCESS EXCLUSIVE MODE');
      relay = new WorkerRelay(db, { sendTicketIssued: async () => ({providerRef:'fixture',providerStatus:'ACCEPTED'}) },
        undefined, 'worker-cancel', true, 0, 'fixture-key-material-12345', { NODE_ENV: 'test' },
        { tickStepTimeoutMs: 250, shutdownTickTimeoutMs: 1500 });
      const first = performance.now();
      await relay.runPollCycle();
      assert.ok(performance.now() - first < 1500, 'supervisor returns while PG query remains locked');
      await relay.runPollCycle();
      assert.match(renderPrometheusText(), /worker_job_skipped_total\{job_class="reconcile_pending_redemptions"\} 1/,
        'timed-out PG work remains fenced from an overlapping poll');
      await delay(2400);
      const before = await locker.query('SELECT status FROM redemption_requests WHERE id=$1', [request]);
      assert.equal(before.rows[0].status, 'PENDING_REVIEW', 'cancelled query has no partial effect');
      await locker.query('ROLLBACK');
      const second = performance.now();
      await relay.runPollCycle();
      assert.ok(performance.now() - second < 5000, 'next poll must run after DB cancellation');
      const after = await admin.query('SELECT status FROM redemption_requests WHERE id=$1', [request]);
      const codeAfter = await admin.query('SELECT status FROM redemption_codes WHERE id=$1', [code]);
      assert.equal(after.rows[0].status, 'EXPIRED');
      assert.equal(codeAfter.rows[0].status, 'AVAILABLE');
      const shutdown = performance.now();
      await relay.onModuleDestroy();
      relay = null;
      assert.ok(performance.now() - shutdown < 1500, 'shutdown remains inside cap');
      await admin.query("INSERT INTO outbox(tenant_id,id,type,aggregate_id,status,lease_owner,lease_token,lease_expires_at) VALUES($1,$2,'MembershipInvite',$3,'LEASED','old-owner','old-token',clock_timestamp()-interval '2 seconds')", [tenant,outbox,randomUUID()]);
      restarted = createDatabase(url, 1, true, { statementTimeoutMs: 15000, lockTimeoutMs: 2000, poolWaitTimeoutMs: 1000 });
      const claim = await claimOutboxBatch(restarted, 'worker-restart', 1);
      assert.equal(claim[0].outbox_id, outbox);
      assert.notEqual(claim[0].lease_token, 'old-token');
      const snapshot = await collectWorkerDueJobSnapshot(restarted);
      assert.equal(snapshot.find((row) => row.jobClass === 'relay_outbox').reclaimCount, 1);
      assert.equal(snapshot.find((row) => row.jobClass === 'reconcile_pending_redemptions').dueCount, 0);

      // Combined scheduler fault: 20k real ticket rows (the export cap), five
      // export jobs, twelve SMTP deliveries, 120 due pending rows, pool=1.
      await admin.query('CREATE TEMP TABLE fixture_bulk AS SELECT gen_random_uuid() request_id, gen_random_uuid() ticket_id FROM generate_series(1,20000)');
      await admin.query("INSERT INTO redemption_requests(tenant_id,event_id,id,actor_user_id,redemption_code_id,status) SELECT $1,$2,request_id,$3,$4,'ISSUED' FROM fixture_bulk", [tenant,event,user,code]);
      await admin.query("INSERT INTO tickets(tenant_id,event_id,id,owner_user_id,ticket_type_id,source_id,request_id,state) SELECT $1,$2,ticket_id,$3,$4,$5,request_id,'ACTIVE' FROM fixture_bulk", [tenant,event,user,type,source]);
      await admin.query("INSERT INTO exports(tenant_id,event_id,id,actor_user_id,status) SELECT $1,$2,gen_random_uuid(),$3,'PENDING' FROM generate_series(1,5)", [tenant,event,user]);
      await admin.query("WITH batch AS (SELECT gen_random_uuid() id FROM generate_series(1,12)) INSERT INTO outbox(tenant_id,id,type,aggregate_id,payload,status,created_at) SELECT $1,id,'MembershipInvite',id,jsonb_build_object('inviteId',id,'email','fixture@example.test','role','manager','token','fixture-token','expiresAt',(clock_timestamp()+interval '1 day')::text),'PENDING',clock_timestamp()-interval '1 second' FROM batch", [tenant]);
      await admin.query('CREATE TEMP TABLE fixture_due AS SELECT gen_random_uuid() code_id, gen_random_uuid() request_id, row_number() over () n FROM generate_series(1,120)');
      await admin.query("INSERT INTO redemption_codes(tenant_id,event_id,id,code_hmac,source_id,ticket_type_id,status,active_request_id) SELECT $1,$2,code_id,'due-'||n,$3,$4,'HELD',request_id FROM fixture_due", [tenant,event,source,type]);
      await admin.query("INSERT INTO redemption_requests(tenant_id,event_id,id,actor_user_id,redemption_code_id,status,expires_at) SELECT $1,$2,request_id,$3,code_id,'PENDING_REVIEW',clock_timestamp()-interval '1 second' FROM fixture_due", [tenant,event,user]);

      const objectBytes = [];
      objectServer = createHttpServer((req, res) => {
        let bytes = 0;
        req.on('data', (chunk) => { bytes += chunk.length; });
        req.on('end', () => {
          objectBytes.push(bytes);
          setTimeout(() => { res.writeHead(200); res.end('ok'); }, 350);
        });
      });
      objectServer.listen(0, '127.0.0.1');
      await once(objectServer, 'listening');
      let smtpAccepted = 0;
      smtpServer = createNetServer((socket) => {
        smtpSockets.add(socket);
        socket.on('close', () => smtpSockets.delete(socket));
        socket.write('220 fixture ESMTP\r\n');
        let buffer = '', dataMode = false;
        socket.on('data', (chunk) => {
          buffer += chunk.toString();
          if (dataMode) {
            if (buffer.includes('\r\n.\r\n')) {
              buffer = ''; dataMode = false; smtpAccepted += 1;
              setTimeout(() => socket.write('250 queued\r\n'), 120);
            }
            return;
          }
          let end;
          while ((end = buffer.indexOf('\r\n')) >= 0) {
            const line = buffer.slice(0,end); buffer = buffer.slice(end+2);
            if (/^EHLO/i.test(line)) socket.write('250 fixture\r\n');
            else if (/^MAIL FROM|^RCPT TO/i.test(line)) socket.write('250 ok\r\n');
            else if (/^DATA/i.test(line)) { dataMode = true; socket.write('354 send data\r\n'); break; }
            else if (/^QUIT/i.test(line)) { socket.write('221 bye\r\n'); socket.end(); }
          }
        });
      });
      smtpServer.listen(0, '127.0.0.1');
      await once(smtpServer, 'listening');
      resetMetricsForTests();
      const loadEnv = {
        NODE_ENV: 'test',
        MINIO_ENDPOINT: `http://127.0.0.1:${objectServer.address().port}`,
        MINIO_ACCESS_KEY: 'fixture', MINIO_SECRET_KEY: 'fixture',
        MINIO_EXPORTS_ACCESS_KEY: "synthetic-job06-export-access",
        MINIO_EXPORTS_SECRET_KEY: "synthetic-job06-export-secret",
        MINIO_BUCKET_EXPORTS: 'fixture',
        PUBLIC_WEB_BASE_URL: 'https://fixture.example.test',
      };
      loadRelay = new WorkerRelay(restarted,
        createSmtpEmailAdapter({ smtpUrl: `smtp+plain://127.0.0.1:${smtpServer.address().port}`, fromAddress: 'fixture@example.test', nodeEnv: 'test' }),
        undefined, 'worker-load', false, 75, 'fixture-key-material-12345', loadEnv,
        { shutdownTickTimeoutMs: 3000, testActions: {
          process_account_anonymizations: async () => {}, cleanup_import_files: async () => {},
        } });
      const oldest = {};
      const loadStart = performance.now();
      loadRelay.start();
      // Hold the only worker connection repeatedly while real jobs are queued.
      const contention = (async () => {
        for (let i = 0; i < 6; i++) {
          await restarted.$queryRaw`SELECT 1 AS n FROM pg_sleep(0.18)`;
        }
      })();
      let complete = false;
      let samples = 0;
      for (let i = 0; i < 90; i++) {
        const rows = await collectWorkerDueJobSnapshot(restarted);
        samples += 1;
        for (const row of rows) oldest[row.jobClass] = Math.max(oldest[row.jobClass] ?? 0, row.oldestDueAgeSeconds);
        const state = await admin.query("SELECT (SELECT count(*)::int FROM exports WHERE status='READY') exports, (SELECT count(*)::int FROM outbox WHERE status='COMPLETE') outbox, (SELECT count(*)::int FROM redemption_requests WHERE status='PENDING_REVIEW') pending");
        if (state.rows[0].exports === 5 && state.rows[0].outbox === 12 && state.rows[0].pending === 0) { complete = true; break; }
        await delay(150);
      }
      await contention;
      await loadRelay.onModuleDestroy();
      loadRelay = null;
      const exported = await admin.query("SELECT count(*)::int n, min(row_count)::int min_rows FROM exports WHERE status='READY'");
      assert.equal(complete, true, 'all real due jobs must settle under combined load');
      assert.equal(exported.rows[0].n, 5);
      assert.equal(exported.rows[0].min_rows, 20000);
      assert.equal(smtpAccepted, 12);
      assert.equal(objectBytes.length, 5);
      assert.ok(objectBytes.every((bytes) => bytes > 1000000), 'each CSV must be over 1 MB');
      const metrics = renderPrometheusText();
      const counts = {};
      for (const jobClass of ['reconcile_pending_redemptions','relay_outbox','relay_exports']) {
        const match = metrics.match(new RegExp(`worker_job_active_duration_seconds_count\\{job_class="${jobClass}"\\} (\\d+)`));
        counts[jobClass] = Number(match?.[1] ?? 0);
        assert.ok(counts[jobClass] > 0, jobClass + ' measured samples');
      }
      const result = {
        event: 'worker_combined_fault_sample', environment: 'isolated_local_synthetic',
        ticketRows: 20000, exportJobs: 5, outboxJobs: 12, pendingJobs: 120,
        poolSize: 1, poolContentionQueries: 6, smtpDelayMs: 120,
        objectDelayMs: 350, csvBytes: objectBytes,
        durationMs: Math.round(performance.now() - loadStart), snapshotSamples: samples,
        classes: Object.fromEntries(Object.entries(counts).map(([key, count]) => [key, {
          n: count,
          p95Seconds: metricsQuantileSeconds('worker_job_active_duration_seconds', {job_class:key}, .95),
          maxOldestDueAgeSeconds: oldest[key],
        }])),
        poolWaitP95Seconds: metricsQuantileSeconds('worker_db_pool_wait_seconds', {}, .95),
        reclaimCount: (await collectWorkerDueJobSnapshot(restarted)).find((row) => row.jobClass === 'relay_outbox').reclaimCount,
      };
      for (const [jobClass, durationBudget, ageBudget] of [
        ['reconcile_pending_redemptions', 5, 10], ['relay_outbox', 15, 60],
        ['relay_exports', 60, 300],
      ]) {
        assert.ok(result.classes[jobClass].p95Seconds <= durationBudget, jobClass + ' duration budget');
        assert.ok(result.classes[jobClass].maxOldestDueAgeSeconds <= ageBudget, jobClass + ' due-age budget');
      }
      assert.ok(result.poolWaitP95Seconds > 0.05, 'fixture must create measured pool contention');
      assert.equal(result.reclaimCount, 1);
      console.info(JSON.stringify(result));
    } finally {
      if (locker) await locker.query('ROLLBACK').catch(() => {});
      if (loadRelay) await loadRelay.onModuleDestroy().catch(() => {});
      if (relay) await relay.onModuleDestroy().catch(() => {});
      if (restarted) await restarted.$disconnect().catch(() => {});
      if (db) await db.$disconnect().catch(() => {});
      if (locker) await locker.end().catch(() => {});
      if (admin) await admin.end().catch(() => {});
      if (objectServer) { objectServer.closeAllConnections(); objectServer.close(); }
      for (const socket of smtpSockets) socket.destroy();
      if (smtpServer) smtpServer.close();
      docker('rm', '-f', '-v', name);
    }
  });
