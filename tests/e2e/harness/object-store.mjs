import { createHash, createHmac } from 'node:crypto';

// SigV4 PutBucket, matching the existing real-MinIO integration fixture.
// Endpoint, bucket and credentials belong exclusively to this harness run.
export async function createRunBucket(state) {
  const endpoint = `http://127.0.0.1:${state.ports.minio}`;
  const host = new URL(endpoint).host;
  const path = `/e2e-${state.id}`;
  const amz = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = amz.slice(0, 8);
  const hash = (value) => createHash('sha256').update(value).digest('hex');
  const hmac = (key, value) => createHmac('sha256', key).update(value).digest();
  const payloadHash = hash('');
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amz}\n`;
  const canonical = [
    'PUT',
    path,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const scope = `${date}/us-east-1/s3/aws4_request`;
  const key = hmac(
    hmac(hmac(hmac(`AWS4${state.secrets.minio}`, date), 'us-east-1'), 's3'),
    'aws4_request',
  );
  const signature = createHmac('sha256', key)
    .update(['AWS4-HMAC-SHA256', amz, scope, hash(canonical)].join('\n'))
    .digest('hex');
  const response = await fetch(endpoint + path, {
    method: 'PUT',
    headers: {
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amz,
      authorization: `AWS4-HMAC-SHA256 Credential=e2e-access/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  });
  if (response.status !== 200)
    throw new Error(`BLOCKED: run bucket creation HTTP ${response.status}`);
}
