const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { once } = require('node:events');
const {
  deleteObject,
  createMemoryObjectStore,
} = require('../dist/minio.js');
const { CONFIG_ERROR_CODES } = require('../dist/config-error.js');

const fixtureCfg = (port) => ({
  endpoint: `http://127.0.0.1:${port}`,
  accessKey: 'fixture-access',
  secretKey: 'fixture-secret',
  bucket: 'ticket-exports',
  region: 'us-east-1',
});

test('deleteObject rejects empty and unsafe keys before HTTP', async () => {
  const badKeys = ['', '   ', '/exports/a.csv', 'a\\b', 'a/../b', './x'];
  for (const key of badKeys) {
    await assert.rejects(
      () => deleteObject(fixtureCfg(1), key),
      (err) => err && err.code === CONFIG_ERROR_CODES.ASSET_INVALID,
    );
  }
});

test('deleteObject treats HTTP 404 as idempotent success', async () => {
  const server = createServer((_req, res) => {
    res.writeHead(404);
    res.end('not found');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await deleteObject(
      fixtureCfg(server.address().port),
      'exports/tenant/event/missing.csv',
    );
  } finally {
    server.close();
  }
});

test('deleteObject sends SigV4 DELETE to the exact encoded key path', async () => {
  let seen;
  const server = createServer((req, res) => {
    seen = {
      method: req.method,
      path: req.url,
      hasAuth: Boolean(req.headers.authorization),
    };
    res.writeHead(204);
    res.end();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const key = 'exports/tenant-1/event-2/file.csv';
  try {
    await deleteObject(fixtureCfg(server.address().port), key);
    assert.equal(seen.method, 'DELETE');
    assert.equal(
      seen.path,
      `/ticket-exports/${key.split('/').map(encodeURIComponent).join('/')}`,
    );
    assert.ok(seen.hasAuth);
    assert.doesNotMatch(String(seen.path), /fixture-secret/);
  } finally {
    server.close();
  }
});

test('deleteObject rejects non-404 HTTP errors', async () => {
  const server = createServer((_req, res) => {
    res.writeHead(403);
    res.end('denied');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await assert.rejects(() =>
      deleteObject(
        fixtureCfg(server.address().port),
        'exports/tenant/event/file.csv',
      ),
    );
  } finally {
    server.close();
  }
});

test('memory ObjectStore deleteObject is idempotent', async () => {
  const store = createMemoryObjectStore();
  const key = 'imports/quarantine/sample.csv';
  await store.putObject(key, Buffer.from('a,b\n'), 'text/csv');
  await store.deleteObject(key);
  await store.deleteObject(key);
  await assert.rejects(() => store.getObject(key));
});
