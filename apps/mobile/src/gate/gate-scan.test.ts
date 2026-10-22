import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  GATE_UNKNOWN_MESSAGE,
  classifyScan,
  parseScan,
  recoverOps,
  runScan,
  type GateOp,
} from './gate-scan.ts';

const ticketId = '11111111-1111-4111-8111-111111111111';
const tenantId = '22222222-2222-4222-8222-222222222222';
const eventId = '33333333-3333-4333-8333-333333333333';
const qr = JSON.stringify({
  v: 1,
  kind: 'ticket.display',
  ticketId,
  tenantId,
  eventId,
  credentialVersion: 1,
  state: 'ACTIVE',
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('parse display QR reads optional display hints from JSON', () => {
  const withHints = JSON.stringify({
    v: 1,
    kind: 'ticket.display',
    ticketId,
    tenantId,
    eventId,
    ticketTypeLabel: 'Vé VIP',
    attendeeName: 'Lan Hương',
  });
  const parsed = parseScan(withHints);
  assert.equal(parsed?.displayHints?.ticketTypeLabel, 'Vé VIP');
  assert.equal(parsed?.displayHints?.attendeeName, 'Lan Hương');
});

test('parse display QR and reject a bare id without event scope', () => {
  const parsed = parseScan(qr);
  assert.equal(parsed?.ticketId, ticketId);
  assert.equal(parseScan(ticketId), null);
  assert.equal(
    parseScan(ticketId, { tenantId, eventId })?.eventId,
    eventId,
  );
});

test('duplicate scan does not confirm twice', async () => {
  let confirms = 0;
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/sessions')) {
      return jsonResponse(200, { sessionId: '44444444-4444-4444-8444-444444444444' });
    }
    if (url.endsWith('/reservations')) {
      return jsonResponse(200, {
        reservationId: '55555555-5555-4555-8555-555555555555',
        token: 'hold-token',
        ticketId,
      });
    }
    confirms += 1;
    return jsonResponse(200, {
      state: 'USED',
      ticketId,
      checkinId: '66666666-6666-4666-8666-666666666666',
    });
  };
  const first = await runScan({
    raw: qr,
    bearer: 'token',
    apiBase: 'http://127.0.0.1:3001',
    ops: [],
    staffSessionId: null,
    fetchImpl,
    createId: () => 'op-1',
  });
  assert.equal(first.current?.phase, 'admitted');
  assert.equal(confirms, 1);
  const second = await runScan({
    raw: qr,
    bearer: 'token',
    apiBase: 'http://127.0.0.1:3001',
    ops: first.ops,
    staffSessionId: first.staffSessionId,
    fetchImpl,
    createId: () => 'op-2',
  });
  assert.equal(confirms, 1);
  assert.equal(second.current?.phase, 'admitted');
  assert.equal(classifyScan(second.ops, ticketId).action, 'show');
});

test('Nest 201 session and hold still admit', async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/sessions')) {
      return jsonResponse(201, { sessionId: '44444444-4444-4444-8444-444444444444' });
    }
    if (url.endsWith('/reservations')) {
      return jsonResponse(201, {
        reservationId: '55555555-5555-4555-8555-555555555555',
        token: 'hold-token',
        ticketId,
      });
    }
    return jsonResponse(201, {
      state: 'USED',
      ticketId,
      checkinId: '66666666-6666-4666-8666-666666666666',
    });
  };
  const scanned = await runScan({
    raw: qr,
    bearer: 'token',
    apiBase: 'http://127.0.0.1:3001',
    ops: [],
    staffSessionId: null,
    fetchImpl,
    createId: () => 'op-201',
  });
  assert.equal(scanned.current?.phase, 'admitted');
  assert.equal(scanned.staffSessionId, '44444444-4444-4444-8444-444444444444');
});

test('lost confirm stays unknown across restart and blocks a second scan', async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/reservations')) {
      return jsonResponse(200, {
        reservationId: '55555555-5555-4555-8555-555555555555',
        token: 'hold-token',
        ticketId,
      });
    }
    return jsonResponse(502, { code: 'UPSTREAM_UNAVAILABLE', message: 'down' });
  };
  const scanned = await runScan({
    raw: qr,
    bearer: 'token',
    apiBase: 'http://127.0.0.1:3001',
    ops: [],
    staffSessionId: '44444444-4444-4444-8444-444444444444',
    fetchImpl,
    createId: () => 'op-1',
  });
  assert.equal(scanned.current?.phase, 'unknown');
  assert.equal(scanned.current?.message, GATE_UNKNOWN_MESSAGE);
  const confirming: GateOp = { ...scanned.current!, phase: 'confirming' };
  const recovered = recoverOps([confirming]);
  assert.equal(recovered[0]?.phase, 'unknown');
  assert.notEqual(recovered[0]?.phase, 'admitted');
  const again = await runScan({
    raw: qr,
    bearer: 'token',
    apiBase: 'http://127.0.0.1:3001',
    ops: recovered,
    staffSessionId: scanned.staffSessionId,
    fetchImpl,
    createId: () => 'op-2',
  });
  assert.equal(again.current?.id, 'op-1');
  assert.equal(again.current?.phase, 'unknown');
});

test('network error on reserve signals offline enqueue (does not admit)', async () => {
  const fetchImpl: typeof fetch = async () => {
    throw new TypeError('Network request failed');
  };
  const scanned = await runScan({
    raw: qr,
    bearer: 'token',
    apiBase: 'http://127.0.0.1:3001',
    ops: [],
    staffSessionId: '44444444-4444-4444-8444-444444444444',
    fetchImpl,
    createId: () => 'op-offline',
  });
  assert.equal(scanned.networkUnavailable, true);
  assert.equal(scanned.current, null);
  assert.equal(scanned.parsed?.ticketId, ticketId);
  assert.equal(scanned.staffSessionId, '44444444-4444-4444-8444-444444444444');
});

test('preferOfflineQueue skips online reserve when session exists', async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    return jsonResponse(200, {});
  };
  const scanned = await runScan({
    raw: qr,
    bearer: 'token',
    apiBase: 'http://127.0.0.1:3001',
    ops: [],
    staffSessionId: '44444444-4444-4444-8444-444444444444',
    fetchImpl,
    preferOfflineQueue: true,
    createId: () => 'op-pref',
  });
  assert.equal(calls, 0);
  assert.equal(scanned.networkUnavailable, true);
  assert.equal(scanned.parsed?.ticketId, ticketId);
});

test('MEMBERSHIP_REVOKED on open session sets membershipAuthzDenied', async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/sessions')) {
      return jsonResponse(403, {
        code: 'MEMBERSHIP_REVOKED',
        message: 'Membership revoked',
      });
    }
    return jsonResponse(500, { code: 'UNEXPECTED' });
  };
  const scanned = await runScan({
    raw: qr,
    bearer: 'token',
    apiBase: 'http://127.0.0.1:3001',
    ops: [],
    staffSessionId: null,
    fetchImpl,
    createId: () => 'op-revoked',
  });
  assert.equal(scanned.membershipAuthzDenied, true);
  assert.equal(scanned.current?.phase, 'denied');
  assert.equal(scanned.staffSessionId, null);
});

/** #608: default createId must not throw after /sessions+/reservations (Hermes). */
test('default createId persists deny after session open without injected createId', async () => {
  const sessionId = '44444444-4444-4444-8444-444444444444';
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/sessions')) {
      return jsonResponse(200, { sessionId });
    }
    if (url.endsWith('/reservations')) {
      return jsonResponse(404, {
        code: 'TICKET_NOT_FOUND',
        message: 'Ticket not found',
      });
    }
    return jsonResponse(500, { code: 'UNEXPECTED' });
  };
  const scanned = await runScan({
    raw: qr,
    bearer: 'token',
    apiBase: 'http://127.0.0.1:3001',
    ops: [],
    staffSessionId: null,
    fetchImpl,
  });
  assert.equal(scanned.staffSessionId, sessionId);
  assert.equal(scanned.current?.phase, 'denied');
  assert.ok(scanned.current?.id);
  assert.equal(scanned.ops[0]?.id, scanned.current?.id);
});
