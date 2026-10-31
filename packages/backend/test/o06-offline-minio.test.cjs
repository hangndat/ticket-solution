'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { s3Client } = require('../scripts/o06-offline-purge.cjs');

const image = 'cleanstart/minio@sha256:4febd64f632c221b48e0fbf435ac534df822aa5b06805540c03973939e4cc82a';
const accessKey = 'o06fixtureadmin';
const secretKey = 'o06fixturesecret123';
const bucket = 'o06-operator-fixture';
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const aws = (endpoint, ...args) => docker('run', '--rm',
  '-e', `AWS_ACCESS_KEY_ID=${accessKey}`, '-e', `AWS_SECRET_ACCESS_KEY=${secretKey}`,
  '-e', 'AWS_DEFAULT_REGION=us-east-1', '-e', 'AWS_EC2_METADATA_DISABLED=true',
  'amazon/aws-cli:2.17.50', '--endpoint-url',
  endpoint.replace('127.0.0.1', 'host.docker.internal'), 's3api', ...args);

async function emptyAfterRemove(store, prefix) {
  for (let pass = 0; pass < 8; pass++) {
    const entries = await store.inventory(prefix);
    if (!entries.length) {
      assert.deepEqual(await store.inventory(prefix), []);
      return;
    }
    const versionedKeys = new Set(entries.filter((x) => x.versionId !== undefined).map((x) => x.key));
    for (const entry of entries) {
      if (entry.type !== 'current' || !versionedKeys.has(entry.key)) await store.remove(entry);
    }
  }
  assert.fail('Inventory did not converge');
}

test('pinned MinIO lists/deletes orphan currents, versions, markers, and multipart uploads',
  { timeout: 180_000 }, async () => {
    const name = `o06-minio-${randomUUID().slice(0, 8)}`;
    docker('run', '-d', '--rm', '--name', name, '--user', 'root',
      '-e', `MINIO_ROOT_USER=${accessKey}`, '-e', `MINIO_ROOT_PASSWORD=${secretKey}`,
      '-p', '127.0.0.1::9000', image, 'server', '/data', '--address', ':9000');
    try {
      const endpoint = `http://127.0.0.1:${docker('port', name, '9000/tcp').split(':').at(-1)}`;
      let ready = false;
      for (let i = 0; i < 100; i++) {
        try { if ((await fetch(`${endpoint}/minio/health/live`)).ok) { ready = true; break; } }
        catch { /* startup */ }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      assert.ok(ready, 'isolated MinIO ready');
      aws(endpoint, 'create-bucket', '--bucket', bucket);
      const store = s3Client({ O06_MINIO_ADMIN_ENDPOINT: endpoint,
        O06_MINIO_ADMIN_ACCESS_KEY: accessKey, O06_MINIO_ADMIN_SECRET_KEY: secretKey,
        O06_MINIO_EXPORTS_BUCKET: bucket });
      await store.health();
      const prefix = `exports/${randomUUID()}/${randomUUID()}/`;
      const orphan = `${prefix}orphan.csv`;
      aws(endpoint, 'put-object', '--bucket', bucket, '--key', orphan,
        '--body', '/etc/hostname');
      const uploadId = JSON.parse(aws(endpoint, 'create-multipart-upload', '--bucket', bucket,
        '--key', `${prefix}partial.csv`)).UploadId;
      assert.ok(uploadId);
      aws(endpoint, 'upload-part', '--bucket', bucket, '--key', `${prefix}partial.csv`,
        '--upload-id', uploadId, '--part-number', '1', '--body', '/etc/hostname');
      const prefixedUploads = JSON.parse(aws(endpoint, 'list-multipart-uploads',
        '--bucket', bucket, '--prefix', prefix));
      const allUploads = JSON.parse(aws(endpoint, 'list-multipart-uploads', '--bucket', bucket));
      assert.equal(prefixedUploads.Uploads?.length || 0, 0,
        'pinned image omits active upload from prefixed listing');
      assert.ok(allUploads.Uploads?.some((x) => x.UploadId === uploadId),
        'unfiltered listing discovers same active upload');
      const unversioned = await store.inventory(prefix);
      assert.deepEqual(new Set(unversioned.map((x) => x.type)), new Set(['current', 'version', 'upload']));
      await emptyAfterRemove(store, prefix);

      aws(endpoint, 'put-bucket-versioning', '--bucket', bucket,
        '--versioning-configuration', 'Status=Enabled');
      aws(endpoint, 'put-object', '--bucket', bucket, '--key', orphan, '--body', '/etc/hostname');
      aws(endpoint, 'put-object', '--bucket', bucket, '--key', orphan, '--body', '/etc/hostname');
      aws(endpoint, 'delete-object', '--bucket', bucket, '--key', orphan);
      const versionedUploadId = JSON.parse(aws(endpoint, 'create-multipart-upload', '--bucket', bucket,
        '--key', `${prefix}partial.csv`)).UploadId;
      aws(endpoint, 'upload-part', '--bucket', bucket, '--key', `${prefix}partial.csv`,
        '--upload-id', versionedUploadId, '--part-number', '1', '--body', '/etc/hostname');
      const versioned = await store.inventory(prefix);
      assert.ok(versioned.filter((x) => x.type === 'version').length >= 2);
      assert.ok(versioned.some((x) => x.type === 'marker'));
      assert.ok(versioned.some((x) => x.type === 'upload'));
      await emptyAfterRemove(store, prefix);
    } finally { docker('rm', '-f', name); }
  });
