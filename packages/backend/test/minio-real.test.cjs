const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { createHmac, createHash } = require('node:crypto');
const { createServer } = require('node:http');
const { putObject, getObject, deleteObject } = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

/** Create bucket with SigV4 PutBucket (no mc dependency). */
async function createBucket(cfg) {
  const url = new URL(cfg.endpoint);
  const host = url.host;
  const path = `/${cfg.bucket}`;
  const body = Buffer.alloc(0);
  const payloadHash = createHash('sha256').update(body).digest('hex');
  const now = new Date();
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const amz = iso;
  const date = iso.slice(0, 8);
  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amz}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    'PUT',
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
    createHash('sha256').update(canonicalRequest, 'utf8').digest('hex'),
  ].join('\n');
  const hmac = (key, data) =>
    createHmac('sha256', key).update(data, 'utf8').digest();
  const kDate = hmac('AWS4' + cfg.secretKey, date);
  const kRegion = hmac(kDate, cfg.region);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning)
    .update(stringToSign, 'utf8')
    .digest('hex');
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${cfg.accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const res = await fetch(cfg.endpoint + path, {
    method: 'PUT',
    headers: {
      Host: host,
      'X-Amz-Content-Sha256': payloadHash,
      'X-Amz-Date': amz,
      Authorization: authorization,
    },
  });
  if (!(res.status === 200 || res.status === 409)) {
    throw new Error('PutBucket failed: ' + res.status);
  }
}

test(
  'real MinIO container PutObject/GetObject SigV4 roundtrip',
  { timeout: 180000 },
  async () => {
    // Prefer locally cached images; Docker Hub minio/minio may be blocked.
    const image = 'cleanstart/minio:latest';
    const name = 'ticket-minio-' + randomBytes(4).toString('hex');
    const accessKey = 'minioadmin';
    const secretKey = 'minioadmin';
    const bucket = 'ticket-exports';
    try {
      const dataDir = '/tmp/' + name + '-data';
      docker('rm', '-f', name);
      try {
        require('node:fs').rmSync(dataDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
      require('node:fs').mkdirSync(dataDir, { recursive: true });
      docker(
        'run',
        '-d',
        '--name',
        name,
        '--user',
        'root',
        '-e',
        'MINIO_ROOT_USER=' + accessKey,
        '-e',
        'MINIO_ROOT_PASSWORD=' + secretKey,
        '-p',
        '127.0.0.1::9000',
        '-v',
        dataDir + ':/data',
        image,
        'server',
        '/data',
        '--address',
        ':9000',
      );
      const port = docker('port', name, '9000/tcp').split(':').at(-1);
      const endpoint = 'http://127.0.0.1:' + port;
      let ready = false;
      for (let i = 0; i < 80; i++) {
        try {
          const res = await fetch(endpoint + '/minio/health/live');
          if (res.ok) {
            ready = true;
            break;
          }
        } catch {
          // retry
        }
        await new Promise((r) => setTimeout(r, 400));
      }
      assert.ok(ready, 'minio ready');

      const cfg = {
        endpoint,
        accessKey,
        secretKey,
        bucket,
        region: 'us-east-1',
      };
      await createBucket(cfg);
      const key = 'exports/test/roundtrip.csv';
      const payload = Buffer.from('ticketId,state\n1,ACTIVE\n', 'utf8');
      await putObject(cfg, key, payload, 'text/csv; charset=utf-8');
      const got = await getObject(cfg, key);
      assert.equal(got.toString('utf8'), payload.toString('utf8'));
      await deleteObject(cfg, key);
      await assert.rejects(getObject(cfg, key));
      await deleteObject(cfg, key); // Repeated MinIO DELETE is idempotent.
    } finally {
      try {
        docker('rm', '-f', name);
      } catch {
        // ignore
      }
      try {
        require('node:fs').rmSync('/tmp/' + name + '-data', {
          recursive: true,
          force: true,
        });
      } catch {
        // ignore
      }
    }
  },
);

test('object store DELETE treats an explicit 404 as success', async () => {
  const server = createServer((_request, response) => {
    response.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    const cfg = {
      endpoint: 'http://127.0.0.1:' + address.port,
      accessKey: 'fixture-access', secretKey: 'fixture-secret',
      bucket: 'fixture-bucket', region: 'us-east-1',
    };
    await deleteObject(cfg, 'exports/missing.csv');
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
