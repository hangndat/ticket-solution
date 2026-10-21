const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  runStepWithTimeout,
  TickStepTimeoutError,
} = require('../dist');

test('runStepWithTimeout resolves when action finishes in time', async () => {
  const value = await runStepWithTimeout(
    'relay_outbox',
    200,
    async () => {
      await new Promise((r) => setTimeout(r, 10));
      return 42;
    },
  );
  assert.equal(value, 42);
});

test('runStepWithTimeout rejects when action exceeds limit', async () => {
  await assert.rejects(
    () =>
      runStepWithTimeout('relay_outbox', 25, async () => {
        await new Promise((r) => setTimeout(r, 200));
      }),
    (error) => {
      assert.ok(error instanceof TickStepTimeoutError);
      assert.equal(error.step, 'relay_outbox');
      assert.equal(error.timeoutMs, 25);
      return true;
    },
  );
});
