const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createWorker, WorkerRelay } = require('../dist');

function mockDb() {
  return { $disconnect: async () => {} };
}

test('worker shutdown waits for in-flight poll cycle', async () => {
  const app = await createWorker(
    {
      NODE_ENV: 'test',
      WORKER_TEST_TICK_DELAY_MS: '200',
      pollMs: 0,
      shutdownTickTimeoutMs: 5000,
      logging: false,
      database: mockDb(),
    },
    false,
  );
  const relay = app.relay;
  assert.ok(relay);
  assert.equal(relay.isTickInFlight(), false);
  const cycle = relay.runPollCycle();
  assert.equal(relay.isTickInFlight(), true);
  await app.close();
  await cycle;
  assert.equal(relay.isTickInFlight(), false);
});

test('reentrant poll cycle is skipped while tick runs', async () => {
  const app = await createWorker(
    {
      NODE_ENV: 'test',
      WORKER_TEST_TICK_DELAY_MS: '100',
      pollMs: 0,
      logging: false,
      database: mockDb(),
    },
    false,
  );
  const relay = app.relay;
  const first = relay.runPollCycle();
  assert.equal(relay.isTickInFlight(), true);
  await relay.runPollCycle();
  assert.equal(relay.isTickInFlight(), true);
  await first;
  await app.close();
});

test('shutdown caps disconnect inside the same deadline', async () => {
  const relay = new WorkerRelay(
    { $disconnect: () => new Promise(() => {}) },
    { sendTicketIssued: async () => ({ providerRef: 'fixture', providerStatus: 'ACCEPTED' }) },
    undefined, 'shutdown-cap', true, 0, 'fixture-key-material-12345',
    { NODE_ENV: 'test' }, { shutdownTickTimeoutMs: 40 },
  );
  const started = performance.now();
  await relay.onModuleDestroy();
  assert.ok(performance.now() - started < 250, 'disconnect cannot extend shutdown indefinitely');
});
