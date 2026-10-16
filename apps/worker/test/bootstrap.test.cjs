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
  { timeout: 10000 },
  async () => {
    const { spawn } = require('node:child_process');
    const { once } = require('node:events');
    const child = spawn(process.execPath, ['dist/main.js'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    try {
      const exit = once(child, 'exit');
      await new Promise((resolve, reject) => {
        let output = '';
        child.stdout.on('data', (chunk) => {
          output += chunk;
          if (output.includes('no job processors registered')) resolve();
        });
        child.once('error', reject);
        child.once('exit', () =>
          reject(new Error('Worker exited before idle')),
        );
      });
      child.kill('SIGTERM');
      const [code, signal] = await exit;
      assert.ok(code === 0 || signal === 'SIGTERM');
    } finally {
      if (child.exitCode === null && child.signalCode === null)
        child.kill('SIGKILL');
    }
  },
);
