const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createWorker } = require('../dist');
test('AR891-T3-F03: invalid APNS_ENABLED fails before worker starts', async () => {
  for (const value of ['tru', 'enabled', 'maybe', '2']) {
    let dbCalls = 0;
    await assert.rejects(
      () => createWorker({
        env: { NODE_ENV: 'test', APNS_ENABLED: value },
        database: { $queryRaw() { dbCalls += 1; } },
        relayOnceOnStart: true,
        pollMs: 0,
        logging: false,
      }),
      /APNS_ENABLED/i,
    );
    assert.equal(dbCalls, 0, 'invalid config must not claim or complete outbox');
  }
});

test('AR891-T3-F03: intentional APNs disabled values boot', async () => {
  for (const value of [undefined, 'false', '0', 'no']) {
    const env = { NODE_ENV: 'test' };
    if (value !== undefined) env.APNS_ENABLED = value;
    const app = await createWorker(env, false);
    await app.close();
  }
});
test('worker context boots and closes without processors', async () => {
  const app = await createWorker({ NODE_ENV: 'test' }, false);
  await app.close();
  await assert.rejects(createWorker({ NODE_ENV: 'invalid' }, false));
});

test(
  'worker process handles SIGTERM and exits',
  { timeout: 15000 },
  async () => {
    const { spawn } = require('node:child_process');
    const { once } = require('node:events');
    const child = spawn(process.execPath, ['dist/main.js'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test' },
    });
    const killChild = () => {
      if (child.exitCode === null && child.signalCode === null) {
        try {
          child.kill('SIGKILL');
        } catch {
          /* ignore */
        }
      }
    };
    try {
      const exit = once(child, 'exit');
      await new Promise((resolve, reject) => {
        let output = '';
        const onData = (chunk) => {
          output += chunk;
          // Match current main.ts banner (not legacy "outbox relay polling").
          if (
            output.includes('outbox email relay') ||
            output.includes('outbox relay polling')
          ) {
            resolve();
          }
        };
        child.stdout.on('data', onData);
        child.stderr.on('data', onData);
        child.once('error', reject);
        child.once('exit', () =>
          reject(new Error('Worker exited before idle')),
        );
      });
      child.kill('SIGTERM');
      const [code, signal] = await exit;
      assert.ok(code === 0 || signal === 'SIGTERM');
    } finally {
      killChild();
    }
  },
);
