'use strict';

// Local maintenance operator. Never run in an API or worker process.
// Usage: node scripts/o06-offline-purge.cjs plan|check [--limit 1..500]
//        node scripts/o06-offline-purge.cjs fence|purge --tenant UUID --event UUID
//        --generation UUID
//        [--evidence /absolute/path.json]
// Purge requires an already-fenced event and positive external process evidence.

const { createHash, createHmac } = require('node:crypto');
const { readFile } = require('node:fs/promises');
const { request: httpRequest } = require('node:http');
const { request: httpsRequest } = require('node:https');
const { Client } = require('pg');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const hmac = (key, value) => createHmac('sha256', key).update(value).digest();
const fail = (message) => { throw new Error(message); };

function parseArgs(argv) {
  const [phase, ...rest] = argv;
  if (!['plan', 'check', 'fence', 'purge'].includes(phase)) fail('Expected plan, check, fence or purge phase');
  if (rest.length % 2) fail('Options require values');
  const args = { phase };
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i];
    const allowed = ['plan', 'check'].includes(phase) ? ['--limit']
      : ['--tenant', '--event', '--generation', '--evidence'];
    if (!allowed.includes(key) || args[key]) fail('Unknown or duplicate option');
    args[key] = rest[i + 1];
  }
  if (phase === 'plan' || phase === 'check') {
    const pageSize = args['--limit'] === undefined ? 200 : Number(args['--limit']);
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) fail('Page limit must be 1..500');
    return { phase, pageSize };
  }
  if (!UUID.test(args['--tenant'] || '') || !UUID.test(args['--event'] || '') ||
      !UUID.test(args['--generation'] || '')) fail('Tenant, event, and stable generation UUIDs required');
  if (phase === 'purge' && !args['--evidence']) fail('Purge requires --evidence');
  return { phase, tenantId: args['--tenant'], eventId: args['--event'],
    generation: args['--generation'], evidencePath: args['--evidence'] };
}

// This is a read-only, snapshot-stable inventory. The database function checks
// the day-89 window and includes existing overdue rows, even without exports.
async function checkDueEvents(db, input, emit = (row) => console.log(JSON.stringify(row))) {
  await db.query('SET ROLE ticket_retention_operator');
  const role = await db.query('SELECT current_user AS role');
  if (role.rows[0]?.role !== 'ticket_retention_operator') fail('Dedicated retention operator DB role required');
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    const asOf = (await db.query('SELECT transaction_timestamp() AS as_of')).rows[0]?.as_of;
    if (!(asOf instanceof Date) || !Number.isFinite(asOf.getTime())) fail('Database clock unavailable');
    let cursor = [null, null, null];
    let due = 0;
    let pending = 0;
    let overdue = 0;
    // Bound each DB page and fail closed if a pathological scan cannot finish.
    for (let page = 0; page < 10000; page++) {
      const result = await db.query(
        'SELECT * FROM public.list_export_retention_due_events($1::timestamptz,$2::integer,$3::timestamptz,$4::uuid,$5::uuid)',
        [asOf, input.pageSize, ...cursor]);
      const rows = result.rows;
      for (const row of rows) {
        const deadline = row.deadline instanceof Date ? row.deadline.toISOString() : row.deadline;
        const isOverdue = row.completed !== true && Date.parse(deadline) <= asOf.getTime();
        due++;
        if (row.completed !== true) pending++;
        if (isOverdue) overdue++;
        emit({ type: 'event', tenantId: row.tenant_id, eventId: row.event_id,
          deadline, state: row.completed === true ? 'completed' : 'pending',
          overdue: isOverdue, barrierGeneration: row.barrier_generation,
          fencedAt: row.fenced_at, inventoryRecordedAt: row.inventory_recorded_at,
          unpurgedCount: Number(row.unpurged_count) });
      }
      if (rows.length < input.pageSize) {
        await db.query('COMMIT');
        const summary = { type: 'summary', asOf: asOf.toISOString(), due, pending,
          overdue, alert: overdue > 0 ? 'O06_EXPORT_RETENTION_OVERDUE'
            : pending > 0 ? 'O06_EXPORT_RETENTION_DUE' : null };
        emit(summary);
        return summary;
      }
      const last = rows.at(-1);
      const next = [last.deadline_cursor, last.tenant_id, last.event_id];
      if (JSON.stringify(next) === JSON.stringify(cursor)) fail('Due-event pagination did not advance');
      cursor = next;
    }
    fail('Due-event pagination exceeded 10000 pages');
  } catch (error) { await db.query('ROLLBACK'); throw error; }
}

// Evidence is supplied by the operator from process/supervisor and credential
// records. A timeout, restart request, or missing node never satisfies it.
function validateEvidence(value, tenantId, eventId, generation) {
  if (!value || value.tenantId !== tenantId || value.eventId !== eventId ||
      value.generation !== generation || value.writerIdentityDisabled !== true ||
      value.writerRestartInhibited !== true || value.operationsToolsStopped !== true ||
      value.minioRestartedSameVolumes !== true) fail('Incomplete barrier evidence');
  for (const name of ['writers', 'minioNodes']) {
    const entries = value[name];
    if (!Array.isArray(entries) || entries.length === 0 ||
        new Set(entries.map((x) => x.id)).size !== entries.length ||
        entries.some((x) => !x || typeof x.id !== 'string' || !x.id ||
          x.exitConfirmed !== true || !Number.isInteger(x.pid) || x.pid < 1 ||
          !Number.isFinite(Date.parse(x.exitedAt)) ||
          typeof x.proof !== 'string' || x.proof.trim().length < 8)) {
      fail(`Missing positive ${name} process-exit evidence`);
    }
  }
  const roles = new Set(value.writers.map((x) => x.role));
  if (!roles.has('api') || !roles.has('worker')) fail('API and worker process exit required');
  if (!Array.isArray(value.expectedWriterIds) || !Array.isArray(value.expectedMinioNodeIds) ||
      value.expectedWriterIds.length !== value.writers.length ||
      value.expectedMinioNodeIds.length !== value.minioNodes.length ||
      new Set(value.expectedWriterIds).size !== value.expectedWriterIds.length ||
      new Set(value.expectedMinioNodeIds).size !== value.expectedMinioNodeIds.length ||
      value.expectedWriterIds.some((id) => !value.writers.some((x) => x.id === id)) ||
      value.expectedMinioNodeIds.some((id) => !value.minioNodes.some((x) => x.id === id))) {
    fail('Process inventory does not match expected topology');
  }
  for (const name of ['writerIdentityDisableProof', 'writerRestartInhibitProof',
    'operationsToolsStopProof', 'sameVolumesRestartProof']) {
    if (typeof value[name] !== 'string' || value[name].trim().length < 8) fail(`Missing ${name}`);
  }
  const disabledAt = Date.parse(value.writerIdentityDisabledAt);
  const restartedAt = Date.parse(value.minioRestartedAt);
  const observedAt = Date.parse(value.observedAt);
  if (![disabledAt, restartedAt, observedAt].every(Number.isFinite) ||
      observedAt > Date.now() || restartedAt >= observedAt ||
      value.writers.some((x) => Date.parse(x.exitedAt) > disabledAt) ||
      value.minioNodes.some((x) => Date.parse(x.exitedAt) >= restartedAt) ||
      disabledAt >= restartedAt) fail('Barrier evidence chronology invalid');
  return {
    writerExitHash: sha256(JSON.stringify({ writers: value.writers, expected: value.expectedWriterIds,
      disabled: value.writerIdentityDisableProof, restart: value.writerRestartInhibitProof,
      tools: value.operationsToolsStopProof, disabledAt })),
    serverBarrierHash: sha256(JSON.stringify({ nodes: value.minioNodes,
      expected: value.expectedMinioNodeIds, restart: value.sameVolumesRestartProof,
      restartedAt, observedAt })),
  };
}

function xmlDecode(text) {
  if (/&(?!(?:#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);)/i.test(text)) fail('Unknown S3 XML entity');
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/gi, (_, entity) => {
    if (entity[0] === '#') return String.fromCodePoint(entity[1].toLowerCase() === 'x'
      ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10));
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[entity];
  });
}

function parseXml(xml) {
  if (typeof xml !== 'string' || xml.length > 8_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) fail('Invalid S3 XML');
  const root = { name: '', children: [], text: '' };
  const stack = [root];
  const tokens = xml.match(/<[^>]*>|[^<]+/g) || [];
  for (const token of tokens) {
    if (token.startsWith('<?')) continue;
    if (token.startsWith('<!')) fail('Unsupported S3 XML');
    if (token.startsWith('</')) {
      const name = token.slice(2, -1).trim().split(':').pop();
      if (stack.length < 2 || stack.at(-1).name !== name) fail('Malformed S3 XML');
      stack.pop();
    } else if (token.startsWith('<')) {
      const match = /^<([A-Za-z][\w:.-]*)/.exec(token);
      const name = match?.[1].split(':').pop();
      if (!/^[A-Za-z][\w.-]*$/.test(name)) fail('Malformed S3 XML');
      const node = { name, children: [], text: '' };
      stack.at(-1).children.push(node);
      if (!token.endsWith('/>')) stack.push(node);
    } else stack.at(-1).text += token;
  }
  if (stack.length !== 1 || root.children.length !== 1) fail('Malformed S3 XML');
  return root.children[0];
}
const children = (node, name) => node.children.filter((x) => x.name === name);
const field = (node, name, required = true) => {
  const matches = children(node, name);
  if (matches.length !== 1) { if (required) fail(`S3 XML missing ${name}`); return null; }
  return xmlDecode(matches[0].text);
};
const keyField = (node) => decodeURIComponent(field(node, 'Key'));

function parseListing(xml, kind, prefix) {
  const doc = parseXml(xml);
  const roots = { objects: 'ListBucketResult', versions: 'ListVersionsResult', uploads: 'ListMultipartUploadsResult' };
  if (doc.name !== roots[kind]) fail(`Unexpected ${kind} response`);
  const listedPrefix = field(doc, 'Prefix', false);
  if (listedPrefix !== null && decodeURIComponent(listedPrefix) !== prefix) fail('S3 prefix mismatch');
  const truncatedValue = field(doc, 'IsTruncated');
  if (!['true', 'false'].includes(truncatedValue)) fail('Invalid S3 truncation flag');
  const truncated = truncatedValue === 'true';
  const entries = [];
  if (kind === 'objects') {
    for (const item of children(doc, 'Contents')) entries.push({ type: 'current', key: keyField(item) });
  } else if (kind === 'versions') {
    for (const type of ['Version', 'DeleteMarker']) {
      for (const item of children(doc, type)) entries.push({ type: type === 'Version' ? 'version' : 'marker',
        key: keyField(item), versionId: field(item, 'VersionId') });
    }
  } else {
    for (const item of children(doc, 'Upload')) entries.push({ type: 'upload', key: keyField(item), uploadId: field(item, 'UploadId') });
  }
  if (entries.some((x) => !x.key.startsWith(prefix) || (x.versionId === '' || x.uploadId === ''))) fail('S3 returned out-of-prefix item');
  const next = kind === 'objects' ? [field(doc, 'NextContinuationToken', false)]
    : kind === 'versions' ? [field(doc, 'NextKeyMarker', false), field(doc, 'NextVersionIdMarker', false)]
      : [field(doc, 'NextKeyMarker', false), field(doc, 'NextUploadIdMarker', false)];
  if (kind !== 'objects' && next[0] !== null) next[0] = decodeURIComponent(next[0]);
  if (truncated && !next[0]) fail('S3 pagination marker missing');
  return { entries, truncated, next };
}

function s3Client(env) {
  const endpoint = new URL(env.O06_MINIO_ADMIN_ENDPOINT || '');
  if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.pathname !== '/' || endpoint.search) fail('Invalid admin endpoint');
  const accessKey = env.O06_MINIO_ADMIN_ACCESS_KEY;
  const secretKey = env.O06_MINIO_ADMIN_SECRET_KEY;
  const bucket = env.O06_MINIO_EXPORTS_BUCKET;
  const region = env.O06_MINIO_REGION || 'us-east-1';
  if (!accessKey || !secretKey || !bucket || !/^[a-z0-9.-]+$/.test(bucket)) fail('Dedicated MinIO admin configuration required');
  async function request(method, path, params = {}) {
    const encode = (value) => encodeURIComponent(value).replace(/[!'()*]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
    const query = Object.entries(params).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([k, v]) => `${encode(k)}=${encode(v)}`).join('&');
    const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const day = date.slice(0, 8);
    const scope = `${day}/${region}/s3/aws4_request`;
    const payloadHash = sha256('');
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    const canonical = [method, path, query,
      `host:${endpoint.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${date}\n`,
      signedHeaders, payloadHash].join('\n');
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, day), region), 's3'), 'aws4_request');
    const signature = createHmac('sha256', signingKey).update(
      ['AWS4-HMAC-SHA256', date, scope, sha256(canonical)].join('\n')).digest('hex');
    const urlPath = `${path}${query ? `?${query}` : ''}`;
    const transport = endpoint.protocol === 'https:' ? httpsRequest : httpRequest;
    return new Promise((resolve, reject) => {
      const req = transport(endpoint, { method, path: urlPath, headers: {
        host: endpoint.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': date,
        authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      } }, (res) => {
        const parts = [];
        let size = 0;
        res.on('data', (part) => { size += part.length; if (size > 8_000_000) req.destroy(new Error('S3 response too large')); else parts.push(part); });
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) reject(new Error(`MinIO ${method} failed: HTTP ${res.statusCode}`));
          else resolve(Buffer.concat(parts).toString('utf8'));
        });
      });
      req.setTimeout(15_000, () => req.destroy(new Error('MinIO timeout')));
      req.on('error', reject);
      req.end();
    });
  }
  const path = `/${bucket}`;
  const objectPath = (key) => `${path}/${key.split('/').map((part) =>
    encodeURIComponent(part).replace(/[!'()*]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)).join('/')}`;
  async function health() {
    for (const suffix of ['/minio/health/cluster/read', '/minio/health/cluster']) {
      const response = await new Promise((resolve, reject) => {
        const req = (endpoint.protocol === 'https:' ? httpsRequest : httpRequest)(endpoint,
          { method: 'GET', path: suffix }, (res) => { res.resume(); resolve(res.statusCode); });
        req.setTimeout(15_000, () => req.destroy(new Error('MinIO health timeout')));
        req.on('error', reject);
        req.end();
      });
      if (response !== 200) fail(`MinIO quorum check failed: ${suffix} HTTP ${response}`);
    }
  }
  async function inventory(prefix) {
    const all = [];
    for (const kind of ['objects', 'versions', 'uploads']) {
      // The pinned cleanstart/MinIO digest omits active uploads when its
      // ListMultipartUploads prefix parameter is set. Scan the whole bucket
      // and filter locally, including all upload pagination pages.
      const listPrefix = kind === 'uploads' ? '' : prefix;
      let cursor = [];
      const seen = new Set();
      for (let page = 0; page < 10000; page++) {
        const params = { 'encoding-type': 'url' };
        if (kind !== 'uploads') params.prefix = listPrefix;
        params[kind === 'uploads' ? 'max-uploads' : 'max-keys'] = '1000';
        if (kind === 'objects') { params['list-type'] = '2'; if (cursor[0]) params['continuation-token'] = cursor[0]; }
        if (kind === 'versions') { params.versions = ''; if (cursor[0]) { params['key-marker'] = cursor[0]; params['version-id-marker'] = cursor[1]; } }
        if (kind === 'uploads') { params.uploads = ''; if (cursor[0]) { params['key-marker'] = cursor[0]; params['upload-id-marker'] = cursor[1]; } }
        const result = parseListing(await request('GET', path, params), kind, listPrefix);
        all.push(...result.entries.filter((entry) => entry.key.startsWith(prefix)));
        if (!result.truncated) break;
        const marker = JSON.stringify(result.next);
        if (seen.has(marker) || page === 9999) fail('S3 pagination did not finish');
        seen.add(marker); cursor = result.next;
      }
    }
    return all;
  }
  async function remove(entry) {
    const params = entry.type === 'upload' ? { uploadId: entry.uploadId }
      : entry.versionId !== undefined ? { versionId: entry.versionId } : {};
    await request('DELETE', objectPath(entry.key), params);
  }
  return { health, inventory, remove };
}

async function purgeEvent(db, store, input) {
  const { tenantId, eventId, phase, generation } = input;
  await db.query('SET ROLE ticket_retention_operator');
  // Session advisory lock lives on the same dedicated connection through finalization.
  const lock = await db.query('SELECT pg_try_advisory_lock(hashtext($1), hashtext($2)) AS locked',
    ['o06-offline-purge', `${tenantId}/${eventId}`]);
  if (lock.rows[0]?.locked !== true) fail('Another purge operator holds this event lock');
  try {
    const role = await db.query('SELECT current_user AS role');
    if (role.rows[0]?.role !== 'ticket_retention_operator') fail('Dedicated retention operator DB role required');
    if (phase === 'fence') {
      const fenced = await db.query('SELECT public.fence_export_retention_event($1::uuid,$2::uuid,$3::uuid) AS ok',
        [tenantId, eventId, generation]);
      if (fenced.rows[0]?.ok !== true) fail('DB refused retention fence');
      return { phase, generation };
    }
    const raw = await readFile(input.evidencePath);
    const proof = validateEvidence(JSON.parse(raw), tenantId, eventId, generation);
    await store.health();
    const state = await db.query('SELECT public.export_retention_operator_status($1::uuid,$2::uuid,$3::uuid) AS status',
      [tenantId, eventId, generation]);
    const previous = state.rows[0]?.status;
    if (previous?.matched !== true || previous.fenced !== true) fail('DB fence generation missing or mismatched');
    if (previous.inventoryRecorded === true &&
        (Number(previous.unpurgedCount) !== 0 || Number(previous.activeLeaseCount) !== 0)) {
      fail('Prior inventory attestation is incomplete; manual recovery required');
    }
    const alreadyFinalized = previous.inventoryRecorded === true;
    const prefix = `exports/${tenantId}/${eventId}/`;
    let emptyChecks = 0;
    const inventories = [];
    for (let pass = 0; pass < 12 && emptyChecks < 2; pass++) {
      const entries = await store.inventory(prefix);
      inventories.push({ pass, count: entries.length, hash: sha256(JSON.stringify(entries)) });
      if (alreadyFinalized && entries.length) fail('Object reappeared after finalized purge');
      if (!entries.length) { emptyChecks++; continue; }
      emptyChecks = 0;
      const versionedKeys = new Set(entries.filter((x) => x.versionId !== undefined).map((x) => x.key));
      for (const entry of entries) {
        if (entry.type === 'current' && versionedKeys.has(entry.key)) continue;
        await store.remove(entry);
      }
    }
    if (emptyChecks !== 2) fail('MinIO inventory did not converge to two empty reads');
    await store.health();
    const inventoryHash = sha256(JSON.stringify({ prefix, generation, inventories, emptyChecks }));
    if (alreadyFinalized) return { phase, generation, alreadyFinalized: true,
      inventoryHash, inventories };
    const attestation = { ...proof, emptyInventory: true,
      inventoryHash, inventories, prefix, generation };
    await db.query('BEGIN');
    try {
      const recorded = await db.query('SELECT public.record_export_retention_inventory($1::uuid,$2::uuid,$3::uuid,$4::jsonb) AS ok',
        [tenantId, eventId, generation, JSON.stringify(attestation)]);
      if (recorded.rows[0]?.ok !== true) fail('DB refused inventory attestation');
      const finalized = await db.query('SELECT public.finalize_export_retention_event($1::uuid,$2::uuid,$3::uuid) AS count',
        [tenantId, eventId, generation]);
      if (!Number.isInteger(finalized.rows[0]?.count) || finalized.rows[0].count < 0) fail('DB refused finalization');
      if (finalized.rows[0].count === 0) {
        const status = await db.query('SELECT public.export_retention_operator_status($1::uuid,$2::uuid,$3::uuid) AS status',
          [tenantId, eventId, generation]);
        const value = status.rows[0]?.status;
        if (value?.matched !== true || value.fenced !== true ||
            value.inventoryRecorded !== true || Number(value.unpurgedCount) !== 0 ||
            Number(value.activeLeaseCount) !== 0) fail('DB finalization blocked');
      }
      await db.query('COMMIT');
      return { phase, generation, finalized: finalized.rows[0].count,
        inventoryHash: attestation.inventoryHash, inventories };
    } catch (error) { await db.query('ROLLBACK'); throw error; }
  } finally {
    await db.query('SELECT pg_advisory_unlock(hashtext($1), hashtext($2))',
      ['o06-offline-purge', `${tenantId}/${eventId}`]);
  }
}

async function main() {
  const input = parseArgs(process.argv.slice(2));
  if (!process.env.O06_OPERATOR_DATABASE_URL) fail('O06_OPERATOR_DATABASE_URL required');
  const db = new Client({ connectionString: process.env.O06_OPERATOR_DATABASE_URL });
  await db.connect();
  try {
    if (input.phase === 'plan' || input.phase === 'check') {
      const summary = await checkDueEvents(db, input);
      if (summary.overdue > 0) process.exitCode = 2;
      else if (summary.pending > 0) process.exitCode = 3;
    } else {
      const store = input.phase === 'purge' ? s3Client(process.env) : null;
      console.log(JSON.stringify(await purgeEvent(db, store, input)));
    }
  } finally { await db.end(); }
}

if (require.main === module) main().catch((error) => {
  console.error(`O06 offline purge stopped: ${error.message}`);
  process.exitCode = 1;
});

module.exports = { parseArgs, validateEvidence, parseListing, purgeEvent, s3Client, checkDueEvents };
