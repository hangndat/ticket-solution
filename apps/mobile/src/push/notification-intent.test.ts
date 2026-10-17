import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SessionEpoch } from '../identity/session-boundary.ts';
import {
  __resetNotificationIntentForTests,
  beginResponseResolve,
  clearNotificationTapIntent,
  dropNotificationTapIntentIfStale,
  markResponseConsumed,
  parkNotificationTapIntent,
  peekNotificationTapIntent,
  redactNotificationTapIntent,
  resumeNotificationTapIntent,
  wasResponseConsumed,
} from './notification-intent.ts';

function epoch(userId: string, generation: number): SessionEpoch {
  return { userId, generation };
}

test('pre-login park resumes after verified epoch', () => {
  __resetNotificationIntentForTests();
  parkNotificationTapIntent({
    responseId: 'r1',
    kind: 'TicketIssued',
    payloadVersion: 1,
    ticketId: '11111111-1111-4111-8111-111111111111',
    parkedUserId: null,
    parkedGeneration: null,
  });
  const resumed = resumeNotificationTapIntent({
    epoch: epoch('user-a', 1),
    isEpochCurrent: () => true,
  });
  assert.equal(resumed.ok, true);
});

test('account switch drops parked intent; redact omits opaque ids', () => {
  __resetNotificationIntentForTests();
  parkNotificationTapIntent({
    responseId: 'r1',
    kind: 'EventChanged',
    payloadVersion: 1,
    tenantSlug: 'acme',
    eventSlug: 'spring',
    ticketId: '11111111-1111-4111-8111-111111111111',
    parkedUserId: 'user-a',
    parkedGeneration: 1,
  });
  const redacted = redactNotificationTapIntent(peekNotificationTapIntent());
  assert.ok(redacted);
  assert.equal('ticketId' in redacted!, false);
  assert.equal(redacted!.hasTicketId, true);

  dropNotificationTapIntentIfStale({
    epoch: epoch('user-b', 1),
    isEpochCurrent: () => true,
  });
  assert.equal(peekNotificationTapIntent(), null);
});

test('multiple taps of same responseId only resolve once', () => {
  __resetNotificationIntentForTests();
  assert.equal(beginResponseResolve('same'), true);
  assert.equal(beginResponseResolve('same'), false);
  markResponseConsumed('same');
  assert.equal(wasResponseConsumed('same'), true);
  assert.equal(beginResponseResolve('same'), false);
  clearNotificationTapIntent();
  assert.equal(wasResponseConsumed('same'), true);
});

test('generation bump clears parked intent', () => {
  __resetNotificationIntentForTests();
  parkNotificationTapIntent({
    responseId: 'r2',
    kind: 'TicketIssued',
    payloadVersion: 1,
    ticketId: '11111111-1111-4111-8111-111111111111',
    parkedUserId: 'user-a',
    parkedGeneration: 1,
  });
  const stale = resumeNotificationTapIntent({
    epoch: epoch('user-a', 2),
    isEpochCurrent: () => true,
  });
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.reason, 'epoch-stale');
  assert.equal(peekNotificationTapIntent(), null);
});
