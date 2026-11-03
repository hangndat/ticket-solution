import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { withIdpDeleteFault } from '../harness/idp-fault.mjs';

test('IdP fault is restored on assertion failure without losing other controls', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'auth08-fault-'));
  const path = join(dir, 'control.json');
  const failure = new Error('original assertion');
  try {
    writeFileSync(
      path,
      JSON.stringify({ routes: {}, idpDelete: { mode: 'previous' } }),
    );
    await assert.rejects(
      withIdpDeleteFault(path, { mode: 'unavailable' }, async () => {
        const current = JSON.parse(readFileSync(path, 'utf8'));
        assert.equal(current.idpDelete.mode, 'unavailable');
        current.routes.keep = 'changed';
        writeFileSync(path, JSON.stringify(current));
        throw failure;
      }),
      (error) => error === failure,
    );
    assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), {
      routes: { keep: 'changed' },
      idpDelete: { mode: 'previous' },
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('cleanup errors do not replace the original failure, but fail a successful action', async () => {
  const failure = new Error('original assertion');
  const cleanup = new Error('cleanup failed');
  let writes = 0;
  let reported = false;
  const options = {
    read: () => '{}',
    write: () => {
      if (++writes === 2) throw cleanup;
    },
    onCleanupError: () => {
      reported = true;
      throw new Error('diagnostic failed');
    },
  };
  await assert.rejects(
    withIdpDeleteFault(
      'unused',
      {},
      async () => {
        throw failure;
      },
      options,
    ),
    (error) => error === failure,
  );
  assert.equal(reported, true);
  writes = 0;
  await assert.rejects(
    withIdpDeleteFault('unused', {}, async () => {}, options),
    (error) => error === cleanup,
  );
});

test('IdP fault is removed after a successful action when initially absent', async () => {
  let content = '{"routes":{}}';
  const value = await withIdpDeleteFault(
    'unused',
    { mode: 'unavailable' },
    async () => 42,
    {
      read: () => content,
      write: (_path, data) => {
        content = data;
      },
    },
  );
  assert.equal(value, 42);
  assert.deepEqual(JSON.parse(content), { routes: {} });
});
