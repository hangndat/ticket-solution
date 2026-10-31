'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createServer } = require('node:http');
const { once } = require('node:events');
const { processExportJob, relayExportsOnce, exportWritesPaused } = require('../dist/export');

test('export pre-PUT recheck rejects a fence raised after CSV preparation', async () => {
  const tenantId = randomUUID();
  const eventId = randomUUID();
  const exportId = randomUUID();
  let eventReads = 0;
  const writes = [];
  const tx = {
    $queryRaw: async (parts) => {
      const sql = parts.join('?');
      if (sql.includes("set_config('app.tenant_id'") ||
          sql.includes("set_config('statement_timeout'")) return [];
      if (sql.includes('SELECT event_id FROM exports')) return [{ event_id: eventId }];
      if (sql.includes('SELECT export_retention_fenced_at IS NULL')) {
        eventReads += 1;
        return [{ allowed: eventReads === 1 }];
      }
      if (sql.includes('SELECT id, event_id, status, filter, lease_owner')) {
        return [{ id: exportId, event_id: eventId, status: 'PENDING',
          filter: {}, lease_owner: null }];
      }
      if (sql.includes('FROM tickets t')) return [];
      if (sql.includes('SELECT status, lease_owner FROM exports')) {
        return [{ status: 'PROCESSING', lease_owner: null }];
      }
      throw new Error('Unexpected query: ' + sql);
    },
    $executeRaw: async (parts) => { writes.push(parts.join('?')); return 1; },
  };
  const db = { $transaction: async (operation) => operation(tx) };
  await processExportJob(db, {
    endpoint: 'http://127.0.0.1:1', accessKey: 'fixture', secretKey: 'fixture',
    bucket: 'fixture', region: 'us-east-1',
  }, tenantId, exportId, 3600);
  assert.equal(eventReads, 2);
  assert.equal(writes.filter((sql) => sql.includes("status = 'FAILED'")).length, 1);
  assert.ok(writes.some((sql) => sql.includes("error_code = 'EXPORT_EXPIRED'")));
});

test('pause closes worker claim without reading the disabled export identity', async () => {
  assert.equal(exportWritesPaused({ EXPORT_WRITES_PAUSED: '1' }), true);
  assert.deepEqual(await relayExportsOnce({ $queryRaw: () => { throw Error('claimed'); } },
    { EXPORT_WRITES_PAUSED: '1' }, 'worker-a'),
  { claimed: 0, completed: 0, failed: 0 });
});

test('reclaim between preparation and PUT rejects the stale lease owner', async () => {
  const tenantId = randomUUID();
  const eventId = randomUUID();
  const exportId = randomUUID();
  let leaseOwner = 'worker-a';
  let transactions = 0;
  let readyWrites = 0;
  const tx = {
    $queryRaw: async (parts) => {
      const sql = parts.join('?');
      if (sql.includes('set_config(')) return [];
      if (sql.includes('SELECT event_id FROM exports')) return [{ event_id: eventId }];
      if (sql.includes('SELECT export_retention_fenced_at IS NULL')) return [{ allowed: true }];
      if (sql.includes('SELECT id, event_id, status, filter, lease_owner')) {
        return [{ id: exportId, event_id: eventId, status: 'PROCESSING',
          filter: {}, lease_owner: leaseOwner }];
      }
      if (sql.includes('FROM tickets t')) return [];
      if (sql.includes('SELECT status, lease_owner FROM exports')) {
        return [{ status: 'PROCESSING', lease_owner: leaseOwner }];
      }
      throw Error('Unexpected query: ' + sql);
    },
    $executeRaw: async (parts) => {
      if (parts.join('?').includes('set_config(')) return 1;
      readyWrites++;
      return 1;
    },
  };
  const db = { $transaction: async (operation) => {
    const result = await operation(tx);
    if (++transactions === 1) leaseOwner = 'worker-b';
    return result;
  } };
  await processExportJob(db, { endpoint: 'http://127.0.0.1:1',
    accessKey: 'fixture', secretKey: 'fixture', bucket: 'fixture', region: 'us-east-1' },
  tenantId, exportId, 3600, 'worker-a');
  assert.equal(transactions, 2);
  assert.equal(readyWrites, 0, 'stale worker cannot issue PUT or READY update');
});

test('server failure after body leaves an orphan for offline reconciliation, not READY',
  { timeout: 10000 }, async () => {
    const tenantId = randomUUID();
    const eventId = randomUUID();
    const exportId = randomUUID();
    let bytesReceived = 0;
    let status = 'PROCESSING';
    const server = createServer((req, res) => {
      req.on('data', (chunk) => { bytesReceived += chunk.length; });
      req.on('end', () => { res.writeHead(500); res.end(); });
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
      const tx = {
        $queryRaw: async (parts) => {
          const sql = parts.join('?');
          if (sql.includes('set_config(')) return [];
          if (sql.includes('SELECT event_id FROM exports')) return [{ event_id: eventId }];
          if (sql.includes('SELECT export_retention_fenced_at IS NULL')) return [{ allowed: true }];
          if (sql.includes('SELECT id, event_id, status, filter, lease_owner')) {
            return [{ id: exportId, event_id: eventId, status,
              filter: {}, lease_owner: 'worker-a' }];
          }
          if (sql.includes('FROM tickets t')) return [];
          if (sql.includes('SELECT status, lease_owner FROM exports')) {
            return [{ status, lease_owner: 'worker-a' }];
          }
          throw Error('Unexpected query: ' + sql);
        },
        $executeRaw: async (parts) => {
          const sql = parts.join('?');
          if (sql.includes('set_config(')) return 1;
          if (sql.includes("SET status = 'FAILED'")) status = 'FAILED';
          else if (sql.includes("SET status = 'READY'")) status = 'READY';
          else throw Error('Unexpected write: ' + sql);
          return 1;
        },
      };
      await processExportJob({ $transaction: (operation) => operation(tx) },
        { endpoint: `http://127.0.0.1:${server.address().port}`,
          accessKey: 'fixture', secretKey: 'fixture', bucket: 'fixture', region: 'us-east-1' },
        tenantId, exportId, 3600, 'worker-a');
      assert.ok(bytesReceived > 0, 'MinIO could have committed the body');
      assert.equal(status, 'FAILED');
    } finally { server.closeAllConnections(); server.close(); }
  });

test('two workers and fence serialize across partial PUT, READY commit and retry',
  { timeout: 10000 }, async () => {
    const tenantId = randomUUID();
    const eventId = randomUUID();
    const exportId = randomUUID();
    const state = { status: 'PENDING', leaseOwner: null, fenced: false, purgedAt: null };
    let tail = Promise.resolve();
    let activeTransactions = 0;
    let puts = 0;
    let partial;
    const sawPartial = new Promise((resolve) => { partial = resolve; });
    let release;
    const mayFinish = new Promise((resolve) => { release = resolve; });
    const server = createServer((req, res) => {
      puts++;
      req.on('end', () => res.end());
      req.once('data', () => {
        req.pause();
        partial();
        void mayFinish.then(() => req.resume());
      });
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
      const tx = {
        $queryRaw: async (parts) => {
          const sql = parts.join('?');
          if (sql.includes('set_config(')) return [];
          if (sql.includes('SELECT event_id FROM exports')) return [{ event_id: eventId }];
          if (sql.includes('SELECT export_retention_fenced_at IS NULL')) {
            return [{ allowed: !state.fenced }];
          }
          if (sql.includes('SELECT id, event_id, status, filter, lease_owner')) {
            return [{ id: exportId, event_id: eventId, status: state.status,
              filter: {}, lease_owner: state.leaseOwner }];
          }
          if (sql.includes('FROM tickets t')) return [];
          if (sql.includes('SELECT status, lease_owner FROM exports')) {
            return [{ status: state.status, lease_owner: state.leaseOwner }];
          }
          throw Error('Unexpected query: ' + sql);
        },
        $executeRaw: async (parts, ...values) => {
          const sql = parts.join('?');
          if (sql.includes("set_config('statement_timeout'")) return 1;
          if (sql.includes("SET status = 'READY'")) {
            state.status = 'READY';
            state.leaseOwner = null;
          } else if (sql.includes("SET status = 'PROCESSING'")) {
            state.status = 'PROCESSING';
            state.leaseOwner = values.find((v) => v === 'worker-a') ?? null;
          } else if (sql.includes("SET status = 'FAILED'")) {
            state.status = 'FAILED';
          } else throw Error('Unexpected write: ' + sql);
          return 1;
        },
      };
      const db = { $transaction: async (operation) => {
        const previous = tail;
        let unlock;
        tail = new Promise((resolve) => { unlock = resolve; });
        await previous;
        activeTransactions++;
        try { return await operation(tx); }
        finally { activeTransactions--; unlock(); }
      } };
      const minio = { endpoint: `http://127.0.0.1:${server.address().port}`,
        accessKey: 'fixture', secretKey: 'fixture', bucket: 'fixture', region: 'us-east-1' };
      const first = processExportJob(db, minio, tenantId, exportId, 3600, 'worker-a');
      await Promise.race([sawPartial, first.then(() => { throw Error('PUT did not start'); })]);
      assert.equal(activeTransactions, 1, 'event row remains locked while PUT is in flight');
      const second = processExportJob(db, minio, tenantId, exportId, 3600, 'worker-b');
      const fence = db.$transaction(async () => { state.fenced = true; state.purgedAt = new Date(); });
      assert.equal(state.fenced, false, 'fence cannot pass the in-flight PUT');
      release();
      await Promise.all([first, second, fence]);
      assert.equal(state.status, 'READY');
      assert.equal(puts, 1);
      await processExportJob(db, minio, tenantId, exportId, 3600, 'worker-a');
      assert.equal(puts, 1, 'post-commit stale retry cannot PUT after purge');
      assert.ok(state.purgedAt);
    } finally { release(); server.closeAllConnections(); server.close(); }
  });
