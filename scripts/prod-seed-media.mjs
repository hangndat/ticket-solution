#!/usr/bin/env node
/**
 * Epic #686 — Idempotent prod media upload to MinIO (brand/prod/manifest.json).
 *
 *   PROD_MEDIA_CONFIRM=1 node scripts/prod-seed-media.mjs
 *   PROD_MEDIA_DRY_RUN=1 node scripts/prod-seed-media.mjs
 *   node scripts/prod-seed-media.mjs --smoke-only
 */
import { createHash, createHmac } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MANIFEST_PATH = join(ROOT, 'brand/prod/manifest.json');

const args = new Set(process.argv.slice(2));
const smokeOnly = args.has('--smoke-only');
const asJson = args.has('--json');
const writeEvidence = !args.has('--no-evidence');
const dryRun =
  args.has('--dry-run') ||
  process.env.PROD_MEDIA_DRY_RUN === '1' ||
  process.env.PROD_MEDIA_DRY_RUN === 'true';

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
    headersList.map(([k, v]) => `${k}:${v}\n`).join('');
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
  const put = await signedRequest(cfg, { method: 'PUT', objectKey: null });
  if (put.status === 200 || put.status === 409) return;
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

async function getObject(cfg, objectKey) {
  const get = await signedRequest(cfg, { method: 'GET', objectKey });
  if (get.status !== 200) return null;
  return get.body;
}

function readyKey(tenantId, eventId, assetId, extension) {
  return `tenants/${tenantId}/events/${eventId}/assets/ready/${assetId}.${extension}`;
}

function buildPlan(manifest) {
  /** @type {{ key: string, source: string, contentType: string, role: string, sha256: string }[]} */
  const objects = [];
  const seen = new Set();

  for (const tenant of manifest.tenants) {
    const anchorEventId = tenant.events[0]?.eventId ?? null;
    const orgLogo = tenant.tenantBrand?.logo;
    if (orgLogo && anchorEventId) {
      const key = readyKey(
        tenant.tenantId,
        anchorEventId,
        orgLogo.assetId,
        orgLogo.extension,
      );
      if (!seen.has(key)) {
        const abs = join(ROOT, orgLogo.source);
        const body = readFileSync(abs);
        objects.push({
          key,
          source: orgLogo.source,
          contentType: orgLogo.contentType,
          role: `${tenant.slug}/org-logo`,
          sha256: sha256Hex(body),
        });
        seen.add(key);
      }
    }

    for (const event of tenant.events) {
      for (const asset of event.assets) {
        const key = readyKey(
          tenant.tenantId,
          event.eventId,
          asset.assetId,
          asset.extension,
        );
        if (seen.has(key)) continue;
        const abs = join(ROOT, asset.source);
        const body = readFileSync(abs);
        objects.push({
          key,
          source: asset.source,
          contentType: asset.contentType,
          role: `${tenant.slug}/${event.slug}/${asset.role}`,
          sha256: sha256Hex(body),
        });
        seen.add(key);
      }
    }
  }

  return objects;
}

function assertMutateAllowed() {
  if (dryRun || smokeOnly) return;
  const confirm = process.env.PROD_MEDIA_CONFIRM?.trim();
  if (confirm !== '1' && confirm !== 'yes') {
    throw new Error(
      'Refuse: set PROD_MEDIA_CONFIRM=1 to upload (or PROD_MEDIA_DRY_RUN=1 / --smoke-only)',
    );
  }
}

async function main() {
  assertMutateAllowed();
  const startedAt = new Date().toISOString();
  const cfg = loadConfig();
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  const plan = buildPlan(manifest);

  const healthUrl = `${cfg.endpoint.replace(/\/$/, '')}/minio/health/live`;
  const health = await fetch(healthUrl).catch((e) => ({ ok: false, error: String(e) }));
  if (!health.ok) {
    const detail = health.error || `HTTP ${health.status}`;
    throw new Error(
      `MinIO health failed at ${healthUrl}: ${detail}. Run: D9_MEDIA_STACK_UP=1 ./scripts/prod-seed-media.sh`,
    );
  }

  const uploads = [];
  if (!smokeOnly && !dryRun) {
    await ensureBucket(cfg);
    for (const item of plan) {
      const abs = join(ROOT, item.source);
      const body = readFileSync(abs);
      const localHash = sha256Hex(body);
      const remote = await getObject(cfg, item.key);
      if (remote && sha256Hex(remote) === localHash) {
        uploads.push({ ...item, action: 'skipped', bytes: body.length });
        continue;
      }
      await putObject(cfg, item.key, body, item.contentType);
      uploads.push({ ...item, action: 'put', bytes: body.length });
    }
  } else if (dryRun) {
    for (const item of plan) {
      uploads.push({ ...item, action: 'dry-run', bytes: 0 });
    }
  }

  const smokes = [];
  for (const item of plan) {
    const remote = await getObject(cfg, item.key);
    if (!remote) {
      smokes.push({ ...item, smoke: dryRun ? 'DRY' : 'FAIL', bytes: 0 });
      continue;
    }
    const match = sha256Hex(remote) === item.sha256;
    smokes.push({
      role: item.role,
      key: item.key,
      source: item.source,
      contentType: item.contentType,
      bytes: remote.length,
      sha256: item.sha256,
      remoteSha256: sha256Hex(remote),
      smoke: match ? 'PASS' : 'FAIL',
    });
  }

  const report = {
    issue: '#686',
    startedAt,
    finishedAt: new Date().toISOString(),
    smokeOnly,
    dryRun,
    endpoint: cfg.endpoint,
    bucket: cfg.bucket,
    objectCount: smokes.length,
    uploads,
    objects: smokes,
    manifest: relative(ROOT, MANIFEST_PATH),
    verdict: smokes.every((s) => s.smoke === 'PASS' || s.smoke === 'DRY')
      ? 'PASS'
      : 'FAIL',
  };

  if (writeEvidence) {
    const outDir = join(ROOT, 'docs/reviews');
    mkdirSync(outDir, { recursive: true });
    const evidencePath = join(outDir, 'EPIC686-PROD-MEDIA-SEED-EVIDENCE.md');
    const md = [
      '# Epic #686 prod media seed evidence',
      '',
      `- Finished: ${report.finishedAt}`,
      `- Endpoint: \`${report.endpoint}\``,
      `- Bucket: \`${report.bucket}\``,
      `- Objects: ${report.objectCount}`,
      `- Verdict: **${report.verdict}**`,
      `- Mode: ${dryRun ? 'dry-run' : smokeOnly ? 'smoke-only' : 'put+smoke'}`,
      '',
      '## Objects',
      '',
      '| Role | Key | Smoke |',
      '| --- | --- | --- |',
      ...smokes.map((s) => `| ${s.role} | \`${s.key}\` | ${s.smoke} |`),
      '',
    ].join('\n');
    writeFileSync(evidencePath, md);
    report.evidencePath = relative(ROOT, evidencePath);
  }

  if (asJson) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    console.log(
      `prod media seed ${report.verdict} — ${report.objectCount} objects @ ${report.bucket}`,
    );
    for (const s of smokes) {
      console.log(`  ${s.smoke}  ${s.key}`);
    }
    if (report.evidencePath) console.log(`evidence: ${report.evidencePath}`);
  }

  if (report.verdict !== 'PASS') process.exit(1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
