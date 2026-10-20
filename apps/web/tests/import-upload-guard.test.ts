import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { IMPORT_LIMITS } from '@ticket/contracts';
import {
  IMPORT_UPLOAD_MULTIPART_OVERHEAD_BYTES,
  isAcceptedImportCsvFile,
  oversizedUploadContentLength,
} from '../src/admin/import-upload-guard';

describe('oversizedUploadContentLength', () => {
  it('rejects Content-Length above file cap plus multipart overhead', () => {
    const limit =
      IMPORT_LIMITS.maxBytes + IMPORT_UPLOAD_MULTIPART_OVERHEAD_BYTES;
    assert.equal(oversizedUploadContentLength(String(limit + 1)), true);
    assert.equal(oversizedUploadContentLength(String(limit)), false);
    assert.equal(oversizedUploadContentLength(null), false);
    assert.equal(oversizedUploadContentLength('not-a-number'), true);
  });
});

describe('isAcceptedImportCsvFile', () => {
  it('accepts .csv and explicit CSV MIME types', () => {
    assert.equal(
      isAcceptedImportCsvFile(new File(['a'], 'codes.csv', { type: '' })),
      true,
    );
    assert.equal(
      isAcceptedImportCsvFile(
        new File(['a'], 'data', { type: 'text/csv;charset=utf-8' }),
      ),
      true,
    );
  });

  it('rejects generic text/plain without .csv extension', () => {
    assert.equal(
      isAcceptedImportCsvFile(new File(['a'], 'payload.txt', { type: 'text/plain' })),
      false,
    );
    assert.equal(
      isAcceptedImportCsvFile(new File(['a'], 'payload', { type: 'text/plain' })),
      false,
    );
  });
});
