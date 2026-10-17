import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  EVENT_REPORT_OPENAPI_PATH,
  REPORT_UNKNOWN,
  formatQuotaCapacityState,
  formatQuotaRemaining,
  interpretEventReport,
  reportShowsNumbers,
  reportUpstreamPath,
} from '../src/admin/report';

const current = {
  eventId: '22222222-2222-4222-8222-222222222222',
  ticketsByState: { ACTIVE: 4, REVOKED: 1, CANCELLED: 0, USED: 2 },
  quota: { capacity: 10, allocated: 7 },
  quotaRemaining: 3,
  quotaCapacityState: 'FINITE' as const,
  pendingApprovalCount: 3,
  checkInSuccessCount: 2,
  rejectByReason: { ALREADY_CHECKED_IN: 1, TICKET_NOT_ACTIVE: 2 },
  emailNeedsCsCount: 1,
  asOf: '2026-10-18T01:00:00.000Z',
};

describe('interpretEventReport', () => {
  it('shows O12 counts only for a complete 200', () => {
    const shown = interpretEventReport(200, current, false);
    assert.equal(reportShowsNumbers(shown), true);
    assert.deepEqual(shown, {
      kind: 'shown',
      ticketsByState: { ACTIVE: 4, REVOKED: 1, CANCELLED: 0, USED: 2 },
      quota: { capacity: 10, allocated: 7 },
      quotaRemaining: 3,
      quotaCapacityState: 'FINITE',
      pendingApprovalCount: 3,
      checkInSuccessCount: 2,
      rejectByReason: { ALREADY_CHECKED_IN: 1, TICKET_NOT_ACTIVE: 2 },
      emailNeedsCsCount: 1,
      asOf: '2026-10-18T01:00:00.000Z',
    });
    assert.deepEqual(
      interpretEventReport(
        200,
        {
          ...current,
          quota: { capacity: null, allocated: 0 },
          quotaRemaining: null,
          quotaCapacityState: 'UNLIMITED',
          rejectByReason: {},
          emailNeedsCsCount: 0,
          checkInSuccessCount: 0,
        },
        false,
      ),
      {
        kind: 'shown',
        ticketsByState: current.ticketsByState,
        quota: { capacity: null, allocated: 0 },
        quotaRemaining: null,
        quotaCapacityState: 'UNLIMITED',
        pendingApprovalCount: 3,
        checkInSuccessCount: 0,
        rejectByReason: {},
        emailNeedsCsCount: 0,
        asOf: current.asOf,
      },
    );
    assert.equal(
      interpretEventReport(
        200,
        {
          ...current,
          quota: { capacity: null, allocated: 0 },
          quotaRemaining: null,
          quotaCapacityState: 'MISSING_BUCKET',
        },
        false,
      ).kind,
      'shown',
    );
  });

  it('rejects FINITE without remaining and non-null remaining for UNLIMITED', () => {
    assert.equal(
      interpretEventReport(
        200,
        { ...current, quotaRemaining: null, quotaCapacityState: 'FINITE' },
        false,
      ).kind,
      'unknown',
    );
    assert.equal(
      interpretEventReport(
        200,
        {
          ...current,
          quota: { capacity: null, allocated: 0 },
          quotaRemaining: 0,
          quotaCapacityState: 'UNLIMITED',
        },
        false,
      ).kind,
      'unknown',
    );
  });

  it('treats status >= 500, status 0, and network errors as unknown without counts', () => {
    const stale = {
      ...current,
      ticketsByState: { ACTIVE: 917, REVOKED: 918, CANCELLED: 919, USED: 920 },
      quota: { capacity: 921, allocated: 922 },
      quotaRemaining: 924,
      pendingApprovalCount: 923,
      checkInSuccessCount: 925,
      emailNeedsCsCount: 926,
      attendeeEmail: 'guest@example.test',
    };
    for (const view of [
      interpretEventReport(500, stale, false),
      interpretEventReport(503, stale, false),
      interpretEventReport(0, stale, false),
      interpretEventReport(200, stale, true),
    ]) {
      assert.equal(view.kind, 'unknown');
      assert.equal(reportShowsNumbers(view), false);
      assert.equal(view.kind === 'unknown' ? view.message : '', REPORT_UNKNOWN);
      const encoded = JSON.stringify(view);
      assert.equal(encoded.includes('917'), false);
      assert.equal(encoded.includes('923'), false);
      assert.equal(encoded.includes('925'), false);
      assert.equal(encoded.includes('guest@example.test'), false);
    }
  });

  it('does not show numbers for a partial 200 or a 4xx body that includes counts', () => {
    const partial = interpretEventReport(
      200,
      { ticketsByState: { ACTIVE: 4 }, pendingApprovalCount: 1 },
      false,
    );
    assert.equal(partial.kind, 'unknown');
    assert.equal(JSON.stringify(partial).includes('4'), false);

    const missingO12 = interpretEventReport(
      200,
      {
        eventId: current.eventId,
        ticketsByState: current.ticketsByState,
        quota: current.quota,
        pendingApprovalCount: 3,
      },
      false,
    );
    assert.equal(missingO12.kind, 'unknown');

    const rejected = interpretEventReport(
      404,
      {
        code: 'EVENT_NOT_FOUND',
        message: 'Event not found',
        ticketsByState: current.ticketsByState,
        pendingApprovalCount: 88,
        checkInSuccessCount: 77,
        attendeeEmail: 'guest@example.test',
      },
      false,
    );
    assert.deepEqual(rejected, {
      kind: 'rejected',
      code: 'EVENT_NOT_FOUND',
      message: 'Event not found',
    });
    assert.equal(reportShowsNumbers(rejected), false);
    assert.equal(JSON.stringify(rejected).includes('88'), false);
    assert.equal(JSON.stringify(rejected).includes('77'), false);
    assert.equal(
      JSON.stringify(rejected).includes('guest@example.test'),
      false,
    );
  });

  it('formats VI quota labels without inventing remaining 0', () => {
    assert.equal(formatQuotaCapacityState('FINITE'), 'Hữu hạn');
    assert.equal(formatQuotaCapacityState('UNLIMITED'), 'Không giới hạn');
    assert.equal(formatQuotaCapacityState('MISSING_BUCKET'), 'Chưa có bucket');
    assert.equal(formatQuotaRemaining(3, 'FINITE'), '3');
    assert.equal(formatQuotaRemaining(null, 'UNLIMITED'), 'không áp dụng');
    assert.equal(formatQuotaRemaining(null, 'MISSING_BUCKET'), 'không áp dụng');
  });

  it('forwards the OpenAPI report path and required O12 fields', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
    const openapi = JSON.parse(
      readFileSync(join(root, 'apps/api/openapi.json'), 'utf8'),
    ) as {
      paths: Record<string, { get?: { operationId?: string } }>;
      components: {
        schemas: {
          EventReportDto: { required?: string[] };
        };
      };
    };
    assert.equal(
      openapi.paths[EVENT_REPORT_OPENAPI_PATH]?.get?.operationId,
      'ReportController_report',
    );
    for (const field of [
      'quotaRemaining',
      'quotaCapacityState',
      'checkInSuccessCount',
      'rejectByReason',
      'emailNeedsCsCount',
      'asOf',
    ]) {
      assert.ok(
        openapi.components.schemas.EventReportDto.required?.includes(field),
        `OpenAPI EventReportDto must require ${field}`,
      );
    }
    assert.equal(
      reportUpstreamPath({
        tenantId: '11111111-1111-4111-8111-111111111111',
        eventId: '22222222-2222-4222-8222-222222222222',
      }),
      '/v1/tenants/11111111-1111-4111-8111-111111111111/events/22222222-2222-4222-8222-222222222222/report',
    );
  });
});
