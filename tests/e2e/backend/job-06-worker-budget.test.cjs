'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { once } = require('node:events');
const { createServer: createNetServer } = require('node:net');
const { Client } = require('../../../packages/backend/node_modules/pg');
const { startPostgres } = require('./pg-fixture.cjs');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function workerEvents(output) {
  return output
    .split('\n')
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

async function startStalledSmtp() {
  let connections = 0;
  const sockets = new Set();
  const server = createNetServer((socket) => {
    connections += 1;
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.write('220 job06-stall ESMTP\r\n');
    socket.resume();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    smtpUrl: `smtp+plain://127.0.0.1:${server.address().port}`,
    get connections() {
      return connections;
    },
    close() {
      for (const socket of sockets) socket.destroy();
      server.close();
    },
  };
}


async function startMailpit() {
  const name = `ticket-job06-mailpit-${randomBytes(5).toString('hex')}`;
  docker(
    'run',
    '-d',
    '--name',
    name,
    '--label',
    'ticket.e2e.backend=true',
    '-p',
    '127.0.0.1::1025',
    '-p',
    '127.0.0.1::8025',
    'axllent/mailpit:v1.27.10',
  );
  try {
    const smtpPort = docker('port', name, '1025/tcp').split(':').at(-1);
    const apiPort = docker('port', name, '8025/tcp').split(':').at(-1);
    const api = `http://127.0.0.1:${apiPort}`;
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try {
        ready = (await fetch(`${api}/api/v1/info`)).ok;
        if (ready) break;
      } catch {
        // Mailpit is still starting.
      }
      await delay(250);
    }
    assert.ok(
      ready,
      'isolated Mailpit must become ready for the reclaim attempt',
    );
    return {
      name,
      api,
      smtpUrl: `smtp+plain://127.0.0.1:${smtpPort}`,
      async messageCount() {
        const response = await fetch(`${api}/api/v1/messages`);
        assert.equal(response.status, 200);
        return (await response.json()).total;
      },
      close() {
        docker('rm', '-f', name);
      },
    };
  } catch (error) {
    docker('rm', '-f', name);
    throw error;
  }
}

function spawnWorker(pgUrl, smtpUrl, output) {
  const worker = spawn(process.execPath, ['apps/worker/dist/main.js'], {
    cwd: require('node:path').resolve(__dirname, '../../..'),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      PATH: process.env.PATH,
      NODE_ENV: 'test',
      NODE_OPTIONS: `--require=${require('node:path').resolve(__dirname, 'job-06-one-connection.cjs')}`,
      DATABASE_URL: pgUrl,
      SMTP_URL: smtpUrl,
      SMTP_FROM: 'tickets@job06.example.test',
      OUTBOX_POLL_MS: '100',
      WORKER_TICK_STEP_TIMEOUT_MS: '150',
      WORKER_SHUTDOWN_TICK_TIMEOUT_MS: '250',
      TICKET_CREDENTIAL_KEY: '[REDACTED:Generic long secret]',
      PUBLIC_WEB_BASE_URL: 'https://tickets.job06.example.test',
    },
  });
  worker.stdout.setEncoding('utf8');
  worker.stderr.setEncoding('utf8');
  worker.stdout.on('data', (chunk) => (output.value += chunk));
  worker.stderr.on('data', (chunk) => (output.value += chunk));
  return worker;
}

async function stopWorker(worker, timeoutMs = 2000) {
  if (worker.exitCode !== null || worker.signalCode !== null) return;
  worker.kill('SIGTERM');
  const closed = await Promise.race([
    once(worker, 'close').then(([code, signal]) => ({ code, signal })),
    delay(timeoutMs).then(() => null),
  ]);
  if (!closed) {
    worker.kill('SIGKILL');
    throw new Error(`worker did not stop within ${timeoutMs}ms`);
  }
  return closed;
}

test(
  '[JOB-06] R real worker process bounds a stuck step while reconciliation continues',
  { timeout: 120000 },
  async () => {
    let pg;
    let admin;
    let worker;
    let output = '';
    const tenantId = randomUUID();
    const eventId = randomUUID();
    const userId = randomUUID();
    const ticketTypeId = randomUUID();
    const sourceId = randomUUID();
    const codeId = randomUUID();
    const requestId = randomUUID();

    try {
      pg = await startPostgres();
      admin = new Client({
        connectionString: pg.adminUrl,
        connectionTimeoutMillis: 2000,
      });
      await admin.connect();
      await admin.query(
        'INSERT INTO tenants(id, slug, name) VALUES($1, $2, $3)',
        [tenantId, 'job06-budget', 'JOB-06 budget fixture'],
      );
      await admin.query(
        'INSERT INTO tenant_limits(tenant_id, email_per_day) VALUES($1, NULL)',
        [tenantId],
      );
      await admin.query(
        'INSERT INTO events(tenant_id, id, slug, name) VALUES($1, $2, $3, $4)',
        [tenantId, eventId, 'job06-event', 'JOB-06 event'],
      );
      await admin.query(
        'INSERT INTO users(id, issuer, subject, email) VALUES($1, $2, $3, $4)',
        [
          userId,
          'https://auth.example.test/realms/job06',
          randomUUID(),
          'job06@example.test',
        ],
      );
      await admin.query(
        'INSERT INTO ticket_types(tenant_id, event_id, id, label) VALUES($1, $2, $3, $4)',
        [tenantId, eventId, ticketTypeId, 'JOB-06 entry'],
      );
      await admin.query(
        'INSERT INTO issuance_sources(tenant_id, event_id, id, name) VALUES($1, $2, $3, $4)',
        [tenantId, eventId, sourceId, 'JOB-06 source'],
      );
      await admin.query(
        `INSERT INTO redemption_codes
          (tenant_id, event_id, id, code_hmac, source_id, ticket_type_id, status, active_request_id)
         VALUES($1, $2, $3, 'job06-fixture-hmac', $4, $5, 'HELD', $6)`,
        [tenantId, eventId, codeId, sourceId, ticketTypeId, requestId],
      );
      await admin.query(
        `INSERT INTO redemption_requests
          (tenant_id, event_id, id, actor_user_id, redemption_code_id, status, expires_at)
         VALUES($1, $2, $3, $4, $5, 'PENDING_REVIEW', clock_timestamp() - interval '2 seconds')`,
        [tenantId, eventId, requestId, userId, codeId],
      );

      worker = spawn(process.execPath, ['apps/worker/dist/main.js'], {
        cwd: require('node:path').resolve(__dirname, '../../..'),
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          PATH: process.env.PATH,
          NODE_ENV: 'test',
          DATABASE_URL: pg.url,
          OUTBOX_POLL_MS: '100',
          WORKER_TICK_STEP_TIMEOUT_MS: '150',
          WORKER_SHUTDOWN_TICK_TIMEOUT_MS: '250',
          WORKER_TEST_HANG_TICK_STEP: 'relay_outbox',
          TICKET_CREDENTIAL_KEY: 'job06-process-test-credential-key',
          PUBLIC_WEB_BASE_URL: 'https://tickets.job06.example.test',
        },
      });
      worker.stdout.setEncoding('utf8');
      worker.stderr.setEncoding('utf8');
      worker.stdout.on('data', (chunk) => {
        output += chunk;
      });
      worker.stderr.on('data', (chunk) => {
        output += chunk;
      });

      const startedAt = performance.now();
      const deadline = Date.now() + 10000;
      let requestStatus;
      let sawTimeout = false;
      let sawOverlapFence = false;
      while (Date.now() < deadline) {
        assert.equal(
          worker.exitCode,
          null,
          'the real worker must remain alive after step timeout',
        );
        const state = await admin.query(
          `SELECT rr.status, rc.status AS code_status
           FROM redemption_requests rr
           JOIN redemption_codes rc
             ON rc.tenant_id = rr.tenant_id
            AND rc.event_id = rr.event_id
            AND rc.id = rr.redemption_code_id
           WHERE rr.tenant_id = $1 AND rr.id = $2`,
          [tenantId, requestId],
        );
        requestStatus = state.rows[0];
        const events = workerEvents(output);
        sawTimeout = events.some(
          (item) =>
            item.event === 'tick_step_timeout' &&
            item.step === 'relay_outbox' &&
            item.timeoutMs === 150,
        );
        sawOverlapFence = events.some(
          (item) =>
            item.event === 'tick_step_still_running' &&
            item.step === 'relay_outbox',
        );
        if (
          sawTimeout &&
          sawOverlapFence &&
          requestStatus?.status === 'EXPIRED'
        )
          break;
        await delay(50);
      }
      const elapsedMs = performance.now() - startedAt;
      assert.ok(
        sawTimeout,
        'worker process must report the configured 150ms action budget',
      );
      assert.ok(
        sawOverlapFence,
        'a timed-out live action must not overlap its next poll',
      );
      assert.equal(requestStatus?.status, 'EXPIRED');
      assert.equal(requestStatus?.code_status, 'AVAILABLE');
      assert.ok(
        elapsedMs < 10000,
        `reconciliation exceeded the 10s observation limit: ${elapsedMs}ms`,
      );

      const shutdownAt = performance.now();
      const closed = await stopWorker(worker);
      worker = null;
      const shutdownMs = performance.now() - shutdownAt;
      assert.equal(closed.signal, 'SIGTERM');
      assert.equal(closed.code, null);
      assert.ok(
        shutdownMs < 1500,
        `SIGTERM shutdown exceeded 1.5s: ${shutdownMs}ms`,
      );
      const shutdown = workerEvents(output).find(
        (item) => item.event === 'shutdown_tick_wait',
      );
      assert.equal(shutdown?.outcome, 'timed_out');
      assert.equal(shutdown?.timeoutMs, 250);
      console.info(
        JSON.stringify({
          event: 'job06_real_worker_budget_sample',
          environment: 'isolated_local_postgres_real_worker_process',
          configuredStepBudgetMs: 150,
          reconcileElapsedMs: Math.round(elapsedMs),
          shutdownBudgetMs: 250,
          shutdownElapsedMs: Math.round(shutdownMs),
        }),
      );
    } finally {
      if (worker) await stopWorker(worker).catch(() => {});
      if (admin) await admin.end().catch(() => {});
      if (pg) pg.stop();
    }
  },
);

test(
  '[JOB-06] R stalled SMTP after claim times out, then lease reclaim preserves finite tenant cap',
  { timeout: 120000 },
  async () => {
    let pg;
    let admin;
    let stalledSmtp;
    let mailpit;
    let workerA;
    let workerB;
    const outputA = { value: '' };
    const outputB = { value: '' };
    const tenantId = randomUUID();
    const eventId = randomUUID();
    const userId = randomUUID();
    const ticketTypeId = randomUUID();
    const sourceId = randomUUID();
    const codeId = randomUUID();
    const requestId = randomUUID();
    const firstOutboxId = randomUUID();
    const secondOutboxId = randomUUID();
    const firstInviteId = randomUUID();
    const secondInviteId = randomUUID();

    try {
      pg = await startPostgres();
      admin = new Client({
        connectionString: pg.adminUrl,
        connectionTimeoutMillis: 2000,
      });
      await admin.connect();
      await admin.query(
        'INSERT INTO tenants(id, slug, name) VALUES($1, $2, $3)',
        [tenantId, 'job06-reclaim', 'JOB-06 reclaim fixture'],
      );
      await admin.query(
        'INSERT INTO tenant_limits(tenant_id, email_per_day) VALUES($1, 2)',
        [tenantId],
      );
      await admin.query(
        'INSERT INTO events(tenant_id, id, slug, name) VALUES($1, $2, $3, $4)',
        [tenantId, eventId, 'job06-reclaim-event', 'JOB-06 reclaim event'],
      );
      await admin.query(
        'INSERT INTO users(id, issuer, subject, email) VALUES($1, $2, $3, $4)',
        [
          userId,
          'https://auth.example.test/realms/job06',
          randomUUID(),
          'job06@example.test',
        ],
      );
      await admin.query(
        'INSERT INTO ticket_types(tenant_id, event_id, id, label) VALUES($1, $2, $3, $4)',
        [tenantId, eventId, ticketTypeId, 'JOB-06 entry'],
      );
      await admin.query(
        'INSERT INTO issuance_sources(tenant_id, event_id, id, name) VALUES($1, $2, $3, $4)',
        [tenantId, eventId, sourceId, 'JOB-06 source'],
      );
      await admin.query(
        `INSERT INTO redemption_codes
          (tenant_id, event_id, id, code_hmac, source_id, ticket_type_id, status, active_request_id)
         VALUES($1, $2, $3, 'job06-reclaim-hmac', $4, $5, 'HELD', $6)`,
        [tenantId, eventId, codeId, sourceId, ticketTypeId, requestId],
      );
      await admin.query(
        `INSERT INTO redemption_requests
          (tenant_id, event_id, id, actor_user_id, redemption_code_id, status, expires_at)
         VALUES($1, $2, $3, $4, $5, 'PENDING_REVIEW', clock_timestamp() + interval '1 day')`,
        [tenantId, eventId, requestId, userId, codeId],
      );
      const insertInvite = (outboxId, inviteId, ageSeconds) =>
        admin.query(
          `INSERT INTO outbox
            (tenant_id, id, type, aggregate_id, payload, status, attempts, created_at)
           VALUES($1, $2, 'MembershipInvite', $3, $4::jsonb, 'PENDING', 0,
             clock_timestamp() - make_interval(secs => $5::integer))`,
          [
            tenantId,
            outboxId,
            inviteId,
            JSON.stringify({
              inviteId,
              email: `invite-${inviteId}@job06.example.test`,
              role: 'Manager',
              token: randomUUID(),
              expiresAt: '2030-01-01T00:00:00.000Z',
            }),
            ageSeconds,
          ],
        );
      await insertInvite(firstOutboxId, firstInviteId, 3);
      await insertInvite(secondOutboxId, secondInviteId, 2);
      stalledSmtp = await startStalledSmtp();
      workerA = spawnWorker(pg.url, stalledSmtp.smtpUrl, outputA);

      const startedAt = performance.now();
      const deadline = Date.now() + 12000;
      let firstRow;
      let requestState;
      let sawTimeout = false;
      let sawOverlapFence = false;
      let expiredAfterSmtp = false;
      while (Date.now() < deadline) {
        assert.equal(
          workerA.exitCode,
          null,
          'worker must remain alive after provider stall timeout',
        );
        const rows = await admin.query(
          `SELECT status, lease_owner, lease_token,
                  lease_expires_at > clock_timestamp() AS lease_live,
                  attempts, payload->>'emailBudgetDeferred' AS deferred_reason
           FROM outbox WHERE tenant_id = $1 AND id = $2`,
          [tenantId, firstOutboxId],
        );
        firstRow = rows.rows[0];
        if (stalledSmtp.connections === 1 && !expiredAfterSmtp) {
          await admin.query(
            `UPDATE redemption_requests SET expires_at = clock_timestamp() - interval '2 seconds'
             WHERE tenant_id = $1 AND id = $2`, [tenantId, requestId],
          );
          expiredAfterSmtp = true;
        }
        const requests = await admin.query(
          `SELECT rr.status, rc.status AS code_status
           FROM redemption_requests rr
           JOIN redemption_codes rc ON rc.tenant_id = rr.tenant_id
             AND rc.event_id = rr.event_id AND rc.id = rr.redemption_code_id
           WHERE rr.tenant_id = $1 AND rr.id = $2`,
          [tenantId, requestId],
        );
        requestState = requests.rows[0];
        const budget = await admin.query(
          `SELECT a.state, u.sent_count, u.held_count
           FROM tenant_email_budget_attempts a
           JOIN tenant_email_usage u ON u.tenant_id = a.tenant_id
             AND u.usage_date = a.usage_date
           WHERE a.tenant_id = $1 AND a.outbox_id = $2`,
          [tenantId, firstOutboxId],
        );
        const events = workerEvents(outputA.value);
        sawTimeout = events.some(
          (item) =>
            item.event === 'tick_step_timeout' &&
            item.step === 'relay_outbox' &&
            item.timeoutMs === 150,
        );
        sawOverlapFence = events.some(
          (item) =>
            item.event === 'tick_step_still_running' &&
            item.step === 'relay_outbox',
        );
        if (
          firstRow?.status === 'PROCESSING' &&
          firstRow.lease_owner &&
          firstRow.lease_live &&
          budget.rows[0]?.state === 'HELD' &&
          sawTimeout &&
          sawOverlapFence &&
          stalledSmtp.connections === 1 &&
          requestState?.status === 'EXPIRED'
        )
          break;
        await delay(50);
      }
      const postClaimMs = performance.now() - startedAt;
      assert.equal(
        firstRow?.status,
        'PROCESSING',
        'SMTP must stall after the DB claim and processing fence',
      );
      assert.ok(
        firstRow?.lease_live,
        'the post-claim row must retain a live lease during SMTP stall',
      );
      assert.ok(
        sawTimeout,
        'post-claim provider stall must be bounded by the worker step timeout',
      );
      assert.ok(
        sawOverlapFence,
        'the live post-claim action must block overlapping relay polls',
      );
      assert.equal(
        requestState?.status,
        'EXPIRED',
        'reconciliation must proceed while SMTP is stalled',
      );
      assert.equal(requestState?.code_status, 'AVAILABLE');
      assert.equal(
        stalledSmtp.connections,
        1,
        'one provider connection starts after claim',
      );

      const secondRowBefore = await admin.query(
        `SELECT status, payload->>'emailBudgetDeferred' AS deferred_reason
         FROM outbox WHERE tenant_id = $1 AND id = $2`,
        [tenantId, secondOutboxId],
      );
      assert.equal(secondRowBefore.rows[0].status, 'PENDING');
      assert.ok(expiredAfterSmtp, 'reconciliation must become due after SMTP connects');
      assert.ok(workerEvents(outputA.value).some((event) =>
        event.event === 'job06_test_pool_limit' && event.max === 1),
      'the real worker must use the single-connection test pool');
      await admin.query('BEGIN');
      try {
        await admin.query('SELECT id FROM outbox WHERE tenant_id=$1 AND id=$2 FOR UPDATE NOWAIT', [tenantId, firstOutboxId]);
      } finally {
        await admin.query('ROLLBACK');
      }

      const shutdownAt = performance.now();
      const closedA = await stopWorker(workerA);
      workerA = null;
      const shutdownMs = performance.now() - shutdownAt;
      assert.equal(closedA.signal, 'SIGTERM');
      assert.equal(closedA.code, null);
      assert.ok(
        shutdownMs < 1500,
        `post-claim shutdown exceeded 1.5s: ${shutdownMs}ms`,
      );
      const shutdownEvent = workerEvents(outputA.value).find(
        (item) => item.event === 'shutdown_tick_wait',
      );
      assert.equal(shutdownEvent?.outcome, 'timed_out');
      assert.equal(shutdownEvent?.timeoutMs, 250);

      await admin.query(
        `UPDATE outbox SET lease_expires_at = clock_timestamp() - interval '1 second'
         WHERE tenant_id = $1 AND id = $2`,
        [tenantId, firstOutboxId],
      );
      mailpit = await startMailpit();
      workerB = spawnWorker(pg.url, mailpit.smtpUrl, outputB);

      const reclaimDeadline = Date.now() + 15000;
      let firstAfterReclaim;
      let secondAfterBudget;
      let usage;
      let attempts;
      let providerMessages = 0;
      while (Date.now() < reclaimDeadline) {
        const rows = await admin.query(
          `SELECT id, status, attempts, payload->>'emailBudgetDeferred' AS deferred_reason,
                  next_attempt_at > clock_timestamp() AS next_window
           FROM outbox WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
          [tenantId, [firstOutboxId, secondOutboxId]],
        );
        firstAfterReclaim = rows.rows.find((row) => row.id === firstOutboxId);
        secondAfterBudget = rows.rows.find((row) => row.id === secondOutboxId);
        const usageRows = await admin.query(
          `SELECT sent_count, held_count FROM tenant_email_usage
           WHERE tenant_id = $1 AND usage_date = (clock_timestamp() AT TIME ZONE 'UTC')::date`,
          [tenantId],
        );
        usage = usageRows.rows[0];
        const attemptRows = await admin.query(
          `SELECT state FROM tenant_email_budget_attempts
           WHERE tenant_id = $1 AND outbox_id = $2 ORDER BY created_at`,
          [tenantId, firstOutboxId],
        );
        attempts = attemptRows.rows.map((row) => row.state);
        providerMessages = await mailpit.messageCount();
        if (
          firstAfterReclaim?.status === 'COMPLETE' &&
          firstAfterReclaim.attempts >= 2 &&
          secondAfterBudget?.status === 'PENDING' &&
          secondAfterBudget.deferred_reason === 'email_budget_deferred' &&
          secondAfterBudget.next_window &&
          providerMessages === 1
        )
          break;
        await delay(100);
      }
      assert.equal(
        firstAfterReclaim?.status,
        'COMPLETE',
        'replacement worker must reclaim the expired processing lease',
      );
      assert.ok(
        firstAfterReclaim?.attempts >= 2,
        'reclaimed row must receive a fresh lease attempt',
      );
      assert.equal(secondAfterBudget?.status, 'PENDING');
      assert.equal(secondAfterBudget?.deferred_reason, 'email_budget_deferred');
      assert.equal(secondAfterBudget?.next_window, true);
      assert.deepEqual(attempts.sort(), ['ACCEPTED', 'UNKNOWN']);
      assert.deepEqual(usage, { sent_count: 1, held_count: 1 });
      assert.equal(
        providerMessages,
        1,
        'reclaim sends one admitted invitation; second stays deferred at tenant cap',
      );
      const reclaimCounter = await admin.query(
        `SELECT reclaim_count FROM worker_job_reclaim_counters WHERE job_class = 'relay_outbox'`,
      );
      assert.equal(Number(reclaimCounter.rows[0]?.reclaim_count), 1);

      const shutdownB = await stopWorker(workerB);
      workerB = null;
      console.info(
        JSON.stringify({
          event: 'job06_postclaim_reclaim_sample',
          environment: 'isolated_local_postgres_real_worker_process',
          tenantDailyCap: 2,
          postClaimElapsedMs: Math.round(postClaimMs),
          workerShutdownMs: Math.round(shutdownMs),
          replacementLeaseAttempts: firstAfterReclaim.attempts,
          providerAccepted: providerMessages,
          dailySentCount: usage.sent_count,
          dailyHeldCount: usage.held_count,
          deferredCount: 1,
        workerPoolSize: 1,
          replacementShutdown: shutdownB.signal,
        }),
      );
    } finally {
      if (workerB) await stopWorker(workerB).catch(() => {});
      if (workerA) await stopWorker(workerA).catch(() => {});
      if (stalledSmtp) stalledSmtp.close();
      if (mailpit) mailpit.close();
      if (admin) await admin.end().catch(() => {});
      if (pg) pg.stop();
    }
  },
);
