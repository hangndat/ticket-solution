import {
  accountFor,
  expect,
  fixtureFor,
  loadManifest,
  test,
} from '../harness/fixtures';
import type {
  CaseFixture,
  E2EManifest,
  TestAccount,
} from '../harness/contract';
import { bffGet, eventBff, eventPath, login, portalUrl } from './helpers';

/**
 * PORT-08 O12 state journey (Issue #1035).
 *
 * The Portal dashboard is read-only by design (no scan/confirm/undo buttons).
 * Gate confirm/undo/reject therefore run through the real API HTTP surface with
 * a real Keycloak staff token, while the browser dashboard reads the same
 * event-scoped snapshot through the Portal BFF. The existing portal-core
 * PORT-08 specs keep the seed/asOf/fault/deep-link assertions; this file only
 * adds the mutation journey (confirm APPLIED -> undo -> denial) and the
 * event/tenant boundary.
 */

type TicketStateCounts = {
  ACTIVE: number;
  REVOKED: number;
  CANCELLED: number;
  USED: number;
};

type EventReport = {
  eventId: string;
  ticketsByState: TicketStateCounts;
  quota: { capacity: number | null; allocated: number };
  quotaRemaining: number | null;
  quotaCapacityState: 'FINITE' | 'UNLIMITED' | 'MISSING_BUCKET';
  pendingApprovalCount: number;
  checkInSuccessCount: number;
  rejectByReason: Record<string, number>;
  emailNeedsCsCount: number;
  asOf: string;
};

type AuditItem = {
  action: string;
  resourceType: string;
  resourceId: string | null;
};

function required<T>(value: T | undefined | null, label: string): T {
  if (value === undefined || value === null || value === '') {
    throw new Error(`BLOCKED: PORT-08 fixture missing ${label}`);
  }
  return value;
}

function apiUrl(m: E2EManifest, path: string): string {
  return new URL(`/v1${path}`, m.origins.api).toString();
}

async function apiJson(
  m: E2EManifest,
  token: string,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
) {
  const response = await fetch(apiUrl(m, path), {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    /* non-JSON failure stays observable by status */
  }
  return { status: response.status, json };
}

/**
 * Real confidential password grant from the run realm (same `e2e-http`
 * client/audience the HTTP harness uses). No fabricated JWT or auth mock.
 */
async function mintStaffToken(
  m: E2EManifest,
  account: TestAccount,
): Promise<string> {
  const clientId = required(
    m.runtime?.httpClientId as string | undefined,
    'runtime.httpClientId',
  );
  const clientSecret = required(
    m.runtime?.httpClientSecret as string | undefined,
    'runtime.httpClientSecret',
  );
  const response = await fetch(
    new URL(
      `/realms/e2e-${m.runId}/protocol/openid-connect/token`,
      m.origins.auth,
    ),
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: clientId,
        client_secret: clientSecret,
        username: required(account.username, 'owner.username'),
        password: required(account.password, 'owner.password'),
        scope: 'openid profile email',
      }),
    },
  );
  if (response.status !== 200) {
    throw new Error(
      `BLOCKED: PORT-08 Keycloak staff grant failed (${response.status})`,
    );
  }
  const payload = (await response.json()) as { access_token?: string };
  return required(payload.access_token, 'owner access_token');
}

async function readReport(
  page: import('playwright/test').Page,
  m: E2EManifest,
  f: CaseFixture,
): Promise<EventReport> {
  const response = await bffGet(page, m, eventBff(f, '/report'));
  expect(response.status).toBe(200);
  return response.json as EventReport;
}

/** Fields O12 must keep stable across confirm/undo (no side mutation). */
function stableKpi(report: EventReport) {
  return {
    pendingApprovalCount: report.pendingApprovalCount,
    emailNeedsCsCount: report.emailNeedsCsCount,
    quota: report.quota,
    quotaRemaining: report.quotaRemaining,
    quotaCapacityState: report.quotaCapacityState,
    revoked: report.ticketsByState.REVOKED,
    cancelled: report.ticketsByState.CANCELLED,
  };
}

/** Fourth StatisticCard in the compact group is O12 check-in success. */
function checkInKpi(page: import('playwright/test').Page) {
  return page
    .locator('.portal-gate-report-compact .ant-statistic')
    .nth(3)
    .locator('.ant-statistic-content');
}

async function refreshDashboard(
  page: import('playwright/test').Page,
  m: E2EManifest,
) {
  const refreshed = page.waitForResponse(
    (r) =>
      r.url().includes('/report') &&
      r.request().method() === 'GET' &&
      r.status() === 200,
  );
  await page
    .getByRole('button', { name: /Làm mới|Refresh/i })
    .first()
    .click();
  await refreshed;
}

test('[PORT-08] Gate confirm APPLIED then undo drives dashboard KPI and audit', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-08');
  const ticketId = required(f.ticketId, 'ticketId');
  const seeded = f.data?.report as EventReport | undefined;
  if (!seeded) throw new Error('BLOCKED: PORT-08 report fixture missing');

  const owner = accountFor(m, 'PORT-08', 'owner');
  const token = await mintStaffToken(m, owner);

  const session = await apiJson(
    m,
    token,
    'POST',
    `/gate/events/${f.eventId}/sessions`,
    { tenantId: f.tenantId },
  );
  expect(session.status).toBe(200);
  const staffSessionId = (session.json as { sessionId?: string }).sessionId;
  if (!staffSessionId) {
    throw new Error('BLOCKED: PORT-08 staff session id missing');
  }

  await login(page, m, 'PORT-08', 'owner');
  await page.goto(portalUrl(m, eventPath(f, '/gate')));
  await expect(page.getByTestId('event-report-as-of')).toBeVisible();

  const before = await readReport(page, m, f);
  expect(before.eventId).toBe(f.eventId);
  // Anchor on the seeded snapshot; the deeper seed/asOf/fault assertions stay
  // in portal-core so this journey does not duplicate them.
  expect(before.checkInSuccessCount).toBe(seeded.checkInSuccessCount);
  const baseline = {
    checkInSuccessCount: before.checkInSuccessCount,
    active: before.ticketsByState.ACTIVE,
    used: before.ticketsByState.USED,
    stable: stableKpi(before),
    rejectByReason: before.rejectByReason,
  };
  await expect(checkInKpi(page)).toContainText(
    String(baseline.checkInSuccessCount),
  );

  let checkinId: string | undefined;
  let undone = false;
  let reservationId: string | undefined;
  let reservationToken: string | undefined;

  try {
    const reservation = await apiJson(
      m,
      token,
      'POST',
      `/gate/events/${f.eventId}/reservations`,
      { tenantId: f.tenantId, ticketId, staffSessionId },
    );
    expect(reservation.status).toBe(200);
    const held = reservation.json as {
      reservationId: string;
      token: string;
      ticketId: string;
    };
    reservationId = held.reservationId;
    reservationToken = held.token;
    expect(held.ticketId).toBe(ticketId);

    const confirmed = await apiJson(
      m,
      token,
      'POST',
      `/gate/events/${f.eventId}/reservations/${reservationId}/confirm`,
      {
        tenantId: f.tenantId,
        token: reservationToken,
        staffSessionId,
      },
    );
    expect(confirmed.status).toBe(200);
    const applied = confirmed.json as {
      checkinId: string;
      ticketId: string;
      state: string;
    };
    // Gate success contract (O12 counts the Gate confirm, not ticket.state alone).
    expect(applied.state).toBe('USED');
    expect(applied.ticketId).toBe(ticketId);
    checkinId = applied.checkinId;

    await refreshDashboard(page, m);
    await expect(checkInKpi(page)).toContainText(
      String(baseline.checkInSuccessCount + 1),
    );
    const afterConfirm = await readReport(page, m, f);
    expect(afterConfirm.checkInSuccessCount).toBe(
      baseline.checkInSuccessCount + 1,
    );
    expect(afterConfirm.ticketsByState.USED).toBe(baseline.used + 1);
    expect(afterConfirm.ticketsByState.ACTIVE).toBe(baseline.active - 1);
    expect(stableKpi(afterConfirm)).toEqual(baseline.stable);
    expect(afterConfirm.rejectByReason).toEqual(baseline.rejectByReason);
    expect(Date.parse(afterConfirm.asOf)).toBeGreaterThanOrEqual(
      Date.parse(before.asOf),
    );

    // Reject while the ticket is USED: denial must not add a check-in.
    const rejected = await apiJson(
      m,
      token,
      'POST',
      `/gate/events/${f.eventId}/reservations`,
      { tenantId: f.tenantId, ticketId, staffSessionId },
    );
    expect(rejected.status).toBe(409);
    expect((rejected.json as { code?: string }).code).toBe('TICKET_NOT_ACTIVE');
    const afterReject = await readReport(page, m, f);
    expect(afterReject.checkInSuccessCount).toBe(
      baseline.checkInSuccessCount + 1,
    );
    expect(afterReject.rejectByReason).toEqual({ TICKET_NOT_ACTIVE: 1 });
    expect(stableKpi(afterReject)).toEqual(baseline.stable);

    const undo = await apiJson(
      m,
      token,
      'POST',
      `/gate/events/${f.eventId}/checkins/${checkinId}/undo`,
      { tenantId: f.tenantId, reason: 'PORT-08 supervisor undo' },
    );
    expect([200, 201]).toContain(undo.status);
    const undoneResult = undo.json as { checkinId: string; state: string };
    expect(undoneResult.checkinId).toBe(checkinId);
    expect(undoneResult.state).toBe('ACTIVE');
    undone = true;

    await refreshDashboard(page, m);
    await expect(checkInKpi(page)).toContainText(
      String(baseline.checkInSuccessCount),
    );
    const afterUndo = await readReport(page, m, f);
    expect(afterUndo.checkInSuccessCount).toBe(baseline.checkInSuccessCount);
    expect(afterUndo.ticketsByState.USED).toBe(baseline.used);
    expect(afterUndo.ticketsByState.ACTIVE).toBe(baseline.active);
    expect(afterUndo.rejectByReason).toEqual({ TICKET_NOT_ACTIVE: 1 });
    expect(stableKpi(afterUndo)).toEqual(baseline.stable);

    // Replaying the consumed reservation token is denied and keeps count at 0.
    const replay = await apiJson(
      m,
      token,
      'POST',
      `/gate/events/${f.eventId}/reservations/${reservationId}/confirm`,
      {
        tenantId: f.tenantId,
        token: reservationToken,
        staffSessionId,
      },
    );
    expect(replay.status).toBe(409);
    expect((replay.json as { code?: string }).code).toBe('ALREADY_CHECKED_IN');
    const afterDenial = await readReport(page, m, f);
    expect(afterDenial.checkInSuccessCount).toBe(baseline.checkInSuccessCount);
    expect(afterDenial.rejectByReason).toEqual({
      TICKET_NOT_ACTIVE: 1,
      ALREADY_CHECKED_IN: 1,
    });
    expect(stableKpi(afterDenial)).toEqual(baseline.stable);

    // Audit/source dictionary: gate.confirm + gate.undo keep the same checkin
    // row; rejects are recorded by stable Gate code, not free text.
    const audit = await apiJson(
      m,
      token,
      'GET',
      `/tenants/${f.tenantId}/events/${f.eventId}/audit?limit=50`,
    );
    expect(audit.status).toBe(200);
    const items = (audit.json as { items: AuditItem[] }).items;
    expect(
      items.some(
        (item) =>
          item.action === 'gate.confirm' &&
          item.resourceType === 'checkin' &&
          item.resourceId === checkinId,
      ),
    ).toBe(true);
    expect(
      items.some(
        (item) =>
          item.action === 'gate.undo' &&
          item.resourceType === 'checkin' &&
          item.resourceId === checkinId,
      ),
    ).toBe(true);
    const rejects = items.filter(
      (item) => item.action === 'gate.reject' && item.resourceId === ticketId,
    );
    expect(rejects).toHaveLength(2);

    // Event/tenant boundary: same staff token cannot read a sibling event it is
    // not assigned to, nor another tenant's event.
    const unassignedEventId = required(
      f.data?.unassignedEventId as string | undefined,
      'unassignedEventId',
    );
    const foreignTenantId = required(
      f.data?.foreignTenantId as string | undefined,
      'foreignTenantId',
    );
    const foreignEventId = required(
      f.data?.foreignEventId as string | undefined,
      'foreignEventId',
    );
    const unassigned = await apiJson(
      m,
      token,
      'GET',
      `/tenants/${f.tenantId}/events/${unassignedEventId}/report`,
    );
    expect(unassigned.status).toBe(403);
    const foreign = await apiJson(
      m,
      token,
      'GET',
      `/tenants/${foreignTenantId}/events/${foreignEventId}/report`,
    );
    expect(foreign.status).toBe(403);
    const foreignBff = await bffGet(
      page,
      m,
      `/api/bff/tenants/${f.tenantId}/events/${unassignedEventId}/report`,
    );
    expect(foreignBff.status).toBe(403);
  } finally {
    // Bounded restore: a mid-journey failure must not leave the shared PORT-08
    // fixture with an admitted ticket for the seed-snapshot specs.
    if (checkinId && !undone) {
      await apiJson(
        m,
        token,
        'POST',
        `/gate/events/${f.eventId}/checkins/${checkinId}/undo`,
        { tenantId: f.tenantId, reason: 'PORT-08 cleanup undo' },
      ).catch(() => undefined);
    }
  }
});
