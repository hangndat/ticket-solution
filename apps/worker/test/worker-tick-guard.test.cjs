const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  createTickGuard,
  waitForInflightTick,
} = require('../dist');

test('tick guard skips reentrant calls while in flight', async () => {
  let stopped = false;
  const guard = createTickGuard(() => stopped);
  let depth = 0;
  let maxDepth = 0;
  const body = async () => {
    depth += 1;
    maxDepth = Math.max(maxDepth, depth);
    await new Promise((r) => setTimeout(r, 50));
    depth -= 1;
  };

  const [first, second] = await Promise.all([
    guard.run(body),
    guard.run(body),
  ]);

  assert.equal(first.ran, true);
  assert.equal(second.ran, false);
  assert.equal(second.reason, 'reentrant');
  assert.equal(maxDepth, 1);
  assert.equal(guard.isTickInFlight(), false);
});

test('waitForInflightTick completes when tick finishes', async () => {
  let stopped = false;
  const guard = createTickGuard(() => stopped);
  const started = guard.run(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
  assert.equal(guard.isTickInFlight(), true);
  const outcome = await waitForInflightTick(
    () => guard.getInflightTick(),
    5000,
  );
  await started;
  assert.equal(outcome, 'completed');
});

test('waitForInflightTick times out when tick hangs', async () => {
  let stopped = false;
  const guard = createTickGuard(() => stopped);
  void guard.run(async () => {
    await new Promise((r) => setTimeout(r, 500));
  });
  const outcome = await waitForInflightTick(
    () => guard.getInflightTick(),
    20,
  );
  assert.equal(outcome, 'timed_out');
});
