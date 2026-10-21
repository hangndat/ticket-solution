const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createWorker } = require('../dist');

function mockDb() {
  return { $disconnect: async () => {} };
}

function captureConsoleError() {
  const lines = [];
  const original = console.error;
  console.error = (...args) => {
    lines.push(args.join(' '));
    original.apply(console, args);
  };
  return {
    lines,
    restore() {
      console.error = original;
    },
  };
}

function captureConsoleInfo() {
  const lines = [];
  const original = console.info;
  console.info = (...args) => {
    lines.push(args.join(' '));
    original.apply(console, args);
  };
  return {
    lines,
    restore() {
      console.info = original;
    },
  };
}

test('hung tick step times out and poll cycle completes', async () => {
  const logs = captureConsoleError();
  const started = Date.now();
  const app = await createWorker(
    {
      env: {
        NODE_ENV: 'test',
        WORKER_TEST_HANG_TICK_STEP: 'reconcile_pending_redemptions',
      },
      tickStepTimeoutMs: 40,
      pollMs: 0,
      logging: false,
      database: mockDb(),
    },
    false,
  );
  const relay = app.relay;
  await relay.runPollCycle();
  logs.restore();

  const elapsed = Date.now() - started;
  assert.ok(elapsed < 500, `expected fast completion, took ${elapsed}ms`);
  assert.equal(relay.isTickInFlight(), false);
  const timeoutLog = logs.lines.find((line) =>
    line.includes('"event":"tick_step_timeout"'),
  );
  assert.ok(timeoutLog, 'expected tick_step_timeout log');
  assert.ok(timeoutLog.includes('"step":"reconcile_pending_redemptions"'));
  await app.close();
});

test('worker shutdown times out waiting for long tick', async () => {
  const infoLogs = captureConsoleInfo();
  const app = await createWorker(
    {
      env: {
        NODE_ENV: 'test',
        WORKER_TEST_TICK_DELAY_MS: '500',
      },
      pollMs: 0,
      shutdownTickTimeoutMs: 30,
      logging: false,
      database: mockDb(),
    },
    false,
  );
  const relay = app.relay;
  void relay.runPollCycle();
  assert.equal(relay.isTickInFlight(), true);
  await app.close();
  infoLogs.restore();

  const shutdownLog = infoLogs.lines.find((line) =>
    line.includes('"event":"shutdown_tick_wait"'),
  );
  assert.ok(shutdownLog, 'expected shutdown_tick_wait log');
  assert.ok(shutdownLog.includes('"outcome":"timed_out"'));
});
