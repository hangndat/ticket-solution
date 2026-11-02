'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
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
