import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CREATE_EVENT_UNKNOWN,
  createEventUpstreamPath,
  interpretCreateEvent,
} from '../src/admin/create-event';
import {
  CS_UNKNOWN,
  interpretCsDetail,
  interpretCsList,
  interpretCsResend,
  ticketDetailPath,
  ticketResendPath,
  ticketsListPath,
} from '../src/admin/cs';
import {
  EXPORT_UNKNOWN,
  exportDownloadPath,
  exportStatusPath,
  exportsCreatePath,
  interpretExportCreate,
  interpretExportDownload,
  interpretExportStatus,
} from '../src/admin/export-job';

const scope = {
  tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  eventId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
};

describe('CS paths and interpreters', () => {
  it('builds list/detail/resend paths with query', () => {
    assert.equal(
      ticketsListPath(scope, { q: 'a@b.c', limit: 20, cursor: 'c1' }),
      `/v1/tenants/${scope.tenantId}/events/${scope.eventId}/tickets?q=a%40b.c&limit=20&cursor=c1`,
    );
    assert.equal(
      ticketDetailPath(scope, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
      `/v1/tenants/${scope.tenantId}/events/${scope.eventId}/tickets/cccccccc-cccc-4ccc-8ccc-cccccccccccc`,
    );
    assert.equal(
      ticketResendPath(scope, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
      `/v1/tenants/${scope.tenantId}/events/${scope.eventId}/tickets/cccccccc-cccc-4ccc-8ccc-cccccccccccc/resend`,
    );
  });

  it('treats 5xx and network as unknown; accepts loose list shapes', () => {
    assert.equal(interpretCsList(503, { tickets: [] }, false).kind, 'unknown');
    const net = interpretCsList(0, null, true);
    assert.equal(net.kind, 'unknown');
    if (net.kind === 'unknown') assert.equal(net.message, CS_UNKNOWN);
    const list = interpretCsList(
      200,
      { items: [{ id: '1' }], nextCursor: 'n' },
      false,
    );
    assert.equal(list.kind, 'list');
    if (list.kind === 'list') {
      assert.equal(list.items.length, 1);
      assert.equal(list.cursor, 'n');
    }
  });

  it('does not treat ACCEPTED resend as delivered', () => {
    const resent = interpretCsResend(
      202,
      { status: 'ACCEPTED' },
      false,
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    );
    assert.equal(resent.kind, 'resent');
    if (resent.kind === 'resent') {
      assert.equal(resent.providerStatus, 'ACCEPTED');
    }
    assert.equal(
      interpretCsDetail(500, { id: 'x' }, false, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')
        .kind,
      'unknown',
    );
  });
});

describe('export paths and interpreters', () => {
  it('builds create/status/download paths', () => {
    assert.equal(
      exportsCreatePath(scope),
      `/v1/tenants/${scope.tenantId}/events/${scope.eventId}/exports`,
    );
    assert.equal(
      exportStatusPath(scope, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
      `/v1/tenants/${scope.tenantId}/events/${scope.eventId}/exports/dddddddd-dddd-4ddd-8ddd-dddddddddddd`,
    );
    assert.equal(
      exportDownloadPath(scope, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
      `/v1/tenants/${scope.tenantId}/events/${scope.eventId}/exports/dddddddd-dddd-4ddd-8ddd-dddddddddddd/download`,
    );
  });

  it('creates and status loosely; 5xx unknown', () => {
    assert.equal(
      interpretExportCreate(500, { exportId: 'x' }, false).kind,
      'unknown',
    );
    const net = interpretExportCreate(0, null, true);
    assert.equal(net.kind, 'unknown');
    if (net.kind === 'unknown') assert.equal(net.message, EXPORT_UNKNOWN);
    const created = interpretExportCreate(
      201,
      { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', status: 'PENDING' },
      false,
    );
    assert.equal(created.kind, 'created');
    const status = interpretExportStatus(
      200,
      { status: 'READY' },
      false,
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    );
    assert.equal(status.kind, 'status');
    const download = interpretExportDownload(
      200,
      { downloadUrl: 'https://example.invalid/x?sig=1' },
      false,
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'application/json',
    );
    assert.equal(download.kind, 'download');
    if (download.kind === 'download') {
      assert.ok(download.href?.includes('example.invalid'));
    }
  });
});

describe('create event interpreter', () => {
  it('maps path and 404 unavailable without claiming success', () => {
    assert.equal(
      createEventUpstreamPath(scope.tenantId),
      `/v1/tenants/${scope.tenantId}/events`,
    );
    const missing = interpretCreateEvent(404, { message: 'nope' }, false);
    assert.equal(missing.kind, 'rejected');
    if (missing.kind === 'rejected') {
      assert.equal(missing.code, 'EVENT_CREATE_UNAVAILABLE');
    }
    const net = interpretCreateEvent(0, null, true);
    assert.equal(net.kind, 'unknown');
    if (net.kind === 'unknown') assert.equal(net.message, CREATE_EVENT_UNKNOWN);
    const ok = interpretCreateEvent(
      201,
      {
        eventId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        slug: 'aurora',
        name: 'Aurora Night',
      },
      false,
    );
    assert.equal(ok.kind, 'created');
  });
});
