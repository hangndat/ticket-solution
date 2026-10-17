const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  GateError,
  GATE_ERROR_CODES,
  sortOfflineEventsForReplay,
  validateOfflineSyncRequest,
  offlineSyncNotImplemented,
  offlineEventPayloadHash,
  compareOfflineReplayOrder,
  OFFLINE_SYNC_MAX_CLOCK_SKEW_SECONDS,
} = require('../dist');

const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const TENANT_ID = '22222222-2222-4222-8222-222222222222';
const SESSION_ID = '33333333-3333-4333-8333-333333333333';
const DEVICE_ID = '44444444-4444-4444-8444-444444444444';
const TICKET_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TICKET_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SERVER_MS = Date.parse('2026-11-01T09:05:00.000Z');

function baseBody(events) {
  return {
    tenantId: TENANT_ID,
    staffSessionId: SESSION_ID,
    deviceId: DEVICE_ID,
    clientClockAt: '2026-11-01T09:05:00.000Z',
    events,
  };
}

function event(partial) {
  return {
    clientEventId: partial.clientEventId,
    type: 'CHECKIN_OFFLINE',
    eventId: EVENT_ID,
    ticketId: partial.ticketId ?? TICKET_A,
    clientOccurredAt: partial.clientOccurredAt,
    clientSeq: partial.clientSeq,
    payloadVersion: 1,
  };
}

test('compareOfflineReplayOrder: occurredAt then clientSeq then clientEventId', () => {
  const early = event({
    clientEventId: '55555555-5555-4555-8555-555555555555',
    clientOccurredAt: '2026-11-01T09:04:00.000Z',
    clientSeq: 1,
  });
  const late = event({
    clientEventId: '66666666-6666-4666-8666-666666666666',
    clientOccurredAt: '2026-11-01T09:04:30.000Z',
    clientSeq: 0,
  });
  assert.ok(compareOfflineReplayOrder(early, late) < 0);

  const sameTimeLowSeq = event({
    clientEventId: '77777777-7777-4777-8777-777777777777',
    clientOccurredAt: '2026-11-01T09:04:00.000Z',
    clientSeq: 0,
  });
  assert.ok(compareOfflineReplayOrder(sameTimeLowSeq, early) < 0);

  const sorted = sortOfflineEventsForReplay([late, early, sameTimeLowSeq]);
  assert.deepEqual(
    sorted.map((e) => e.clientEventId),
    [
      '77777777-7777-4777-8777-777777777777',
      '55555555-5555-4555-8555-555555555555',
      '66666666-6666-4666-8666-666666666666',
    ],
  );
});

test('validateOfflineSyncRequest accepts in-skew batch and sorts for replay', () => {
  const body = baseBody([
    event({
      clientEventId: '66666666-6666-4666-8666-666666666666',
      ticketId: TICKET_B,
      clientOccurredAt: '2026-11-01T09:04:40.000Z',
      clientSeq: 1,
    }),
    event({
      clientEventId: '55555555-5555-4555-8555-555555555555',
      ticketId: TICKET_A,
      clientOccurredAt: '2026-11-01T09:04:10.000Z',
      clientSeq: 0,
    }),
  ]);
  const result = validateOfflineSyncRequest(EVENT_ID, body, SERVER_MS);
  assert.equal(result.events.length, 2);
  assert.equal(result.events[0].clientEventId, '55555555-5555-4555-8555-555555555555');
  assert.equal(result.events[1].clientEventId, '66666666-6666-4666-8666-666666666666');
});

test('validateOfflineSyncRequest rejects clock skew and oversized batch', () => {
  assert.throws(
    () =>
      validateOfflineSyncRequest(
        EVENT_ID,
        baseBody([
          event({
            clientEventId: '55555555-5555-4555-8555-555555555555',
            clientOccurredAt: '2026-11-01T08:00:00.000Z',
            clientSeq: 0,
          }),
        ]),
        SERVER_MS,
      ),
    (error) =>
      error instanceof GateError &&
      error.code === GATE_ERROR_CODES.OFFLINE_SYNC_CLOCK_SKEW_EXCEEDED,
  );

  const tooMany = Array.from({ length: 51 }, (_, i) =>
    event({
      clientEventId: `55555555-5555-4555-8555-${String(i).padStart(12, '0')}`,
      clientOccurredAt: '2026-11-01T09:04:30.000Z',
      clientSeq: i,
    }),
  );
  assert.throws(
    () => validateOfflineSyncRequest(EVENT_ID, baseBody(tooMany), SERVER_MS),
    (error) =>
      error instanceof GateError &&
      error.code === GATE_ERROR_CODES.OFFLINE_SYNC_BATCH_TOO_LARGE,
  );
  assert.equal(OFFLINE_SYNC_MAX_CLOCK_SKEW_SECONDS, 300);
});

test('offlineSyncNotImplemented validates then throws NOT_IMPLEMENTED (legacy stub)', () => {
  assert.throws(
    () =>
      offlineSyncNotImplemented(
        EVENT_ID,
        baseBody([
          event({
            clientEventId: '55555555-5555-4555-8555-555555555555',
            clientOccurredAt: '2026-11-01T09:04:30.000Z',
            clientSeq: 0,
          }),
        ]),
        SERVER_MS,
      ),
    (error) =>
      error instanceof GateError &&
      error.code === GATE_ERROR_CODES.OFFLINE_SYNC_NOT_IMPLEMENTED,
  );
});

test('offlineEventPayloadHash is stable for identical canonical fields', () => {
  const a = event({
    clientEventId: '55555555-5555-4555-8555-555555555555',
    clientOccurredAt: '2026-11-01T09:04:30.000Z',
    clientSeq: 0,
  });
  const b = event({
    clientEventId: '55555555-5555-4555-8555-555555555555',
    clientOccurredAt: '2026-11-01T09:04:30.000Z',
    clientSeq: 0,
  });
  assert.equal(offlineEventPayloadHash(a), offlineEventPayloadHash(b));
  const c = event({
    clientEventId: '55555555-5555-4555-8555-555555555555',
    ticketId: TICKET_B,
    clientOccurredAt: '2026-11-01T09:04:30.000Z',
    clientSeq: 0,
  });
  assert.notEqual(offlineEventPayloadHash(a), offlineEventPayloadHash(c));
});
