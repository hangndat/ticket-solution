const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_TICK_STEP_TIMEOUT_MS,
  resolveTickStepTimeoutMs,
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

test('resolveTickStepTimeoutMs falls back to 120s for invalid env', () => {
  assert.equal(resolveTickStepTimeoutMs('0'), DEFAULT_TICK_STEP_TIMEOUT_MS);
  assert.equal(resolveTickStepTimeoutMs('-1'), DEFAULT_TICK_STEP_TIMEOUT_MS);
  assert.equal(resolveTickStepTimeoutMs(''), DEFAULT_TICK_STEP_TIMEOUT_MS);
  assert.equal(resolveTickStepTimeoutMs('not-a-number'), DEFAULT_TICK_STEP_TIMEOUT_MS);
  assert.equal(resolveTickStepTimeoutMs(undefined), DEFAULT_TICK_STEP_TIMEOUT_MS);
});

test('resolveTickStepTimeoutMs prefers option over env', () => {
  assert.equal(resolveTickStepTimeoutMs('5000', 200), 200);
  assert.equal(resolveTickStepTimeoutMs('0', 200), 200);
});

test('resolveTickStepTimeoutMs uses valid env when no option', () => {
  assert.equal(resolveTickStepTimeoutMs('30000'), 30_000);
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
