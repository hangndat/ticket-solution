import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SUPERVISOR_UNKNOWN_MESSAGE,
  applySupervisorResult,
  idleSnapshot,
  outcomeTitle,
  performSupervisorAction,
  presentsAsAdmitted,
  type SupervisorAction,
  type SupervisorSnapshot,
} from './supervisor.ts';

const ticketId = '11111111-1111-4111-8111-111111111111';
const tenantId = '22222222-2222-4222-8222-222222222222';
const eventId = '33333333-3333-4333-8333-333333333333';
const sessionId = '44444444-4444-4444-8444-444444444444';
const reservationId = '55555555-5555-4555-8555-555555555555';
const checkinId = '66666666-6666-4666-8666-666666666666';

const holding: SupervisorSnapshot = {
  ...idleSnapshot(),
  phase: 'holding',
  sessionId,
  reservationId,
  token: 'hold-token',
  ticketId,
  message: 'Hold reserved. Do not admit until confirm succeeds.',
};

function assertNotAdmitted(snapshot: SupervisorSnapshot) {
  assert.equal(snapshot.admitted, false);
  assert.notEqual(snapshot.phase, 'admitted');
  assert.equal(presentsAsAdmitted(snapshot), false);
  assert.equal(outcomeTitle(snapshot), 'Unknown — do not admit');
  assert.equal(snapshot.message, SUPERVISOR_UNKNOWN_MESSAGE);
}

test('confirm network loss and HTTP 500 stay unknown and are not admitted', () => {
  const lost = applySupervisorResult({
    action: 'confirm',
    previous: holding,
    result: { status: 0, json: null, networkError: true },
  });
  assertNotAdmitted(lost);
  assert.equal(lost.reservationId, reservationId);
  assert.equal(lost.token, 'hold-token');

  const server = applySupervisorResult({
    action: 'confirm',
    previous: holding,
    result: { status: 503, json: { message: 'unavailable' }, networkError: false },
  });
  assertNotAdmitted(server);
});

test('undo and revoke with an unknown result are not shown as admitted', () => {
  const admitted: SupervisorSnapshot = {
    ...holding,
    phase: 'admitted',
    admitted: true,
    checkinId,
    token: undefined,
    message: 'Admitted. Check-in recorded.',
  };
  for (const action of ['undo', 'revoke-ticket'] as const) {
    const next = applySupervisorResult({
      action,
      previous: admitted,
      result: { status: 0, json: null, networkError: true },
    });
    assertNotAdmitted(next);
    assert.equal(presentsAsAdmitted(next), false);
  }
  const reserveLost = applySupervisorResult({
    action: 'reserve',
    previous: { ...idleSnapshot(), sessionId },
    result: { status: 502, json: null, networkError: false },
  });
  assertNotAdmitted(reserveLost);
});

test('only a known USED confirm is presented as admitted', () => {
  const confirmed = applySupervisorResult({
    action: 'confirm',
    previous: holding,
    result: {
      status: 200,
      networkError: false,
      json: { state: 'USED', checkinId, ticketId, reservationId },
    },
  });
  assert.equal(presentsAsAdmitted(confirmed), true);
  assert.equal(outcomeTitle(confirmed), 'Admit');

  const undone = applySupervisorResult({
    action: 'undo',
    previous: confirmed,
    result: {
      status: 200,
      networkError: false,
      json: { state: 'ACTIVE', checkinId, ticketId },
    },
  });
  assert.equal(undone.phase, 'undone');
  assert.equal(presentsAsAdmitted(undone), false);
  assert.equal(outcomeTitle(undone), 'Do not admit');
});

test('performSupervisorAction posts each gate route and keeps a thrown fetch unknown', async () => {
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith('/sessions')) {
      return Response.json({ sessionId, eventId, status: 'ACTIVE' });
    }
    if (url.endsWith('/reservations')) {
      return Response.json({ reservationId, token: 'hold-token', ticketId });
    }
    if (url.endsWith('/confirm')) {
      return Response.json({ state: 'USED', checkinId, ticketId, reservationId });
    }
    if (url.endsWith('/undo')) {
      return Response.json({ state: 'ACTIVE', checkinId, ticketId });
    }
    if (url.endsWith('/revoke') && url.includes('/tickets/')) {
      return Response.json({ status: 'REVOKED', ticketId });
    }
    if (url.endsWith('/sessions/revoke')) {
      return Response.json({ status: 'REVOKED', staffSessionId: sessionId });
    }
    return Response.json({ message: 'unexpected' }, { status: 500 });
  };

  const base = {
    bearer: 'token',
    apiBase: 'http://127.0.0.1:3001',
    tenantId,
    eventId,
    fetchImpl,
  };
  let snapshot = idleSnapshot();
  const steps: SupervisorAction[] = [
    'open-session',
    'reserve',
    'confirm',
    'undo',
    'revoke-ticket',
    'open-session',
    'revoke-session',
  ];
  for (const action of steps) {
    snapshot = await performSupervisorAction({
      ...base,
      action,
      previous: snapshot,
      ticketId,
      reason: 'supervisor correction',
    });
  }
  assert.equal(snapshot.phase, 'session-revoked');
  assert.equal(presentsAsAdmitted(snapshot), false);
  assert.ok(calls.some((url) => url.endsWith('/sessions')));
  assert.ok(calls.some((url) => url.endsWith('/reservations')));
  assert.ok(calls.some((url) => url.includes('/confirm')));
  assert.ok(calls.some((url) => url.endsWith('/undo')));
  assert.ok(calls.some((url) => url.includes(`/tickets/${ticketId}/revoke`)));
  assert.ok(calls.some((url) => url.endsWith('/sessions/revoke')));

  const dropped = await performSupervisorAction({
    ...base,
    action: 'confirm',
    previous: holding,
    fetchImpl: async () => {
      throw new Error('offline');
    },
  });
  assertNotAdmitted(dropped);
});
