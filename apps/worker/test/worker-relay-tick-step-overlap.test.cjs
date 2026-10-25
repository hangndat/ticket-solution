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

function captureConsoleWarn() {
  const lines = [];
  const original = console.warn;
  console.warn = (...args) => {
    lines.push(args.join(' '));
    original.apply(console, args);
  };
  return {
    lines,
    restore() {
      console.warn = original;
    },
  };
}

test('overlapping tick skips step still running after timeout', async () => {
  const errorLogs = captureConsoleError();
  const warnLogs = captureConsoleWarn();
  const app = await createWorker(
    {
      env: {
        NODE_ENV: 'test',
        WORKER_TEST_HANG_TICK_STEP: 'reconcile_pending_redemptions',
      },
      tickStepTimeoutMs: 40,
      shutdownTickTimeoutMs: 30,
      pollMs: 0,
      logging: false,
      database: mockDb(),
    },
    false,
  );
  const relay = app.relay;
  await relay.runPollCycle();

  const timeoutCountAfterFirst = errorLogs.lines.filter((line) =>
    line.includes('"event":"tick_step_timeout"'),
  ).length;
  assert.equal(timeoutCountAfterFirst, 1);

  await relay.runPollCycle();

  errorLogs.restore();
  warnLogs.restore();

  const timeoutCountAfterSecond = errorLogs.lines.filter((line) =>
    line.includes('"event":"tick_step_timeout"'),
  ).length;
  assert.equal(
    timeoutCountAfterSecond,
    1,
    'second cycle must not start another timed-out hang for the same step',
  );

  const stillRunningLog = warnLogs.lines.find((line) =>
    line.includes('"event":"tick_step_still_running"'),
  );
  assert.ok(stillRunningLog, 'expected tick_step_still_running on second cycle');
  assert.ok(stillRunningLog.includes('"step":"reconcile_pending_redemptions"'));

  await app.close();
});
