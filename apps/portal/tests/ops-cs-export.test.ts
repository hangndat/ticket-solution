import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  csProviderStatusLabel,
  interpretCsDetail,
  interpretCsList,
  interpretCsResend,
  ticketsListPath,
} from '../src/ops/cs';
import {
  exportDownloadPath,
  exportsCreatePath,
  interpretExportCreate,
  interpretExportDownload,
  interpretExportStatus,
} from '../src/ops/export-job';
import { decideAdmin } from '../src/ops/decide';

const scope = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  eventId: '22222222-2222-4222-8222-222222222222',
};
const ticketId = '33333333-3333-4333-8333-333333333333';
const exportId = '44444444-4444-4444-8444-444444444444';

describe('portal CS / export / decide helpers', () => {
  it('labels ACCEPTED ≠ delivered', () => {
    assert.match(csProviderStatusLabel('ACCEPTED'), /≠ đã giao/);
    assert.doesNotMatch(csProviderStatusLabel('ACCEPTED'), /đã giao tới người nhận\)\./);
  });

  it('lists CS tickets and detail timeline; resend requires PENDING', () => {
    assert.match(ticketsListPath(scope, { q: ticketId, limit: 10 }), /q=/);
    const list = interpretCsList(
      200,
      {
        items: [
          {
            ticketId,
            state: 'ACTIVE',
            ticketTypeId: '66666666-6666-4666-8666-666666666666',
            sourceId: '55555555-5555-4555-8555-555555555555',
            createdAt: '2026-01-01T00:00:00.000Z',
            ownerEmailMasked: 'a***@example.com',
            lastCheckInAt: null,
            notification: null,
          },
        ],
        nextCursor: null,
      },
      false,
    );
    assert.equal(list.kind, 'list');

    const detail = interpretCsDetail(
      200,
      {
        ticketId,
        state: 'ACTIVE',
        ticketTypeId: '66666666-6666-4666-8666-666666666666',
        sourceId: '55555555-5555-4555-8555-555555555555',
        createdAt: '2026-01-01T00:00:00.000Z',
        ownerEmailMasked: 'a***@example.com',
        lastCheckInAt: null,
        notification: null,
        timeline: [{ at: '2026-01-01T00:00:00.000Z', kind: 'ISSUED', summary: 'ok' }],
      },
      false,
      ticketId,
    );
    assert.equal(detail.kind, 'detail');

    const resent = interpretCsResend(
      200,
      {
        operationId: 'op-1',
        notificationId: '55555555-5555-4555-8555-555555555555',
        providerStatus: 'PENDING',
        replayed: false,
      },
      false,
      ticketId,
    );
    assert.equal(resent.kind, 'resent');

    const acceptedAlone = interpretCsResend(
      200,
      {
        operationId: 'op-1',
        notificationId: '55555555-5555-4555-8555-555555555555',
        providerStatus: 'ACCEPTED',
        replayed: false,
      },
      false,
      ticketId,
    );
    assert.equal(acceptedAlone.kind, 'unknown');
  });

  it('export create/status/download; rejects downloadUrl JSON', () => {
    assert.match(exportsCreatePath(scope), /\/exports$/);
    assert.match(exportDownloadPath(scope, exportId), /\/download$/);

    const created = interpretExportCreate(
      201,
      {
        exportId,
        status: 'PENDING',
        rowCount: null,
        expiresAt: null,
        error: null,
        replayed: false,
      },
      false,
    );
    assert.equal(created.kind, 'created');

    const status = interpretExportStatus(
      200,
      {
        exportId,
        status: 'READY',
        rowCount: 3,
        expiresAt: '2026-01-02T00:00:00.000Z',
        error: null,
        replayed: false,
      },
      false,
      exportId,
    );
    assert.equal(status.kind, 'status');

    const download = interpretExportDownload(
      200,
      null,
      false,
      exportId,
      'text/csv',
      12,
      'export.csv',
    );
    assert.equal(download.kind, 'download');

    const fakeUrl = interpretExportDownload(
      200,
      { downloadUrl: 'https://evil.example/x' },
      false,
      exportId,
      'application/json',
    );
    assert.equal(fakeUrl.kind, 'unknown');
  });

  it('decideAdmin approve/deny unknown on 5xx', () => {
    const ok = decideAdmin(
      'approve',
      200,
      {
        decision: 'approve',
        requestId: ticketId,
        status: 'ISSUED',
        ticketId,
        operationId: 'op',
        ownerUserId: 'u',
        replayed: false,
      },
      false,
    );
    assert.equal(ok.kind, 'approved');

    const unknown = decideAdmin('deny', 503, null, false);
    assert.equal(unknown.kind, 'unknown');
  });
});
