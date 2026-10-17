#!/usr/bin/env node
/**
 * D9-S2-T2 — Idempotent seed of demo media into MinIO (ADR-14).
 *
 * Usage:
 *   node scripts/d9-seed-media.mjs
 *   node scripts/d9-seed-media.mjs --smoke-only
 *   node scripts/d9-seed-media.mjs --json
 *
 * Does not touch DB / business logic. Object keys follow C-B ready layout.
 * Credentials: env only (MINIO_*); never commit secrets.
 */
import { createHash, createHmac } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MANIFEST_PATH = join(ROOT, 'brand/demo/manifest.json');

const args = new Set(process.argv.slice(2));
const smokeOnly = args.has('--smoke-only');
const asJson = args.has('--json');
const writeEvidence = !args.has('--no-evidence');

function env(name, fallback) {
  const v = process.env[name]?.trim();
  return v || fallback;
}

function loadConfig() {
  return {
    endpoint: env('MINIO_ENDPOINT', 'http://127.0.0.1:9000'),
    accessKey: env('MINIO_ACCESS_KEY', env('MINIO_ROOT_USER', 'minioadmin')),
    secretKey: env('MINIO_SECRET_KEY', env('MINIO_ROOT_PASSWORD', 'minioadmin')),
    bucket: env('MINIO_BUCKET_ASSETS', 'vemoki-assets'),
    region: env('MINIO_REGION', 'us-east-1'),
  };
}

function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

function hmac(key, data) {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function amzDate(now = new Date()) {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amz: iso, date: iso.slice(0, 8) };
}

function encodeObjectKey(objectKey) {
  return objectKey
    .split('/')
    .map((p) => encodeURIComponent(p).replace(/%2F/g, '/'))
    .join('/');
}

function objectPath(bucket, objectKey) {
  return `/${bucket}/${encodeObjectKey(objectKey)}`;
}

async function signedRequest(cfg, { method, objectKey, body, contentType }) {
  const url = new URL(cfg.endpoint);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('MINIO_ENDPOINT must be http(s)');
  }
  const path = objectKey == null ? `/${cfg.bucket}` : objectPath(cfg.bucket, objectKey);
  const payload = body ?? Buffer.alloc(0);
  const payloadHash = sha256Hex(payload);
  const { amz, date } = amzDate();
  const host = url.host;
  const headersList = [
    ['host', host],
    ['x-amz-content-sha256', payloadHash],
    ['x-amz-date', amz],
  ];
  if (contentType) headersList.push(['content-type', contentType]);
  headersList.sort(([a], [b]) => a.localeCompare(b));
  const canonicalHeaders =
    headersList.map(([k, v]) => `${k}:${v}\n`).join('') ;
  const signedHeaders = headersList.map(([k]) => k).join(';');
  const canonicalRequest = [
    method,
    path,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const credentialScope = `${date}/${cfg.region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amz,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');
  const kDate = hmac(`AWS4${cfg.secretKey}`, date);
  const kRegion = hmac(kDate, cfg.region);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning)
    .update(stringToSign, 'utf8')
    .digest('hex');
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${cfg.accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const headers = {
    Host: host,
    'X-Amz-Content-Sha256': payloadHash,
    'X-Amz-Date': amz,
    Authorization: authorization,
  };
  if (contentType) headers['Content-Type'] = contentType;

  const res = await fetch(`${url.protocol}//${host}${path}`, {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : payload,
  });
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, body: buf, headers: res.headers };
}

async function ensureBucket(cfg) {
  // PutBucket (SigV4) — 200 created, 409 already exists (S3), MinIO may return 200 either way.
  const put = await signedRequest(cfg, { method: 'PUT', objectKey: null });
  if (put.status === 200 || put.status === 409) return;
  // Already owned / exists variants
  const body = put.body.toString('utf8');
  if (
    put.status === 400 &&
    /BucketAlreadyOwnedByYou|BucketAlreadyExists/i.test(body)
  ) {
    return;
  }
  throw new Error(
    `PutBucket failed: HTTP ${put.status} ${body.slice(0, 200)}`,
  );
}

async function putObject(cfg, objectKey, body, contentType) {
  const res = await signedRequest(cfg, {
    method: 'PUT',
    objectKey,
    body,
    contentType,
  });
  if (res.status !== 200 && res.status !== 204) {
    throw new Error(
      `PutObject ${objectKey} failed: HTTP ${res.status} ${res.body.toString('utf8').slice(0, 200)}`,
    );
  }
}

async function headOrGet(cfg, objectKey) {
  const get = await signedRequest(cfg, { method: 'GET', objectKey });
  if (get.status !== 200) {
    throw new Error(`GET ${objectKey} failed: HTTP ${get.status}`);
  }
  return { bytes: get.body.length, etag: get.headers.get('etag') };
}

function readyKey(tenantId, eventId, assetId, extension) {
  return `tenants/${tenantId}/events/${eventId}/assets/ready/${assetId}.${extension}`;
}

function mimeForSource(path) {
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  if (path.endsWith('.json')) return 'application/json';
  return 'application/octet-stream';
}

function buildPlan(manifest) {
  /** @type {{ key: string, source: string, contentType: string, role: string }[]} */
  const objects = [];

  for (const tenant of manifest.tenants) {
    for (const asset of tenant.event.assets) {
      objects.push({
        key: readyKey(
          tenant.tenantId,
          tenant.event.eventId,
          asset.assetId,
          asset.extension,
        ),
        source: asset.source,
        contentType: asset.contentType,
        role: `${tenant.slug}/${tenant.event.slug}/${asset.role}`,
      });
    }
  }

  const prefix = manifest.platformBrandPrefix || 'demo/brand/vemoki';
  for (const source of manifest.platformFiles || []) {
    const base = source.split('/').pop();
    objects.push({
      key: `${prefix}/${base}`,
      source,
      contentType: mimeForSource(source),
      role: `platform/${base}`,
    });
  }

  return objects;
}

async function main() {
  const startedAt = new Date().toISOString();
  const cfg = loadConfig();
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  const plan = buildPlan(manifest);

  const healthUrl = `${cfg.endpoint.replace(/\/$/, '')}/minio/health/live`;
  const health = await fetch(healthUrl).catch((e) => ({ ok: false, error: String(e) }));
  if (!health.ok) {
    const detail = health.error || `HTTP ${health.status}`;
    throw new Error(
      `MinIO health failed at ${healthUrl}: ${detail}. Run: docker compose up -d minio --wait`,
    );
  }

  if (!smokeOnly) {
    await ensureBucket(cfg);
    for (const item of plan) {
      const abs = join(ROOT, item.source);
      const body = readFileSync(abs);
      await putObject(cfg, item.key, body, item.contentType);
    }
  }

  const smokes = [];
  for (const item of plan) {
    const result = await headOrGet(cfg, item.key);
    smokes.push({
      role: item.role,
      key: item.key,
      source: item.source,
      contentType: item.contentType,
      bytes: result.bytes,
      etag: result.etag,
      smoke: 'PASS',
      publicUrlNote: 'bucket private — use app signed URL; raw path for ops only',
      objectUrlPath: `/${cfg.bucket}/${item.key}`,
    });
  }

  const report = {
    issue: '#141',
    story: '#139',
    epic: '#134',
    startedAt,
    finishedAt: new Date().toISOString(),
    smokeOnly,
    endpoint: cfg.endpoint,
    bucket: cfg.bucket,
    region: cfg.region,
    objectCount: smokes.length,
    objects: smokes,
    manifest: relative(ROOT, MANIFEST_PATH),
    checklist: 'docs/ops/MEDIA-ASSET-CHECKLIST.md',
    verdict: smokes.every((s) => s.smoke === 'PASS') ? 'PASS' : 'FAIL',
  };

  if (writeEvidence) {
    const outDir = join(ROOT, 'docs/reviews');
    mkdirSync(outDir, { recursive: true });
    const evidencePath = join(outDir, 'D9-S2-MEDIA-SEED-EVIDENCE.md');
    const md = [
      '# D9-S2 media seed evidence',
      '',
      `- Issues: #140 (checklist), #141 (seed), Story #139, Epic #134`,
      `- Finished: ${report.finishedAt}`,
      `- Endpoint: \`${report.endpoint}\``,
      `- Bucket: \`${report.bucket}\``,
      `- Objects: ${report.objectCount}`,
      `- Verdict: **${report.verdict}**`,
      `- Mode: ${smokeOnly ? 'smoke-only' : 'put+smoke'}`,
      '',
      '## Object keys',
      '',
      '| Role | Key | Bytes | Smoke |',
      '| --- | --- | ---: | --- |',
      ...smokes.map(
        (s) =>
          `| ${s.role} | \`${s.key}\` | ${s.bytes} | ${s.smoke} |`,
      ),
      '',
      '## Commands',
      '',
      '```bash',
      './scripts/d9-seed-media.sh',
      './scripts/d9-seed-media.sh --smoke-only',
      '```',
      '',
      '## Limitations',
      '',
      '- Seed ghi thẳng object **ready** (ops path); không gọi API quarantine/finalize.',
      '- UUID demo trong `brand/demo/manifest.json` cần S1 DB seed gắn cùng id để publish brand.',
      '- Bucket private: smoke = SigV4 GET, không anonymous URL công khai.',
      '',
    ].join('\n');
    writeFileSync(evidencePath, md);
    report.evidencePath = relative(ROOT, evidencePath);
  }

  if (asJson) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    console.log(`D9 media seed ${report.verdict} — ${report.objectCount} objects @ ${report.bucket}`);
    for (const s of smokes) {
      console.log(`  PASS  ${s.key}  (${s.bytes} B)`);
    }
    if (report.evidencePath) console.log(`evidence: ${report.evidencePath}`);
  }

  if (report.verdict !== 'PASS') process.exit(1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
