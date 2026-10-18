import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CREATE_EVENT_UNKNOWN,
  createEventUpstreamPath,
  interpretCreateEvent,
  interpretEventList,
} from '../src/admin/create-event';
import {
  CS_RESEND_COOLDOWN_SECONDS,
  CS_UNKNOWN,
  csProviderStatusLabel,
  csResendRejectedLabel,
  csViewLabel,
  formatCsTimelineItem,
  interpretCsDetail,
  interpretCsList,
  interpretCsResend,
  ticketDetailPath,
  ticketResendPath,
  ticketsListPath,
} from '../src/admin/cs';
import {
  exportDownloadPath,
  exportStatusPath,
  exportsCreatePath,
  interpretExportCreate,
  interpretExportDownload,
  interpretExportStatus,
} from '../src/admin/export-job';
import {
  interpretSourceCreate,
  interpretTicketTypeCreate,
  sourcesPath,
  ticketTypesPath,
} from '../src/admin/event-setup';

const scope = {
  tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  eventId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
};

const summary = {
  ticketId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  state: 'ISSUED',
  ticketTypeId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  sourceId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  createdAt: '2026-10-17T00:00:00.000Z',
  ownerEmailMasked: 'a***@example.com',
  lastCheckInAt: null,
  notification: null,
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

  it('fail-closed: rejects loose tickets/results aliases and 5xx', () => {
    assert.equal(interpretCsList(503, { items: [] }, false).kind, 'unknown');
    const net = interpretCsList(0, null, true);
    assert.equal(net.kind, 'unknown');
    if (net.kind === 'unknown') assert.equal(net.message, CS_UNKNOWN);
    assert.equal(
      interpretCsList(200, { tickets: [], nextCursor: null }, false).kind,
      'unknown',
    );
    const list = interpretCsList(
      200,
      { items: [summary], nextCursor: 'n' },
      false,
    );
    assert.equal(list.kind, 'list');
    if (list.kind === 'list') {
      assert.equal(list.items.length, 1);
      assert.equal(list.cursor, 'n');
      assert.equal(list.items[0]?.ownerEmailMasked, 'a***@example.com');
    }
  });

  it('detail requires timeline fields; rejects raw email keys', () => {
    const detail = interpretCsDetail(
      200,
      {
        ...summary,
        timeline: [
          { at: '2026-10-17T01:00:00.000Z', kind: 'issued', summary: 'issued' },
        ],
      },
      false,
      summary.ticketId,
    );
    assert.equal(detail.kind, 'detail');
    if (detail.kind === 'detail') {
      assert.equal(detail.ticket.timeline.length, 1);
    }
    assert.equal(
      interpretCsDetail(
        200,
        { ...summary, email: 'raw@example.com', timeline: [] },
        false,
        summary.ticketId,
      ).kind,
      'unknown',
    );
  });

  it('resend requires CsResendDto; does not accept ACCEPTED as success', () => {
    const resent = interpretCsResend(
      200,
      {
        operationId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        notificationId: '11111111-1111-4111-8111-111111111111',
        providerStatus: 'PENDING',
        replayed: false,
      },
      false,
      summary.ticketId,
    );
    assert.equal(resent.kind, 'resent');
    assert.equal(
      interpretCsResend(
        202,
        { status: 'ACCEPTED' },
        false,
        summary.ticketId,
      ).kind,
      'unknown',
    );
  });
});

describe('CS status / timeline / cooldown copy', () => {
  it('maps PENDING/FAILED/DEAD/ACCEPTED honestly; DELIVERED only when literal', () => {
    assert.match(csProviderStatusLabel('PENDING'), /PENDING/);
    assert.match(csProviderStatusLabel('FAILED'), /FAILED/);
    assert.match(csProviderStatusLabel('DEAD'), /DEAD/);
    const accepted = csProviderStatusLabel('ACCEPTED');
    assert.match(accepted, /ACCEPTED/);
    assert.equal(/đã giao tới người nhận/.test(accepted), true);
    assert.equal(/^ACCEPTED \(delivered\)$/i.test(accepted), false);
    assert.equal(/DELIVERED/.test(accepted), false);
    const delivered = csProviderStatusLabel('DELIVERED');
    assert.match(delivered, /^DELIVERED/);
    assert.match(delivered, /bằng chứng giao/);
  });

  it('formats timeline as time / action / result without inventing DELIVERED', () => {
    const row = formatCsTimelineItem({
      at: '2026-10-18T01:00:00.000Z',
      kind: 'notification.email',
      summary: 'notification ACCEPTED',
    });
    assert.equal(row.time, '2026-10-18T01:00:00.000Z');
    assert.match(row.action, /email/i);
    assert.match(row.result, /ACCEPTED/);
    assert.equal(/DELIVERED/.test(row.result), false);
    const checkin = formatCsTimelineItem({
      at: '2026-10-18T02:00:00.000Z',
      kind: 'checkin.confirmed',
      summary: 'check-in confirmed',
    });
    assert.match(checkin.action, /Check-in/i);
    assert.match(checkin.result, /xác nhận/i);
  });

  it('surfaces cooldown, limit, and permission denied for resend', () => {
    assert.equal(CS_RESEND_COOLDOWN_SECONDS, 60);
    assert.match(
      csResendRejectedLabel('RESEND_COOLDOWN', 'Resend cooldown active'),
      /RESEND_COOLDOWN/,
    );
    assert.match(
      csResendRejectedLabel('RESEND_COOLDOWN', 'x'),
      /60s/,
    );
    assert.match(csResendRejectedLabel('RESEND_LIMIT', 'x'), /RESEND_LIMIT/);
    assert.match(
      csResendRejectedLabel('PERMISSION_DENIED', 'no'),
      /PERMISSION_DENIED/,
    );
    assert.match(
      csResendRejectedLabel('PERMISSION_DENIED', 'no'),
      /cs\.lookup|cs\.resend/,
    );
    const view = interpretCsResend(
      429,
      { code: 'RESEND_COOLDOWN', message: 'Resend cooldown active' },
      false,
      summary.ticketId,
    );
    assert.equal(view.kind, 'rejected');
    if (view.kind === 'rejected') {
      assert.match(csViewLabel(view), /RESEND_COOLDOWN/);
      assert.match(csViewLabel(view), /chưa tạo vé mới/i);
    }
    const denied = interpretCsResend(
      403,
      { code: 'PERMISSION_DENIED', message: 'missing cs.resend' },
      false,
      summary.ticketId,
    );
    assert.equal(denied.kind, 'rejected');
    if (denied.kind === 'rejected') {
      assert.match(csViewLabel(denied), /PERMISSION_DENIED/);
    }
  });

  it('detail label includes delivery status without claiming DELIVERED from ACCEPTED', () => {
    const detail = interpretCsDetail(
      200,
      {
        ...summary,
        notification: {
          channel: 'email',
          state: 'ACCEPTED',
          providerStatus: 'ACCEPTED',
          providerRef: null,
          attempts: 1,
          lastError: null,
        },
        timeline: [
          {
            at: '2026-10-18T01:00:00.000Z',
            kind: 'notification.email',
            summary: 'notification ACCEPTED',
          },
        ],
      },
      false,
      summary.ticketId,
    );
    assert.equal(detail.kind, 'detail');
    if (detail.kind === 'detail') {
      const label = csViewLabel(detail);
      assert.match(label, /CS: chi tiết/);
      assert.match(label, /ACCEPTED/);
      assert.equal(/DELIVERED/.test(label), false);
    }
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

  it('requires ExportJobDto fields including expiresAt; rejects id alias', () => {
    assert.equal(
      interpretExportCreate(500, { exportId: 'x' }, false).kind,
      'unknown',
    );
    assert.equal(
      interpretExportCreate(
        201,
        { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', status: 'PENDING' },
        false,
      ).kind,
      'unknown',
    );
    const created = interpretExportCreate(
      201,
      {
        exportId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        status: 'PENDING',
        rowCount: null,
        expiresAt: null,
        error: null,
      },
      false,
    );
    assert.equal(created.kind, 'created');
    if (created.kind === 'created') {
      assert.equal(created.job.status, 'PENDING');
      assert.equal(created.job.expiresAt, null);
    }
    const status = interpretExportStatus(
      200,
      {
        exportId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        status: 'READY',
        rowCount: 2,
        expiresAt: '2026-10-18T00:00:00.000Z',
        error: null,
      },
      false,
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    );
    assert.equal(status.kind, 'status');
    if (status.kind === 'status') {
      assert.equal(status.job.expiresAt, '2026-10-18T00:00:00.000Z');
    }
  });

  it('download success is streamed CSV, not guessed URL JSON', () => {
    assert.equal(
      interpretExportDownload(
        200,
        { downloadUrl: 'https://example.invalid/x?sig=1' },
        false,
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'application/json',
      ).kind,
      'unknown',
    );
    const download = interpretExportDownload(
      200,
      null,
      false,
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'text/csv; charset=utf-8',
      42,
      'export.csv',
    );
    assert.equal(download.kind, 'download');
    if (download.kind === 'download') {
      assert.equal(download.byteLength, 42);
    }
  });
});

describe('create event / list / ticket type / source', () => {
  const eventDetail = {
    eventId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    tenantId: scope.tenantId,
    slug: 'aurora',
    name: 'Aurora Night',
    contentStatus: 'DRAFT',
    businessStatus: 'ACTIVE',
    visibility: 'UNLISTED',
    timezone: 'Asia/Ho_Chi_Minh',
    startsAt: null,
    endsAt: null,
    venue: null,
    contact: null,
    redemptionWindow: { opensAt: null, closesAt: null },
    checkInWindow: { opensAt: null, closesAt: null },
    revision: 1,
    maxTicketsPerAttendee: null,
  };

  it('maps create path and rejects incomplete success shapes', () => {
    assert.equal(
      createEventUpstreamPath(scope.tenantId),
      `/v1/tenants/${scope.tenantId}/events`,
    );
    assert.equal(
      interpretCreateEvent(201, { eventId: 'x', slug: 'a' }, false).kind,
      'unknown',
    );
    // Legacy status summary (pre-C-E) is fail-closed.
    assert.equal(
      interpretCreateEvent(
        201,
        {
          eventId: eventDetail.eventId,
          slug: 'aurora',
          name: 'Aurora Night',
          status: 'DRAFT',
          timezone: 'Asia/Ho_Chi_Minh',
        },
        false,
      ).kind,
      'unknown',
    );
    const ok = interpretCreateEvent(201, eventDetail, false);
    assert.equal(ok.kind, 'ok');
    const unclear = interpretCreateEvent(0, null, true);
    assert.equal(unclear.kind, 'unknown');
    if (unclear.kind === 'unknown') {
      assert.equal(unclear.message, CREATE_EVENT_UNKNOWN);
    }
  });

  it('lists events strictly from C-E EventDetail items[]', () => {
    const list = interpretEventList(
      200,
      {
        items: [eventDetail],
        nextCursor: null,
      },
      false,
    );
    assert.equal(list.kind, 'list');
  });

  it('ticket type and source paths + shapes', () => {
    assert.equal(
      ticketTypesPath(scope),
      `/v1/tenants/${scope.tenantId}/events/${scope.eventId}/ticket-types`,
    );
    assert.equal(
      sourcesPath(scope),
      `/v1/tenants/${scope.tenantId}/events/${scope.eventId}/sources`,
    );
    const tt = interpretTicketTypeCreate(
      200,
      { ticketTypeId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', label: 'GA' },
      false,
    );
    assert.equal(tt.kind, 'created');
    const src = interpretSourceCreate(
      200,
      {
        sourceId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        name: 'Invite',
        approvalMode: 'AUTO',
        ticketTypeId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      },
      false,
    );
    assert.equal(src.kind, 'created');
    assert.equal(
      interpretSourceCreate(200, { id: 'x', name: 'Invite' }, false).kind,
      'unknown',
    );
  });
});
