const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createWorker } = require('../dist');
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
