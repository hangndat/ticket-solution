import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';

function requireEnv(name) {
  if (!process.env.E2E_RUN_DIR || !process.env[name])
    throw new Error(`BLOCKED: isolated object observer requires ${name}`);
  return process.env[name];
}

export async function importObjects() {
  const endpoint = requireEnv('MINIO_ENDPOINT');
  const bucket = requireEnv('MINIO_BUCKET_IMPORTS');
  const access = requireEnv('E2E_MINIO_OBSERVER_ACCESS_KEY');
  const secret = requireEnv('E2E_MINIO_OBSERVER_SECRET_KEY');
  const region = requireEnv('MINIO_REGION');
  const host = new URL(endpoint).host;
  const path = `/${encodeURIComponent(bucket)}`;
  const query = 'list-type=2';
  const now = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = now.slice(0, 8);
  const hash = (value) => createHash('sha256').update(value).digest('hex');
  const hmac = (key, value) => createHmac('sha256', key).update(value).digest();
  const digest = hash('');
  const signed = 'host;x-amz-content-sha256;x-amz-date';
  const headers = `host:${host}\nx-amz-content-sha256:${digest}\nx-amz-date:${now}\n`;
  const canonical = ['GET', path, query, headers, signed, digest].join('\n');
  const scope = `${day}/${region}/s3/aws4_request`;
  const key = hmac(
    hmac(hmac(hmac(`AWS4${secret}`, day), region), 's3'),
    'aws4_request',
  );
  const signature = createHmac('sha256', key)
    .update(['AWS4-HMAC-SHA256', now, scope, hash(canonical)].join('\n'))
    .digest('hex');
  const response = await fetch(`${endpoint}${path}?${query}`, {
    headers: {
      'x-amz-content-sha256': digest,
      'x-amz-date': now,
      authorization: `AWS4-HMAC-SHA256 Credential=${access}/${scope}, SignedHeaders=${signed}, Signature=${signature}`,
    },
  });
  assert.equal(response.status, 200, 'isolated import object listing');
  const xml = await response.text();
  assert.match(xml, /<IsTruncated>false<\/IsTruncated>/);
  return [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)]
    .map((match) => match[1])
    .sort();
}
