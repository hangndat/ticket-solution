const { test } = require('node:test');
const assert = require('node:assert/strict');
const { WorkerRelay } = require('../dist/worker-relay');
const {
  renderPrometheusText,
  resetMetricsForTests,
} = require('../../../packages/backend/dist');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('slow SMTP/APNs and large export cannot starve reconcile or overlap timed-out actions', async () => {
  resetMetricsForTests();
  let reconciles = 0;
  let outboxStarts = 0;
  let exportStarts = 0;
  const db = { $queryRaw: async () => [], $disconnect: async () => {} };
  const relay = new WorkerRelay(
    db,
    {
      sendTicketIssued: async () => ({
        providerRef: 'test',
        providerStatus: 'ACCEPTED',
      }),
    },
    undefined,
    'worker-budget-fault',
    false,
    10,
    'test-key-material-12345',
    {
      NODE_ENV: 'test',
      MINIO_ENDPOINT: 'http://127.0.0.1:9000',
      MINIO_ACCESS_KEY: 'fixture',
      MINIO_SECRET_KEY: 'fixture',
    },
    {
      tickStepTimeoutMs: 25,
      shutdownTickTimeoutMs: 30,
      testActions: {
        reconcile_pending_redemptions: async () => {
          reconciles += 1;
        },
        relay_outbox: async () => {
          outboxStarts += 1;
          await new Promise(() => {});
        },
        process_account_anonymizations: async () => {},
        relay_exports: async () => {
          exportStarts += 1;
          await new Promise(() => {});
        },
        cleanup_import_files: async () => {},
      },
    },
  );
  relay.start();
  await delay(115);
  await relay.onModuleDestroy();

  assert.ok(reconciles >= 5, `critical reconcile only ran ${reconciles} times`);
  assert.equal(
    outboxStarts,
    1,
    'timed-out provider must have one live invocation',
  );
  assert.equal(
    exportStarts,
    1,
    'timed-out export must have one live invocation',
  );
  const metrics = renderPrometheusText();
  assert.match(
    metrics,
    /worker_job_runs_total\{job_class="relay_outbox",result="timeout"\} 1/,
  );
  assert.match(
    metrics,
    /worker_job_runs_total\{job_class="relay_exports",result="timeout"\} 1/,
  );
  assert.match(
    metrics,
    /worker_job_runs_total\{job_class="reconcile_pending_redemptions",result="ok"\}/,
  );
  console.info(
    JSON.stringify({
      event: 'worker_budget_fault_sample',
      windowMs: 115,
      reconciles,
      outboxStarts,
      exportStarts,
      environment: 'local_synthetic',
    }),
  );
});

test('shutdown drains a finishing action and prevents new claims', async () => {
  let outboxStarts = 0;
  let resolveOutbox;
  const outboxDone = new Promise((resolve) => {
    resolveOutbox = resolve;
  });
  const relay = new WorkerRelay(
    { $queryRaw: async () => [], $disconnect: async () => {} },
    {
      sendTicketIssued: async () => ({
        providerRef: 'fixture',
        providerStatus: 'ACCEPTED',
      }),
    },
    undefined,
    'shutdown-fixture',
    false,
    10,
    'test-key-material-12345',
    { NODE_ENV: 'test' },
    {
      shutdownTickTimeoutMs: 200,
      testActions: {
        reconcile_pending_redemptions: async () => {},
        relay_outbox: async () => {
          outboxStarts += 1;
          await outboxDone;
        },
        process_account_anonymizations: async () => {},
      },
    },
  );
  relay.start();
  await delay(20);
  const shutdown = relay.onModuleDestroy();
  await delay(20);
  assert.equal(outboxStarts, 1);
  resolveOutbox();
  await shutdown;
  await delay(25);
  assert.equal(outboxStarts, 1, 'shutdown must not schedule another claim');
});

test('queue alert emits only aggregate job fields', async () => {
  const lines = [];
  const originalInfo = console.info;
  const originalWarn = console.warn;
  console.info = (line) => {
    lines.push(String(line));
  };
  console.warn = (line) => {
    lines.push(String(line));
  };
  const relay = new WorkerRelay(
    {
      $queryRaw: async () => [
        {
          job_class: 'relay_outbox',
          oldest_due_age_seconds: 61,
          due_count: 2,
          reclaim_count: 1n,
          tenant_id: 'private-tenant',
          token: 'private-token',
        },
      ],
      $disconnect: async () => {},
    },
    {
      sendTicketIssued: async () => ({
        providerRef: 'fixture',
        providerStatus: 'ACCEPTED',
      }),
    },
    undefined,
    'alert-fixture',
    false,
    20,
    'test-key-material-12345',
    { NODE_ENV: 'test' },
    {
      testActions: {
        reconcile_pending_redemptions: async () => {},
        relay_outbox: async () => {},
        process_account_anonymizations: async () => {},
      },
    },
  );
  try {
    relay.start();
    await delay(25);
    await relay.onModuleDestroy();
  } finally {
    console.info = originalInfo;
    console.warn = originalWarn;
  }
  assert.ok(lines.some((line) => line.includes('job_due_age_budget_exceeded')));
  assert.ok(lines.some((line) => line.includes('"reclaimCount":1')));
  assert.ok(
    lines.every(
      (line) =>
        !line.includes('private-tenant') && !line.includes('private-token'),
    ),
  );
});
