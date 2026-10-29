'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { mkdtemp, writeFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { parseArgs, validateEvidence, parseListing, purgeEvent, s3Client, checkDueEvents } = require('../scripts/o06-offline-purge.cjs');

const tenantId = '11111111-1111-4111-8111-111111111111';
const eventId = '22222222-2222-4222-8222-222222222222';
const generation = '33333333-3333-4333-8333-333333333333';
const prefix = `exports/${tenantId}/${eventId}/`;
const evidence = () => ({
  tenantId, eventId, generation,
  writerIdentityDisabled: true, writerRestartInhibited: true,
  operationsToolsStopped: true, minioRestartedSameVolumes: true,
  writerIdentityDisableProof: 'credential-disable-receipt',
  writerRestartInhibitProof: 'supervisor-mask-receipt',
  operationsToolsStopProof: 'ops-process-scan-receipt',
  sameVolumesRestartProof: 'volume-mount-and-boot-receipt',
  writerIdentityDisabledAt: '2026-10-29T06:00:30Z',
  minioRestartedAt: '2026-10-29T06:02:00Z',
  observedAt: '2026-10-29T06:03:00Z',
  expectedWriterIds: ['api-1', 'worker-1'],
  writers: [
    { id: 'api-1', role: 'api', pid: 101, exitConfirmed: true, exitedAt: '2026-10-29T06:00:00Z', proof: 'process-exit-api-101' },
    { id: 'worker-1', role: 'worker', pid: 102, exitConfirmed: true, exitedAt: '2026-10-29T06:00:00Z', proof: 'process-exit-worker-102' },
  ],
  expectedMinioNodeIds: ['minio-1', 'minio-2'],
  minioNodes: [
    { id: 'minio-1', pid: 201, exitConfirmed: true, exitedAt: '2026-10-29T06:01:00Z', proof: 'process-exit-minio-201' },
    { id: 'minio-2', pid: 202, exitConfirmed: true, exitedAt: '2026-10-29T06:01:00Z', proof: 'process-exit-minio-202' },
  ],
});

function dbMock({ count = 1, status = { matched: true, fenced: true, inventoryRecorded: false,
  unpurgedCount: 1, activeLeaseCount: 0 }, finalStatus = status } = {}) {
  const queries = [];
  return { queries, async query(sql, args) {
    queries.push({ sql, args });
    if (sql.startsWith('SELECT pg_try_advisory_lock')) return { rows: [{ locked: true }] };
    if (sql.startsWith('SELECT current_user')) return { rows: [{ role: 'ticket_retention_operator' }] };
    if (sql.includes('fence_export_retention_event')) return { rows: [{ ok: true }] };
    if (sql.includes('record_export_retention_inventory')) return { rows: [{ ok: true }] };
    if (sql.includes('finalize_export_retention_event')) return { rows: [{ count }] };
    if (sql.includes('export_retention_operator_status')) return { rows: [{ status: queries.some((x) =>
      x.sql.includes('finalize_export_retention_event')) ? finalStatus : status }] };
    return { rows: [] };
  } };
}

test('CLI requires explicit stable generation and evidence for purge', () => {
  assert.throws(() => parseArgs(['fence', '--tenant', tenantId, '--event', eventId]), /generation/);
  assert.throws(() => parseArgs(['purge', '--tenant', tenantId, '--event', eventId, '--generation', generation]), /evidence/);
  assert.equal(parseArgs(['fence', '--tenant', tenantId, '--event', eventId, '--generation', generation]).generation, generation);
});
test('daily plan/check pages due events and raises a machine-readable overdue alert', async () => {
 assert.deepEqual(parseArgs(['check', '--limit', '2']), { phase: 'check', pageSize: 2 });
 assert.deepEqual(parseArgs(['plan']), { phase: 'plan', pageSize: 200 });
 assert.throws(() => parseArgs(['check', '--limit', '0']), /Page limit/);
 assert.throws(() => parseArgs(['check', '--tenant', tenantId]), /Unknown/);
 const now = new Date('2026-10-29T12:00:00Z');
 const old = new Date('2026-10-28T12:00:00Z');
 const next = new Date('2026-10-29T18:00:00Z');
 const rows = [
  { tenant_id: tenantId, event_id: eventId, deadline: old,
    deadline_cursor: old.toISOString(), completed: false,
    barrier_generation: null, fenced_at: null, inventory_recorded_at: null,
    unpurged_count: '0' },
  { tenant_id: tenantId, event_id: generation, deadline: next,
    deadline_cursor: next.toISOString(), completed: false,
    barrier_generation: generation, fenced_at: now, inventory_recorded_at: null,
    unpurged_count: '1' },
 ];
 const queries = [];
 const db = { async query(sql, args) {
  queries.push({ sql, args });
  if (sql === 'SELECT current_user AS role') return { rows: [{ role: 'ticket_retention_operator' }] };
  if (sql === 'SELECT transaction_timestamp() AS as_of') return { rows: [{ as_of: now }] };
  if (sql.includes('list_export_retention_due_events')) return { rows: args[2] ? [] : rows };
  return { rows: [] };
 } };
 const emitted = [];
 const summary = await checkDueEvents(db, { pageSize: 2 }, (value) => emitted.push(value));
 assert.deepEqual(summary, { type: 'summary', asOf: now.toISOString(), due: 2,
  pending: 2, overdue: 1, alert: 'O06_EXPORT_RETENTION_OVERDUE' });
 assert.deepEqual(emitted.map((value) => value.type), ['event', 'event', 'summary']);
 assert.equal(emitted[0].unpurgedCount, 0);
 assert.equal(emitted[0].state, 'pending', 'zero export rows still need orphan inventory');
 assert.equal(emitted[0].overdue, true);
 assert.equal(emitted[1].overdue, false);
 assert.ok(queries.some((value) => value.sql === 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'));
 assert.ok(queries.some((value) => value.sql === 'COMMIT'));
 assert.ok(!queries.some((value) => /fence_export|finalize_export|UPDATE|DELETE/.test(value.sql)));
});
test('completed overdue events do not raise alert and operator role is required', async () => {
 const now = new Date('2026-10-29T12:00:00Z');
 const db = { async query(sql) {
  if (sql === 'SELECT current_user AS role') return { rows: [{ role: 'ticket_retention_operator' }] };
  if (sql === 'SELECT transaction_timestamp() AS as_of') return { rows: [{ as_of: now }] };
  if (sql.includes('list_export_retention_due_events')) return { rows: [{
   tenant_id: tenantId, event_id: eventId, deadline: new Date('2026-10-28T12:00:00Z'),
   completed: true, barrier_generation: generation, fenced_at: now,
   inventory_recorded_at: now, unpurged_count: '0',
  }] };
  return { rows: [] };
 } };
 // Page limit exceeds the one row so the scan terminates after one page.
 const output = [];
 const summary = await checkDueEvents(db, { pageSize: 2 }, (value) => output.push(value));
 assert.equal(summary.overdue, 0);
 assert.equal(summary.alert, null);
 assert.equal(output[0].state, 'completed');
 const wrongRole = { async query(sql) { return { rows: sql === 'SELECT current_user AS role'
  ? [{ role: 'ticket_runtime' }] : [] }; } };
 await assert.rejects(checkDueEvents(wrongRole, { pageSize: 2 }, () => {}), /operator DB role/);
});
test('pending day-89 event raises a due alert before day-90 overdue', async () => {
 const now = new Date('2026-10-29T12:00:00Z');
 const db = { async query(sql) {
  if (sql === 'SELECT current_user AS role') return { rows: [{ role: 'ticket_retention_operator' }] };
  if (sql === 'SELECT transaction_timestamp() AS as_of') return { rows: [{ as_of: now }] };
  if (sql.includes('list_export_retention_due_events')) return { rows: [{
   tenant_id: tenantId, event_id: eventId, deadline: new Date('2026-10-30T12:00:00Z'),
   completed: false, barrier_generation: null, fenced_at: null,
   inventory_recorded_at: null, unpurged_count: '0',
  }] };
  return { rows: [] };
 } };
 const summary = await checkDueEvents(db, { pageSize: 2 }, () => {});
 assert.equal(summary.pending, 1);
 assert.equal(summary.overdue, 0);
 assert.equal(summary.alert, 'O06_EXPORT_RETENTION_DUE');
});

test('advisory lock rejects concurrent operator before any fence function call', async () => {
  const db = dbMock();
  const original = db.query;
  db.query = async (sql, args) => sql.startsWith('SELECT pg_try_advisory_lock')
    ? { rows: [{ locked: false }] } : original(sql, args);
  await assert.rejects(purgeEvent(db, null,
    { phase: 'fence', tenantId, eventId, generation }), /Another purge operator/);
  assert.ok(!db.queries.some((x) => x.sql.includes('fence_export_retention_event')));
});

test('positive barrier evidence requires every expected API, worker, and MinIO exit', () => {
  assert.match(validateEvidence(evidence(), tenantId, eventId, generation).writerExitHash, /^[a-f0-9]{64}$/);
  const cases = [
    (x) => { x.writers[0].exitConfirmed = false; },
    (x) => { x.writers.pop(); x.expectedWriterIds.pop(); },
    (x) => { x.minioNodes[1].proof = ''; },
    (x) => { x.expectedMinioNodeIds = ['minio-1', 'unknown']; },
    (x) => { x.writerIdentityDisabled = false; },
    (x) => { x.writerRestartInhibited = false; },
    (x) => { x.operationsToolsStopped = false; },
    (x) => { x.minioRestartedSameVolumes = false; },
    (x) => { x.minioRestartedAt = '2026-10-29T06:00:00Z'; },
  ];
  for (const mutate of cases) {
    const value = evidence(); mutate(value);
    assert.throws(() => validateEvidence(value, tenantId, eventId, generation));
  }
});

test('S3 parser sees orphan currents, older versions, delete markers, and multipart uploads', () => {
  const key = `${prefix}orphan.csv`;
  const objects = `<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Prefix>${prefix}</Prefix><IsTruncated>false</IsTruncated><Contents><Key>${key}</Key></Contents></ListBucketResult>`;
  const versions = `<ListVersionsResult><Prefix>${prefix}</Prefix><IsTruncated>false</IsTruncated><Version><Key>${key}</Key><VersionId>v1</VersionId></Version><DeleteMarker><Key>${key}</Key><VersionId>m1</VersionId></DeleteMarker></ListVersionsResult>`;
  const uploads = `<ListMultipartUploadsResult><Prefix>${prefix}</Prefix><IsTruncated>false</IsTruncated><Upload><Key>${key}</Key><UploadId>u1</UploadId></Upload></ListMultipartUploadsResult>`;
  assert.deepEqual(parseListing(objects, 'objects', prefix).entries, [{ type: 'current', key }]);
  assert.deepEqual(parseListing(versions, 'versions', prefix).entries.map((x) => x.type), ['version', 'marker']);
  assert.deepEqual(parseListing(uploads, 'uploads', prefix).entries, [{ type: 'upload', key, uploadId: 'u1' }]);
  assert.throws(() => parseListing(objects.replace(key, 'exports/other/leak'), 'objects', prefix), /out-of-prefix/);
  assert.throws(() => parseListing(objects.replace('<IsTruncated>false</IsTruncated>', '<IsTruncated>true</IsTruncated>'), 'objects', prefix), /marker missing/);
  const paged = objects.replace('<IsTruncated>false</IsTruncated>',
    '<IsTruncated>true</IsTruncated><NextContinuationToken>opaque-token</NextContinuationToken>');
  assert.deepEqual(parseListing(paged, 'objects', prefix).next, ['opaque-token']);
});

test('operator fences first, deletes every inventory class, repeats empty inventory, then finalizes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'o06-purge-'));
  const evidencePath = join(dir, 'evidence.json');
  await writeFile(evidencePath, JSON.stringify(evidence()));
  try {
    const db = dbMock();
    const removed = [];
    let reads = 0;
    const store = { async health() {}, async inventory() {
      reads++;
      return reads === 1 ? [
        { type: 'current', key: `${prefix}orphan.csv` },
        { type: 'version', key: `${prefix}older.csv`, versionId: 'v1' },
        { type: 'marker', key: `${prefix}older.csv`, versionId: 'm1' },
        { type: 'upload', key: `${prefix}partial.csv`, uploadId: 'u1' },
      ] : [];
    }, async remove(entry) { removed.push(entry); } };
    const fenced = await purgeEvent(db, null, { phase: 'fence', tenantId, eventId, generation });
    assert.equal(fenced.generation, generation);
    const result = await purgeEvent(db, store, { phase: 'purge', tenantId, eventId, generation, evidencePath });
    assert.equal(result.finalized, 1);
    assert.equal(reads, 3);
    assert.equal(removed.length, 4);
    const record = db.queries.find((x) => x.sql.includes('record_export_retention_inventory'));
    assert.ok(record);
    const attestation = JSON.parse(record.args[3]);
    assert.equal(attestation.inventoryHash, result.inventoryHash);
    assert.deepEqual(attestation.inventories, result.inventories);
    assert.equal(attestation.inventories[0].count, 4);
    assert.equal(attestation.inventories[1].count, 0);
    assert.ok(db.queries.some((x) => x.sql === 'COMMIT'));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('zero-row finalization needs narrow status proof; active lease rolls back', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'o06-purge-'));
  const evidencePath = join(dir, 'evidence.json');
  await writeFile(evidencePath, JSON.stringify(evidence()));
  const store = { async health() {}, async inventory() { return []; }, async remove() { throw Error('unexpected'); } };
  try {
    const complete = dbMock({ count: 0, finalStatus: { matched: true, fenced: true,
      inventoryRecorded: true, unpurgedCount: 0, activeLeaseCount: 0 } });
    assert.equal((await purgeEvent(complete, store, { phase: 'purge', tenantId, eventId, generation, evidencePath })).finalized, 0);
    const blocked = dbMock({ count: 0, finalStatus: { matched: true, fenced: true,
      inventoryRecorded: true, unpurgedCount: 1, activeLeaseCount: 1 } });
    await assert.rejects(purgeEvent(blocked, store, { phase: 'purge', tenantId, eventId, generation, evidencePath }), /blocked/);
    assert.ok(blocked.queries.some((x) => x.sql === 'ROLLBACK'));
    assert.ok(!blocked.queries.some((x) => x.sql === 'COMMIT'));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('completed generation reruns without rewriting frozen inventory evidence', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'o06-purge-'));
  const evidencePath = join(dir, 'evidence.json');
  await writeFile(evidencePath, JSON.stringify(evidence()));
  try {
    const db = dbMock({ status: { matched: true, fenced: true, inventoryRecorded: true,
      unpurgedCount: 0, activeLeaseCount: 0 } });
    const store = { async health() {}, async inventory() { return []; }, async remove() { throw Error('unexpected'); } };
    const result = await purgeEvent(db, store, { phase: 'purge', tenantId, eventId, generation, evidencePath });
    assert.equal(result.alreadyFinalized, true);
    assert.ok(!db.queries.some((x) => x.sql.includes('record_export_retention_inventory')));
    assert.ok(!db.queries.some((x) => x.sql.includes('finalize_export_retention_event')));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('previously finalized generation fails if any object reappears', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'o06-purge-'));
  const evidencePath = join(dir, 'evidence.json');
  await writeFile(evidencePath, JSON.stringify(evidence()));
  try {
    const db = dbMock({ status: { matched: true, fenced: true, inventoryRecorded: true,
      unpurgedCount: 0, activeLeaseCount: 0 } });
    const store = { async health() {}, async inventory() {
      return [{ type: 'current', key: `${prefix}late.csv` }];
    }, async remove() { throw Error('must not hide late object'); } };
    await assert.rejects(purgeEvent(db, store,
      { phase: 'purge', tenantId, eventId, generation, evidencePath }), /reappeared/);
    assert.ok(!db.queries.some((x) => x.sql.includes('record_export_retention_inventory')));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('inventory or deletion error leaves DB attestation and finalization untouched', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'o06-purge-'));
  const evidencePath = join(dir, 'evidence.json');
  await writeFile(evidencePath, JSON.stringify(evidence()));
  try {
    for (const failAt of ['inventory', 'delete']) {
      const db = dbMock();
      const store = { async health() {}, async inventory() {
        if (failAt === 'inventory') throw Error('list quorum lost');
        return [{ type: 'current', key: `${prefix}orphan.csv` }];
      }, async remove() { throw Error('delete rejected'); } };
      await assert.rejects(purgeEvent(db, store,
        { phase: 'purge', tenantId, eventId, generation, evidencePath }));
      assert.ok(!db.queries.some((x) => x.sql.includes('record_export_retention_inventory')));
      assert.ok(!db.queries.some((x) => x.sql.includes('finalize_export_retention_event')));
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('MinIO adapter uses all three list APIs and explicit version/upload deletion', async () => {
  const seen = [];
  const server = createServer((req, res) => {
    seen.push(req.url);
    if (req.url.startsWith('/minio/health/')) { res.end('OK'); return; }
    assert.match(req.headers.authorization, /^AWS4-HMAC-SHA256 /);
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'DELETE') { res.statusCode = 204; res.end(); return; }
    const key = `${prefix}orphan.csv`;
    if (url.searchParams.has('versions')) res.end(`<ListVersionsResult><Prefix>${prefix}</Prefix><IsTruncated>false</IsTruncated><Version><Key>${key}</Key><VersionId>v1</VersionId></Version></ListVersionsResult>`);
    else if (url.searchParams.has('uploads')) res.end(`<ListMultipartUploadsResult><Prefix></Prefix><IsTruncated>false</IsTruncated><Upload><Key>${key}</Key><UploadId>u1</UploadId></Upload><Upload><Key>exports/another-event/partial.csv</Key><UploadId>u2</UploadId></Upload></ListMultipartUploadsResult>`);
    else res.end(`<ListBucketResult><Prefix>${prefix}</Prefix><IsTruncated>false</IsTruncated><Contents><Key>${key}</Key></Contents></ListBucketResult>`);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const store = s3Client({ O06_MINIO_ADMIN_ENDPOINT: `http://127.0.0.1:${server.address().port}`,
      O06_MINIO_ADMIN_ACCESS_KEY: 'fixture-admin', O06_MINIO_ADMIN_SECRET_KEY: 'fixture-secret',
      O06_MINIO_EXPORTS_BUCKET: 'exports-fixture' });
    await store.health();
    const entries = await store.inventory(prefix);
    assert.deepEqual(entries.map((x) => x.type), ['current', 'version', 'upload']);
    assert.ok(seen.some((x) => x.includes('uploads=') && !x.includes('prefix=')));
    await store.remove(entries[1]); await store.remove(entries[2]);
    assert.ok(seen.some((x) => x.includes('versionId=v1')));
    assert.ok(seen.some((x) => x.includes('uploadId=u1')));
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
