import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  IMPORT_ERROR_CODES,
  IMPORT_LIMITS,
} from '@ticket/contracts';
import {
  csvTemplateForKind,
  importCommitPath,
  importErrorsPath,
  importPreviewPath,
  importsCreatePath,
  importsUploadPath,
  interpretImportCommit,
  interpretImportCreate,
  interpretImportErrorsDownload,
  interpretImportJobs,
  interpretImportPreview,
  interpretImportUpload,
  parseCsvForImport,
} from '../src/ops/import-job';
import {
  interpretDispatch,
  interpretDispatchPreview,
  interpretInvitationList,
  invitationsPath,
} from '../src/ops/invitation';

const scope = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  eventId: '22222222-2222-4222-8222-222222222222',
};
const importId = '33333333-3333-4333-8333-333333333333';

describe('portal import / invitation helpers', () => {
  it('builds Nest upstream paths', () => {
    assert.equal(
      importsCreatePath(scope),
      `/v1/tenants/${scope.tenantId}/events/${scope.eventId}/imports`,
    );
    assert.equal(
      importsUploadPath(scope),
      `/v1/tenants/${scope.tenantId}/events/${scope.eventId}/imports/files`,
    );
    assert.match(importPreviewPath(scope, importId), /\/preview$/);
    assert.match(importCommitPath(scope, importId), /\/commit$/);
    assert.match(importErrorsPath(scope, importId), /\/errors$/);
    assert.match(invitationsPath(scope, { limit: 50 }), /limit=50/);
  });

  it('parses CSV templates and rejects oversize', () => {
    const codes = parseCsvForImport({
      kind: 'CODES',
      text: csvTemplateForKind('CODES'),
    });
    assert.equal(codes.ok, true);
    const guests = parseCsvForImport({
      kind: 'GUESTS',
      text: csvTemplateForKind('GUESTS'),
    });
    assert.equal(guests.ok, true);
    const huge = 'x'.repeat(IMPORT_LIMITS.maxBytes + 1);
    const over = parseCsvForImport({ kind: 'CODES', text: `code\n${huge}\n` });
    assert.equal(over.ok, false);
    if (!over.ok) assert.equal(over.code, IMPORT_ERROR_CODES.IMPORT_ROW_LIMIT);
  });

  it('lists resumable jobs but never treats a denied or malformed read as empty', () => {
    const summary = {
      importId,
      kind: 'GUESTS',
      status: 'PREVIEW_READY',
      sourceId: '55555555-5555-4555-8555-555555555555',
      ticketTypeId: '66666666-6666-4666-8666-666666666666',
      mappingRevision: 2,
      previewRevision: 3,
      validRowCount: 4,
      errorRowCount: 1,
      invitationCount: 4,
      estimatedQuota: 4,
      createdAt: '2026-10-26T12:00:00.000Z',
    };
    const listed = interpretImportJobs(200, { items: [summary], nextCursor: null }, false);
    assert.equal(listed.kind, 'list');
    if (listed.kind === 'list') assert.equal(listed.items[0]?.previewRevision, 3);
    assert.equal(interpretImportJobs(403, { code: 'FORBIDDEN', message: 'Denied' }, false).kind, 'rejected');
    assert.equal(interpretImportJobs(200, { items: null, nextCursor: null }, false).kind, 'unknown');
    assert.equal(interpretImportJobs(200, { items: [{ ...summary, invitedEmail: 'guest@example.com' }], nextCursor: null }, false).kind, 'unknown');
  });

  it('interprets upload/create/preview/commit; fail-closed on PII', () => {
    const upload = interpretImportUpload(
      201,
      {
        fileId: '44444444-4444-4444-8444-444444444444',
        fileHash: 'abc',
        byteLength: 12,
      },
      false,
    );
    assert.equal(upload.kind, 'upload');

    const job = interpretImportCreate(
      201,
      {
        importId,
        kind: 'CODES',
        status: 'CREATED',
        sourceId: '55555555-5555-4555-8555-555555555555',
        ticketTypeId: '66666666-6666-4666-8666-666666666666',
        fileHash: 'abc',
        mappingRevision: 1,
        previewRevision: null,
        validRowCount: null,
        errorRowCount: null,
        invitationCount: null,
        estimatedQuota: null,
      },
      false,
    );
    assert.equal(job.kind, 'job');

    const leak = interpretImportCreate(
      201,
      {
        importId,
        kind: 'CODES',
        status: 'CREATED',
        sourceId: '55555555-5555-4555-8555-555555555555',
        ticketTypeId: '66666666-6666-4666-8666-666666666666',
        invitedEmail: 'raw@example.com',
      },
      false,
    );
    assert.equal(leak.kind, 'unknown');

    const preview = interpretImportPreview(
      201,
      {
        importId,
        previewRevision: 1,
        mappingRevision: 1,
        fileHash: 'abc',
        validRowCount: 2,
        errorRowCount: 0,
        invitationCount: 0,
        estimatedQuota: 2,
        sampleErrors: [],
      },
      false,
    );
    assert.equal(preview.kind, 'preview');

    const commit = interpretImportCommit(
      200,
      {
        importId,
        status: 'COMPLETED',
        committedRowCount: 2,
        skippedRowCount: 0,
        errorRowCount: 0,
        invitationCount: 0,
        replayed: false,
      },
      false,
    );
    assert.equal(commit.kind, 'commit');

    const errors = interpretImportErrorsDownload(
      200,
      null,
      false,
      importId,
      'text/csv',
      10,
      'errors.csv',
    );
    assert.equal(errors.kind, 'errors');
  });

  it('interprets invitation list/dispatch; rejects raw email', () => {
    const list = interpretInvitationList(
      200,
      {
        items: [
          {
            invitationId: '77777777-7777-4777-8777-777777777777',
            eventId: scope.eventId,
            sourceId: '55555555-5555-4555-8555-555555555555',
            ticketTypeId: '66666666-6666-4666-8666-666666666666',
            invitedEmailMasked: 'g***@example.com',
            state: 'PENDING',
            expiresAt: '2026-01-02T00:00:00.000Z',
          },
        ],
        nextCursor: null,
      },
      false,
    );
    assert.equal(list.kind, 'list');

    const raw = interpretInvitationList(
      200,
      {
        items: [
          {
            invitationId: '77777777-7777-4777-8777-777777777777',
            eventId: scope.eventId,
            sourceId: '55555555-5555-4555-8555-555555555555',
            ticketTypeId: '66666666-6666-4666-8666-666666666666',
            invitedEmail: 'raw@example.com',
            state: 'PENDING',
            expiresAt: '2026-01-02T00:00:00.000Z',
          },
        ],
        nextCursor: null,
      },
      false,
    );
    assert.equal(raw.kind, 'unknown');

    const preview = interpretDispatchPreview(
      200,
      { previewRevision: 1, selectedCount: 1, estimatedQuota: 1 },
      false,
    );
    assert.equal(preview.kind, 'dispatch_preview');

    const dispatch = interpretDispatch(
      200,
      { dispatchedCount: 1, previewRevision: 1, replayed: false },
      false,
    );
    assert.equal(dispatch.kind, 'dispatch');
  });
});
