import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { IMPORT_LIMITS } from '@ticket/contracts';
import {
  IMPORT_UPLOAD_MULTIPART_OVERHEAD_BYTES,
  ImportUploadBodyTooLargeError,
  importUploadBodyLimitBytes,
  isAcceptedImportCsvFile,
  isImportUploadBodyTooLargeError,
  oversizedUploadContentLength,
  readBoundedImportUploadFormData,
} from '../src/admin/import-upload-guard';

describe('importUploadBodyLimitBytes', () => {
  it('matches max file bytes plus multipart overhead', () => {
    assert.equal(
      importUploadBodyLimitBytes(),
      IMPORT_LIMITS.maxBytes + IMPORT_UPLOAD_MULTIPART_OVERHEAD_BYTES,
    );
  });
});

describe('readBoundedImportUploadFormData', () => {
  it('rejects streamed bodies above the multipart cap', async () => {
    const boundary = '----vemokiUnit';
    const limit = importUploadBodyLimitBytes();
    const padding = 'x'.repeat(limit + 1);
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="tenantId"',
      '',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="big.csv"',
      'Content-Type: text/csv',
      '',
      padding,
      `--${boundary}--`,
      '',
    ].join('\r\n');
    const request = new Request('http://127.0.0.1/upload', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(body));
          controller.close();
        },
      }),
      duplex: 'half',
    } as RequestInit);
    await assert.rejects(
      () => readBoundedImportUploadFormData(request),
      (error: unknown) => {
        assert.ok(isImportUploadBodyTooLargeError(error));
        assert.ok(error instanceof ImportUploadBodyTooLargeError);
        return true;
      },
    );
  });

  it('accepts small streamed multipart within the cap', async () => {
    const boundary = '----vemokiOk';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="tenantId"',
      '',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="ok.csv"',
      'Content-Type: text/csv',
      '',
      'code\nA\n',
      `--${boundary}--`,
      '',
    ].join('\r\n');
    const request = new Request('http://127.0.0.1/upload', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
    const form = await readBoundedImportUploadFormData(request);
    const file = form.get('file');
    assert.ok(file instanceof File);
    assert.equal(file.name, 'ok.csv');
  });
});

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
