'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ExportApiService } = require('../dist/exports');

test('paused API rejects create and download before identity or object access', async () => {
  const service = new ExportApiService({ db: null, verifier: null, users: null,
    bootError: null, env: { EXPORT_WRITES_PAUSED: '1' } });
  await assert.rejects(service.create(undefined, 'tenant', 'event', 'key',
    { format: 'csv' }), { code: 'MINIO_MISCONFIGURED', message: 'Exports are paused' });
  await assert.rejects(service.download(undefined, 'tenant', 'event', 'export'),
    { code: 'MINIO_MISCONFIGURED', message: 'Exports are paused' });
});
