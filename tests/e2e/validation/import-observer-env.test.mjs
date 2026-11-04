import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { startProcess } from '../harness/runtime.mjs';

test('observer credentials cannot reach app, build or unrelated child processes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'e2e-observer-test-'));
  const state = { dir, children: [] };
  const observer = {
    E2E_MINIO_OBSERVER_ACCESS_KEY: 'synthetic-access',
    E2E_MINIO_OBSERVER_SECRET_KEY: 'synthetic-secret',
  };
  const script =
    "process.stdout.write(String('E2E_MINIO_OBSERVER_ACCESS_KEY' in process.env) + ':' + String('E2E_MINIO_OBSERVER_SECRET_KEY' in process.env))";
  try {
    for (const name of [
      'api',
      'worker',
      'web',
      'portal',
      'web-build',
      'portal-build',
      'oidc-preflight',
      'fault-portal',
      'short-web',
      'http-SEC-01',
    ]) {
      assert.throws(
        () =>
          startProcess(state, name, process.execPath, ['-e', script], observer),
        /observer credentials forbidden/,
      );
      const child = startProcess(
        state,
        name,
        process.execPath,
        ['-e', script],
        { PATH: process.env.PATH },
      );
      const [code] = await once(child, 'exit');
      assert.equal(code, 0);
      assert.equal(
        readFileSync(join(dir, `${name}.log`), 'utf8'),
        'false:false',
      );
    }
    for (const name of ['http-SEC-05', 'browser-tests']) {
      const child = startProcess(
        state,
        name,
        process.execPath,
        ['-e', script],
        { PATH: process.env.PATH, ...observer },
      );
      const [code] = await once(child, 'exit');
      assert.equal(code, 0);
      assert.equal(readFileSync(join(dir, `${name}.log`), 'utf8'), 'true:true');
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
