import assert from 'node:assert/strict';
import test from 'node:test';
import { exportAlertType } from '../src/ops/export-job';
import { importAlertType, interpretImportCommit } from '../src/ops/import-job';

test('FAILED import job and export job do not get a success presentation', () => {
  const failedCommit = interpretImportCommit(200, { importId: 'i1', status: 'FAILED' }, false);
  assert.equal(failedCommit.kind, 'unknown');
  assert.equal(importAlertType({ kind: 'unknown', message: 'Chưa xác định' }), 'warning');
  assert.equal(importAlertType({ kind: 'job', job: {
    importId: 'i1', status: 'FAILED', kind: 'CODES', eventId: 'e1', sourceId: 's1',
    ticketTypeId: 't1', fileId: 'f1', fileHash: 'hash', mappingRevision: 1,
    previewRevision: null, createdAt: '', updatedAt: '', rowCount: 0,
    validRowCount: 0, errorRowCount: 0, committedRowCount: 0, skippedRowCount: 0,
    invitationCount: 0, estimatedQuota: 0,
  } }), 'error');
  const job = { exportId: 'e1', status: 'FAILED' as const, rowCount: null, expiresAt: null, error: null, replayed: false };
  assert.equal(exportAlertType({ kind: 'status', job }), 'error');
  assert.equal(exportAlertType({ kind: 'created', job: { ...job, status: 'PENDING' } }), 'warning');
});
