import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  GATE_UNKNOWN_MESSAGE,
  applyConfirm,
  classifyScan,
  parseScan,
  recoverOps,
  reconcileOp,
  runScan,
  type GateOp,
} from './gate-scan.ts';

const ticketId = '11111111-1111-4111-8111-111111111111';
const tenantId = '22222222-2222-4222-8222-222222222222';
const eventId = '33333333-3333-4333-8333-333333333333';
const base64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const jws = `${base64url({ alg: 'ES256', kid: 'test' })}.${base64url({
  tid: tenantId, eid: eventId, tkt: ticketId, ver: 1,
})}.signature`;
const qr = JSON.stringify({ v: 1, kind: 'ticket.gate_credential', jws });

test('logout while reservation response is pending prevents a later confirm admission', async () => {
  let release!: () => void;
  let entered!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const started = new Promise<void>((resolve) => { entered = resolve; });
  let current = true;
  let confirms = 0;
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/reservations')) {
      entered();
      await pending;
      return jsonResponse(200, { reservationId: 'reservation', token: 'test-token' });
    }
    confirms += 1;
    return jsonResponse(200, { state: 'USED' });
  };
  const scan = runScan({ raw: qr, bearer: 'test', apiBase: 'http://127.0.0.1:3001',
    ops: [], staffSessionId: 'session', fetchImpl, shouldContinue: () => current });
  await started;
  current = false;
  release();
  const result = await scan;
  assert.equal(result.current, null);
  assert.equal(confirms, 0);
});

test('reconcile after logout does not send confirm', async () => {
  let requests = 0;
  const op: GateOp = { id: 'op', ticketId, tenantId, eventId,
    staffSessionId: 'session', reservationId: 'reservation', token: 'test-token',
    phase: 'unknown', message: 'pending' };
  const result = await reconcileOp({ op, bearer: 'test', apiBase: 'http://127.0.0.1:3001',
    shouldContinue: () => false,
    fetchImpl: async () => { requests += 1; return jsonResponse(200, { state: 'USED' }); } });
  assert.equal(result.op, op);
  assert.equal(requests, 0);
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('parse signed Gate QR envelope and retain JWS for the reserve request', () => {
  const parsed = parseScan(qr);
  assert.equal(parsed?.ticketId, ticketId);
  assert.deepEqual(parsed?.presented, { kind: 'qr', jws });
});

test('reject unsigned ticket.display QR and bare UUID even with event scope', () => {
  const parsed = parseScan(qr);
  assert.equal(parsed?.ticketId, ticketId);
  const legacy = JSON.stringify({ v: 1, kind: 'ticket.display', ticketId, tenantId, eventId });
  assert.equal(parseScan(legacy), null);
  assert.equal(parseScan(ticketId), null);
});

test('reserve sends the selected workspace context and signed JWS only', async () => {
  const reserveBodies: Record<string, unknown>[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith('/reservations')) {
      reserveBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return jsonResponse(200, { reservationId: 'reservation', token: 'hold-token' });
    }
    return jsonResponse(200, { state: 'USED', checkinId: 'checkin' });
  };
  const result = await runScan({
    raw: qr, bearer: 'token', apiBase: 'http://127.0.0.1:3001',
    ops: [], staffSessionId: 'session', fallback: { tenantId, eventId },
    fetchImpl, createId: () => 'qr-op',
  });
  assert.equal(result.current?.phase, 'admitted');
  assert.deepEqual(reserveBodies[0]?.presented, { kind: 'qr', jws });
  assert.equal('ticketId' in (reserveBodies[0] ?? {}), false);
  assert.doesNotMatch(JSON.stringify(result.ops), /"presented"|\.signature/);
});

test('expired proofs and stale/revoked tickets are denied with Vietnamese copy; used remains explicit', () => {
  const op: GateOp = {
    id: 'op', ticketId, tenantId, eventId, staffSessionId: 'session',
    phase: 'holding', message: '',
  };
  const cases = [
    ['MANUAL_PROOF_INVALID', /hết hạn/i],
    ['CREDENTIAL_VERSION_STALE', /được cấp lại/i],
    ['TICKET_NOT_ACTIVE', /thu hồi/i],
  ] as const;
  for (const [code, message] of cases) {
    const denied = applyConfirm(op, { status: 409, json: { code }, networkError: false });
    assert.equal(denied.phase, 'denied');
    assert.match(denied.message, message);
  }
  const used = applyConfirm(op, {
    status: 409, json: { code: 'ALREADY_CHECKED_IN', checkinId: 'checkin' }, networkError: false,
  });
  assert.equal(used.phase, 'admitted');
  assert.equal(used.admissionKind, 'already');
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

test('manual code is looked up online and reserve receives only the session-bound proof', async () => {
  const code = 'ABCD-EFGH-JK';
  const lookupBodies: Record<string, unknown>[] = [];
  const reserveBodies: Record<string, unknown>[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    if (url.endsWith('/manual-lookup')) {
      lookupBodies.push(body);
      return jsonResponse(200, { ticketId, proofToken: 'short-lived-proof' });
    }
    if (url.endsWith('/reservations')) {
      reserveBodies.push(body);
      return jsonResponse(200, { reservationId: 'reservation', token: 'hold-token' });
    }
    return jsonResponse(200, { state: 'USED', checkinId: 'checkin' });
  };
  const result = await runScan({
    raw: '', manualEntryCode: code, fallback: { tenantId, eventId },
    bearer: 'token', apiBase: 'http://127.0.0.1:3001', ops: [],
    staffSessionId: 'session', fetchImpl, createId: () => 'manual-op',
  });
  assert.equal(result.current?.phase, 'admitted');
  assert.equal(lookupBodies[0]?.code, code);
  assert.equal(lookupBodies[0]?.staffSessionId, 'session');
  assert.deepEqual(reserveBodies[0]?.presented, { kind: 'manual', proofToken: 'short-lived-proof' });
  assert.equal('ticketId' in (reserveBodies[0] ?? {}), false);
  assert.doesNotMatch(JSON.stringify(result.ops), new RegExp(code));
  assert.doesNotMatch(JSON.stringify(result.ops), /short-lived-proof/);
});

test('invalid manual code is denied without reserving or retaining the code', async () => {
  const code = 'ABCD-EFGH-JK';
  let reserveCalls = 0;
  const result = await runScan({
    raw: '', manualEntryCode: code, fallback: { tenantId, eventId },
    bearer: 'token', apiBase: 'http://127.0.0.1:3001', ops: [],
    staffSessionId: 'session', createId: () => 'manual-invalid',
    fetchImpl: async (input) => String(input).endsWith('/manual-lookup')
      ? jsonResponse(404, { code: 'MANUAL_CODE_INVALID' })
      : (reserveCalls += 1, jsonResponse(200, {})),
  });
  assert.equal(result.current?.phase, 'denied');
  assert.match(result.current?.message ?? '', /không đúng hoặc không còn hiệu lực/i);
  assert.equal(reserveCalls, 0);
  assert.doesNotMatch(JSON.stringify(result.ops), new RegExp(code));
});

test('manual code cannot use the offline queue', async () => {
  let calls = 0;
  const result = await runScan({
    raw: '', manualEntryCode: 'ABCD-EFGH-JK', fallback: { tenantId, eventId },
    bearer: 'token', apiBase: 'http://127.0.0.1:3001', ops: [],
    staffSessionId: 'session', preferOfflineQueue: true,
    fetchImpl: async () => { calls += 1; throw new TypeError('offline'); },
  });
  assert.equal(calls, 0);
  assert.equal(result.current?.phase, 'denied');
  assert.equal(result.offlineQueueEligible, undefined);
  assert.match(result.current?.message ?? '', /cần được kiểm tra trực tuyến/i);
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
