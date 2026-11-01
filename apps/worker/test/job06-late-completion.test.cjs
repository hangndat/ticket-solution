const { test } = require('node:test');
const assert = require('node:assert/strict');
const { WorkerRelay } = require('../dist/worker-relay');

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function relayWith(testActions) {
  return new WorkerRelay(
    { $queryRaw: async () => [], $disconnect: async () => {} },
    {
      sendTicketIssued: async () => {
        throw new Error('unexpected SMTP');
      },
    },
    undefined,
    'job06-late-completion',
    false,
    0,
    'test-key-material-12345',
    { NODE_ENV: 'test' },
    {
      tickStepTimeoutMs: 10,
      shutdownTickTimeoutMs: 1000,
      testActions: {
        reconcile_pending_redemptions: async () => {},
        relay_outbox: async () => {},
        process_account_anonymizations: async () => {},
        process_ticket_pii_anonymizations: async () => {},
        ...testActions,
      },
    },
  );
}

test('[JOB-06] timed-out action is skipped until late completion, then can run again', async () => {
  const finish = deferred();
  let starts = 0;
  let active = 0;
  let maxActive = 0;
  const relay = relayWith({
    relay_outbox: async () => {
      starts += 1;
      active += 1;
      maxActive = Math.max(maxActive, active);
      try {
        if (starts === 1) await finish.promise;
      } finally {
        active -= 1;
      }
    },
  });
  try {
    await relay.runPollCycle(); // actual timeout; underlying action remains live
    assert.equal(active, 1);
    await relay.runPollCycle();
    assert.equal(starts, 1, 'timeout must not release the overlap guard');
    finish.resolve();
    await new Promise(setImmediate); // settle the action and its guard cleanup
    await relay.runPollCycle();
    assert.equal(starts, 2, 'late completion must release the overlap guard');
    assert.equal(active, 0);
    assert.equal(maxActive, 1);
  } finally {
    finish.resolve();
    await relay.onModuleDestroy();
  }
});

test('[JOB-06] shutdown during maintenance drains the action and skips later steps', async () => {
  const entered = deferred();
  const finish = deferred();
  let laterStarts = 0;
  const relay = relayWith({
    process_account_anonymizations: async () => {
      entered.resolve();
      await finish.promise;
    },
    process_ticket_pii_anonymizations: async () => {
      laterStarts += 1;
    },
  });
  const cycle = relay.runPollCycle();
  try {
    await entered.promise;
    const shutdown = relay.onModuleDestroy(); // sets stopped synchronously
    finish.resolve();
    await Promise.all([cycle, shutdown]);
    await relay.runPollCycle();
    assert.equal(
      laterStarts,
      0,
      'shutdown must prevent subsequent work in the same cycle',
    );
  } finally {
    finish.resolve();
    await cycle;
    await relay.onModuleDestroy();
  }
});
