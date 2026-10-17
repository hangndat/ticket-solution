import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  IMPORT_ERROR_CODES,
  IMPORT_LIMITS,
  type ImportCommitResponse,
  type ImportJob,
  type ImportPreviewResponse,
} from '@ticket/contracts';
import {
  csvTemplateForKind,
  extractRawCodesFromCsv,
  importCommitPath,
  importErrorsPath,
  importJobPath,
  importPreviewPath,
  importViewLabel,
  importsCreatePath,
  importsUploadPath,
  interpretImportCommit,
  interpretImportCreate,
  interpretImportErrorsDownload,
  interpretImportPreview,
  interpretImportStatus,
  interpretImportUpload,
  parseCsvForImport,
} from '../src/admin/import-job';
import {
  invitationDispatchPath,
  invitationDispatchPreviewPath,
  invitationsPath,
  interpretDispatch,
  interpretDispatchPreview,
  interpretInvitationList,
} from '../src/admin/invitation';
import { sanitizePostLoginPath } from '../src/oidc/post-login';

const scope = {
  tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  eventId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
};

const importId = '44444444-4444-4444-8444-444444444444';
const sourceId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const ticketTypeId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const job: ImportJob = {
  importId,
  kind: 'CODES',
  status: 'PREVIEW_READY',
  sourceId,
  ticketTypeId,
  fileHash: 'sha256:deadbeef',
  mappingRevision: 1,
  previewRevision: 1,
  validRowCount: 98,
  errorRowCount: 2,
  invitationCount: 0,
  estimatedQuota: 98,
};

const preview: ImportPreviewResponse = {
  importId,
  previewRevision: 1,
  mappingRevision: 1,
  fileHash: 'sha256:deadbeef',
  validRowCount: 98,
  errorRowCount: 2,
  invitationCount: 0,
  estimatedQuota: 98,
  sampleErrors: [
    {
      fieldId: 'row:3:code',
      code: 'DUPLICATE_IN_EVENT',
      message: 'Duplicate code in event',
    },
  ],
};

const commit: ImportCommitResponse = {
  importId,
  status: 'COMPLETED',
  committedRowCount: 98,
  skippedRowCount: 0,
  errorRowCount: 2,
  invitationCount: 0,
  replayed: false,
};

describe('C-I import paths and CSV helpers', () => {
  it('builds import/invitation upstream paths', () => {
    assert.equal(
      importsCreatePath(scope),
      `/v1/tenants/${scope.tenantId}/events/${scope.eventId}/imports`,
    );
    assert.equal(
      importsUploadPath(scope),
      `/v1/tenants/${scope.tenantId}/events/${scope.eventId}/imports/files`,
    );
    assert.equal(
      importPreviewPath(scope, importId),
      `/v1/tenants/${scope.tenantId}/events/${scope.eventId}/imports/${importId}/preview`,
    );
    assert.equal(
      importCommitPath(scope, importId),
      `/v1/tenants/${scope.tenantId}/events/${scope.eventId}/imports/${importId}/commit`,
    );
    assert.equal(
      importErrorsPath(scope, importId),
      `/v1/tenants/${scope.tenantId}/events/${scope.eventId}/imports/${importId}/errors`,
    );
    assert.equal(importJobPath(scope, importId).endsWith(importId), true);
    assert.equal(
      invitationDispatchPreviewPath(scope),
      `/v1/tenants/${scope.tenantId}/events/${scope.eventId}/invitations/dispatch-preview`,
    );
    assert.equal(
      invitationDispatchPath(scope),
      `/v1/tenants/${scope.tenantId}/events/${scope.eventId}/invitations/dispatch`,
    );
    assert.ok(invitationsPath(scope, { limit: 20 }).includes('limit=20'));
  });

  it('templates and parseCsv gate UTF-8 / mapping / row cap without writing data', () => {
    assert.ok(csvTemplateForKind('CODES').startsWith('code'));
    assert.ok(csvTemplateForKind('GUESTS').startsWith('email'));
    const ok = parseCsvForImport({
      kind: 'CODES',
      text: 'code\nA1\nA2\n',
    });
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.rowCount, 2);
      assert.equal(ok.mapping.code, 'code');
    }
    const guests = parseCsvForImport({
      kind: 'GUESTS',
      text: 'email\na@example.com\n',
    });
    assert.equal(guests.ok, true);

    const missing = parseCsvForImport({
      kind: 'CODES',
      text: 'wrong\nx\n',
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.code, IMPORT_ERROR_CODES.IMPORT_FILE_INVALID);
    }

    const hugeRows = `code\n${Array.from({ length: IMPORT_LIMITS.maxRows + 1 }, (_, i) => `c${i}`).join('\n')}\n`;
    const over = parseCsvForImport({ kind: 'CODES', text: hugeRows });
    assert.equal(over.ok, false);
    if (!over.ok) {
      assert.equal(over.code, IMPORT_ERROR_CODES.IMPORT_ROW_LIMIT);
    }

    const legacy = extractRawCodesFromCsv('code\nX\nY\n', 'code');
    assert.ok(Array.isArray(legacy));
    if (Array.isArray(legacy)) assert.deepEqual(legacy, ['X', 'Y']);
  });

  it('interpreters: create/preview/commit/status fail-closed; preview shows quota estimate not reserve', () => {
    assert.equal(interpretImportCreate(503, job, false).kind, 'unknown');
    assert.equal(interpretImportCreate(0, null, true).kind, 'unknown');
    const created = interpretImportCreate(201, job, false);
    assert.equal(created.kind, 'job');
    if (created.kind === 'job') {
      assert.equal(created.job.estimatedQuota, 98);
      assert.equal(created.job.status, 'PREVIEW_READY');
    }
    // Raw token / email leakage rejected
    assert.equal(
      interpretImportCreate(
        201,
        { ...job, token: 'secret-token' },
        false,
      ).kind,
      'unknown',
    );

    const prev = interpretImportPreview(200, preview, false);
    assert.equal(prev.kind, 'preview');
    if (prev.kind === 'preview') {
      assert.equal(prev.preview.sampleErrors.length, 1);
      assert.ok(importViewLabel(prev).includes('không reserve'));
    }
    assert.equal(
      interpretImportPreview(409, {
        code: IMPORT_ERROR_CODES.IMPORT_STALE_PREVIEW,
        message: 'stale',
      }, false).kind,
      'rejected',
    );

    const committed = interpretImportCommit(200, commit, false);
    assert.equal(committed.kind, 'commit');
    const replay = interpretImportCommit(
      200,
      { ...commit, replayed: true },
      false,
    );
    assert.equal(replay.kind, 'commit');
    if (replay.kind === 'commit') assert.equal(replay.commit.replayed, true);

    assert.equal(interpretImportStatus(200, job, false).kind, 'job');
    assert.equal(
      interpretImportUpload(201, {
        fileId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        fileHash: 'sha256:abc',
        byteLength: 12,
      }, false).kind,
      'upload',
    );
  });

  it('private error download: csv ok; wrong-tenant/expired rejected; json url not success', () => {
    const dl = interpretImportErrorsDownload(
      200,
      null,
      false,
      importId,
      'text/csv; charset=utf-8',
      40,
      'errors.csv',
    );
    assert.equal(dl.kind, 'errors');

    assert.equal(
      interpretImportErrorsDownload(
        200,
        { downloadUrl: 'https://evil.example/x' },
        false,
        importId,
        'application/json',
      ).kind,
      'unknown',
    );

    const forbidden = interpretImportErrorsDownload(
      403,
      { code: 'FORBIDDEN', message: 'no' },
      false,
      importId,
      'application/json',
    );
    assert.equal(forbidden.kind, 'rejected');
    if (forbidden.kind === 'rejected') assert.equal(forbidden.code, 'FORBIDDEN');

    const expired = interpretImportErrorsDownload(
      410,
      null,
      false,
      importId,
      'application/json',
    );
    assert.equal(expired.kind, 'rejected');
    if (expired.kind === 'rejected') {
      assert.equal(expired.code, 'IMPORT_ERROR_REPORT_EXPIRED');
    }
  });
});

describe('C-I invitation dispatch interpreters', () => {
  it('list masks email; rejects raw email/token; dispatch preview does not reserve', () => {
    const list = interpretInvitationList(
      200,
      {
        items: [
          {
            invitationId: '11111111-1111-4111-8111-111111111111',
            eventId: scope.eventId,
            sourceId,
            ticketTypeId,
            invitedEmailMasked: 'a***@example.com',
            state: 'PENDING',
            expiresAt: '2026-10-19T00:00:00.000Z',
          },
        ],
        nextCursor: null,
      },
      false,
    );
    assert.equal(list.kind, 'list');
    if (list.kind === 'list') {
      assert.equal(list.items[0]?.invitedEmailMasked, 'a***@example.com');
    }
    assert.equal(
      interpretInvitationList(
        200,
        {
          items: [
            {
              invitationId: '11111111-1111-4111-8111-111111111111',
              eventId: scope.eventId,
              sourceId,
              ticketTypeId,
              invitedEmailMasked: 'a***@example.com',
              invitedEmail: 'raw@example.com',
              state: 'PENDING',
              expiresAt: '2026-10-19T00:00:00.000Z',
            },
          ],
          nextCursor: null,
        },
        false,
      ).kind,
      'unknown',
    );

    const dp = interpretDispatchPreview(
      200,
      { previewRevision: 1, selectedCount: 10, estimatedQuota: 10 },
      false,
    );
    assert.equal(dp.kind, 'dispatch_preview');

    const dispatched = interpretDispatch(
      200,
      { dispatchedCount: 10, previewRevision: 1, replayed: false },
      false,
    );
    assert.equal(dispatched.kind, 'dispatch');
    assert.equal(interpretDispatch(503, {}, false).kind, 'unknown');
  });
});

describe('post-login return allowlist', () => {
  it('allows /claim and rejects open redirects', () => {
    assert.equal(sanitizePostLoginPath('/claim'), '/claim');
    assert.equal(sanitizePostLoginPath('/invite'), '/invite');
    assert.equal(sanitizePostLoginPath('https://evil.example'), null);
    assert.equal(sanitizePostLoginPath('//evil.example'), null);
    assert.equal(sanitizePostLoginPath('/claim?token=x'), '/claim');
    assert.equal(sanitizePostLoginPath('/not-allowed'), null);
  });
});
