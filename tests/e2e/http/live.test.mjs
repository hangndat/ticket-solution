import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const CASE_IDS = ['SEC-01', 'AUTH-03', 'GATE-01', 'GATE-03', 'DB-03'];
const chosen = process.env.E2E_HTTP_CASE;
if (chosen && !CASE_IDS.includes(chosen))
  throw new Error(`Unknown HTTP case: ${chosen}`);

function required(value, label) {
  if (value === undefined || value === null || value === '') {
    throw new Error(`BLOCKED: missing ${label}`);
  }
  return value;
}

function context(caseId) {
  const path = required(process.env.E2E_MANIFEST, 'E2E_MANIFEST');
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(manifest.schemaVersion, 1, 'BLOCKED: manifest schemaVersion');
  const runId = required(manifest.runId, 'runId');
  const fixture = required(manifest.cases?.[caseId], `cases.${caseId}`);
  const api = required(manifest.origins?.api, 'origins.api');
  const auth = required(manifest.origins?.auth, 'origins.auth');
  assert.equal(
    new URL(api).protocol,
    'https:',
    'BLOCKED: API origin must use HTTPS',
  );
  assert.equal(
    new URL(auth).protocol,
    'https:',
    'BLOCKED: Auth origin must use HTTPS',
  );
  return {
    fixture,
    api,
    tokenUrl: new URL(
      `/realms/e2e-${runId}/protocol/openid-connect/token`,
      auth,
    ),
    clientId: required(manifest.runtime?.httpClientId, 'runtime.httpClientId'),
    clientSecret: required(
      manifest.runtime?.httpClientSecret,
      'runtime.httpClientSecret',
    ),
  };
}

async function bearer(ctx, actor) {
  const account = required(
    ctx.fixture.accounts?.[actor],
    `cases account ${actor}`,
  );
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: ctx.clientId,
    client_secret: ctx.clientSecret,
    username: required(account.username, `${actor}.username`),
    password: required(account.password, `${actor}.password`),
    scope: 'openid profile email',
  });
  const response = await fetch(ctx.tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  assert.equal(
    response.status,
    200,
    `BLOCKED: Keycloak password grant for ${actor}`,
  );
  const payload = await response.json();
  return required(payload.access_token, `access token for ${actor}`);
}

async function request(ctx, method, path, token, body, headers = {}) {
  const response = await fetch(new URL(`/v1${path}`, ctx.api), {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json();
  return { status: response.status, body: payload };
}

function expectStatus(result, status, code) {
  assert.equal(
    result.status,
    status,
    `HTTP ${result.status}; code=${result.body.code ?? 'none'}`,
  );
  if (code) assert.equal(result.body.code, code);
}

function deny(result) {
  assert.ok(
    [403, 404].includes(result.status),
    `expected 403/404, got ${result.status}`,
  );
  assert.equal(typeof result.body.code, 'string');
}

function reportPath(f, tenantId = f.tenantId, eventId = f.eventId) {
  return `/tenants/${tenantId}/events/${eventId}/report`;
}

function redemptionPath(f) {
  return `/tenants/${f.tenantId}/events/${f.eventId}/redemptions`;
}

function redemptionBody(f, caseId) {
  return {
    code: required(f.code, `${caseId} code`),
    formVersion: required(f.data?.formVersion, `${caseId} formVersion`),
    termsVersion: required(f.data?.termsVersion, `${caseId} termsVersion`),
    answers: required(f.data?.answers, `${caseId} answers`),
    termsAccepted: true,
  };
}

function gatePath(f, suffix) {
  return `/gate/events/${f.eventId}/${suffix}`;
}

for (const caseId of CASE_IDS) {
  if (chosen && chosen !== caseId) continue;
  test(`[${caseId}] live HTTP`, async () => {
    const ctx = context(caseId);
    const f = ctx.fixture;
    if (caseId === 'SEC-01') {
      const owner = await bearer(ctx, 'owner');
      const own = await request(ctx, 'GET', reportPath(f), owner);
      expectStatus(own, 200);
      assert.equal(own.body.eventId, f.eventId);
      const foreignTenantId = required(
        f.data?.foreignTenantId,
        'SEC-01 foreignTenantId',
      );
      const foreignEventId = required(
        f.data?.foreignEventId,
        'SEC-01 foreignEventId',
      );
      deny(
        await request(
          ctx,
          'GET',
          reportPath(f, foreignTenantId, foreignEventId),
          owner,
        ),
      );
      deny(
        await request(
          ctx,
          'GET',
          reportPath(f, f.tenantId, foreignEventId),
          owner,
        ),
      );
      return;
    }
    if (caseId === 'AUTH-03') {
      const path = redemptionPath(f);
      const body = redemptionBody(f, caseId);
      const owner = await bearer(ctx, 'owner');
      const before = await request(ctx, 'GET', reportPath(f), owner);
      expectStatus(before, 200);
      const key = randomUUID();
      expectStatus(
        await request(ctx, 'POST', path, null, body, {
          'idempotency-key': key,
        }),
        401,
      );
      const unverified = await bearer(ctx, 'unverified');
      expectStatus(
        await request(ctx, 'POST', path, unverified, body, {
          'idempotency-key': key,
        }),
        403,
        'EMAIL_NOT_VERIFIED',
      );
      const deniedSnapshot = await request(ctx, 'GET', reportPath(f), owner);
      expectStatus(deniedSnapshot, 200);
      assert.equal(
        deniedSnapshot.body.quota.allocated,
        before.body.quota.allocated,
      );
      assert.equal(
        deniedSnapshot.body.pendingApprovalCount,
        before.body.pendingApprovalCount,
      );
      const attendee = await bearer(ctx, 'attendee');
      const issued = await request(ctx, 'POST', path, attendee, body, {
        'idempotency-key': randomUUID(),
      });
      expectStatus(issued, 201);
      assert.equal(issued.body.state, 'ACTIVE');
      const after = await request(ctx, 'GET', reportPath(f), owner);
      expectStatus(after, 200);
      assert.equal(after.body.quota.allocated, before.body.quota.allocated + 1);
      return;
    }
    if (caseId === 'GATE-01') {
      const owner = await bearer(ctx, 'owner');
      const scanner = await bearer(ctx, 'scanner');
      const gates = gatePath(f, 'gates');
      const listPath = `${gates}?tenantId=${f.tenantId}`;
      const before = await request(ctx, 'GET', listPath, scanner);
      expectStatus(before, 200);
      assert.ok(Array.isArray(before.body.gates));
      const name = required(f.data?.gateName, 'GATE-01 gateName');
      assert.ok(!before.body.gates.some((gate) => gate.name === name));
      expectStatus(
        await request(ctx, 'POST', gates, scanner, {
          tenantId: f.tenantId,
          name,
        }),
        403,
      );
      const created = await request(ctx, 'POST', gates, owner, {
        tenantId: f.tenantId,
        name,
      });
      expectStatus(created, 201);
      assert.equal(created.body.eventId, f.eventId);
      assert.equal(created.body.name, name);
      const listed = await request(ctx, 'GET', listPath, scanner);
      expectStatus(listed, 200);
      assert.ok(
        listed.body.gates.some(
          (gate) => gate.id === created.body.id && gate.name === name,
        ),
      );
      expectStatus(
        await request(ctx, 'POST', gates, owner, {
          tenantId: f.tenantId,
          name,
        }),
        409,
        'GATE_NAME_CONFLICT',
      );
      const sessions = gatePath(f, 'sessions');
      const unbound = await request(ctx, 'POST', sessions, scanner, {
        tenantId: f.tenantId,
      });
      expectStatus(unbound, 200);
      assert.equal(unbound.body.gateId, null);
      assert.equal(unbound.body.gateName, null);
      const bound = await request(ctx, 'POST', sessions, scanner, {
        tenantId: f.tenantId,
        gateId: created.body.id,
      });
      expectStatus(bound, 200);
      assert.equal(bound.body.gateId, created.body.id);
      assert.equal(bound.body.gateName, name);
      const foreignGateId = required(
        f.data?.foreignGateId,
        'GATE-01 foreignGateId',
      );
      expectStatus(
        await request(ctx, 'POST', sessions, scanner, {
          tenantId: f.tenantId,
          gateId: foreignGateId,
        }),
        404,
        'GATE_NOT_FOUND',
      );
      const foreignEventId = required(
        f.data?.foreignEventId,
        'GATE-01 foreignEventId',
      );
      deny(
        await request(
          ctx,
          'GET',
          `/gate/events/${foreignEventId}/gates?tenantId=${f.tenantId}`,
          scanner,
        ),
      );
      deny(
        await request(
          ctx,
          'POST',
          `/gate/events/${foreignEventId}/gates`,
          owner,
          { tenantId: f.tenantId, name: `${name} foreign` },
        ),
      );
      return;
    }
    if (caseId === 'GATE-03') {
      const scanner = await bearer(ctx, 'scanner');
      const attendee = await bearer(ctx, 'attendee');
      const owner = await bearer(ctx, 'owner');
      const ticketId = required(f.ticketId, 'GATE-03 ticketId');
      const session = await request(
        ctx,
        'POST',
        gatePath(f, 'sessions'),
        scanner,
        { tenantId: f.tenantId },
      );
      expectStatus(session, 200);
      const reportBefore = await request(ctx, 'GET', reportPath(f), owner);
      expectStatus(reportBefore, 200);
      const path = gatePath(f, 'reservations');
      const base = {
        tenantId: f.tenantId,
        staffSessionId: session.body.sessionId,
      };
      expectStatus(
        await request(ctx, 'POST', path, scanner, {
          ...base,
          ticketId: 'bad-qr',
        }),
        422,
        'SCOPE_REQUIRED',
      );
      expectStatus(
        await request(ctx, 'POST', path, scanner, {
          ...base,
          ticketId: randomUUID(),
        }),
        404,
        'TICKET_NOT_FOUND',
      );
      expectStatus(
        await request(ctx, 'POST', path, attendee, { ...base, ticketId }),
        403,
      );
      const reportAfter = await request(ctx, 'GET', reportPath(f), owner);
      expectStatus(reportAfter, 200);
      assert.equal(
        reportAfter.body.checkInSuccessCount,
        reportBefore.body.checkInSuccessCount,
      );
      assert.equal(
        reportAfter.body.rejectByReason.TICKET_NOT_FOUND ?? 0,
        (reportBefore.body.rejectByReason.TICKET_NOT_FOUND ?? 0) + 1,
      );
      return;
    }
    if (caseId === 'DB-03') {
      const attendee = await bearer(ctx, 'attendee');
      const owner = await bearer(ctx, 'owner');
      const body = redemptionBody(f, caseId);
      const path = redemptionPath(f);
      const ticketsPath = `/me/tickets?tenantId=${f.tenantId}`;
      const beforeTickets = await request(ctx, 'GET', ticketsPath, attendee);
      const beforeReport = await request(ctx, 'GET', reportPath(f), owner);
      expectStatus(beforeTickets, 200);
      expectStatus(beforeReport, 200);
      const key = randomUUID();
      const first = await request(ctx, 'POST', path, attendee, body, {
        'idempotency-key': key,
      });
      expectStatus(first, 201);
      assert.equal(first.body.replayed, false);
      assert.equal(first.body.state, 'ACTIVE');
      const replay = await request(ctx, 'POST', path, attendee, body, {
        'idempotency-key': key,
      });
      expectStatus(replay, 201);
      assert.equal(replay.body.replayed, true);
      for (const field of ['ticketId', 'requestId', 'operationId']) {
        assert.equal(replay.body[field], first.body[field]);
      }
      const changed = { ...body, code: `${body.code}X` };
      expectStatus(
        await request(ctx, 'POST', path, attendee, changed, {
          'idempotency-key': key,
        }),
        409,
        'IDEMPOTENCY_CONFLICT',
      );
      const afterTickets = await request(ctx, 'GET', ticketsPath, attendee);
      const afterReport = await request(ctx, 'GET', reportPath(f), owner);
      expectStatus(afterTickets, 200);
      expectStatus(afterReport, 200);
      assert.equal(
        afterTickets.body.tickets.length,
        beforeTickets.body.tickets.length + 1,
      );
      assert.equal(
        afterTickets.body.tickets.filter(
          (ticket) => ticket.ticketId === first.body.ticketId,
        ).length,
        1,
      );
      assert.equal(
        afterReport.body.quota.allocated,
        beforeReport.body.quota.allocated + 1,
      );
    }
  });
}
