'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { processExportJob } = require('../dist/export');

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
