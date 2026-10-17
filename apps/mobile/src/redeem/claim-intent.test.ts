import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SessionEpoch } from '../identity/session-boundary.ts';
import {
  clearGuestClaimIntent,
  dropGuestClaimIntentIfStale,
  parkGuestClaimIntent,
  peekGuestClaimIntent,
  redactGuestClaimIntent,
  resumeGuestClaimIntent,
} from './claim-intent.ts';

function epoch(userId: string, generation: number): SessionEpoch {
  return { userId, generation };
}

test('pre-login park resumes after verified epoch', () => {
  clearGuestClaimIntent();
  parkGuestClaimIntent({
    token: 'opaque-claim-token-value',
    tenantId: '22222222-2222-4222-8222-222222222222',
    eventId: '33333333-3333-4333-8333-333333333333',
    parkedUserId: null,
    parkedGeneration: null,
  });
  const e = epoch('user-a', 1);
  const resumed = resumeGuestClaimIntent({
    epoch: e,
    isEpochCurrent: () => true,
  });
  assert.equal(resumed.ok, true);
});

test('account switch drops parked intent and redacts token', () => {
  clearGuestClaimIntent();
  parkGuestClaimIntent({
    token: 'opaque-claim-token-value',
    tenantId: '22222222-2222-4222-8222-222222222222',
    eventId: '33333333-3333-4333-8333-333333333333',
    parkedUserId: 'user-a',
    parkedGeneration: 1,
  });
  const redacted = redactGuestClaimIntent(peekGuestClaimIntent());
  assert.ok(redacted);
  assert.equal('token' in redacted!, false);
  assert.equal(redacted!.hasToken, true);

  dropGuestClaimIntentIfStale({
    epoch: epoch('user-b', 1),
    isEpochCurrent: () => true,
  });
  assert.equal(peekGuestClaimIntent(), null);

  parkGuestClaimIntent({
    token: 'opaque-claim-token-value',
    tenantId: '22222222-2222-4222-8222-222222222222',
    eventId: '33333333-3333-4333-8333-333333333333',
    parkedUserId: 'user-a',
    parkedGeneration: 1,
  });
  const mismatch = resumeGuestClaimIntent({
    epoch: epoch('user-b', 2),
    isEpochCurrent: () => true,
  });
  assert.equal(mismatch.ok, false);
  if (!mismatch.ok) assert.equal(mismatch.reason, 'user-mismatch');
  assert.equal(peekGuestClaimIntent(), null);
});

test('generation bump clears intent (re-login same user)', () => {
  clearGuestClaimIntent();
  parkGuestClaimIntent({
    token: 'opaque-claim-token-value',
    tenantId: '22222222-2222-4222-8222-222222222222',
    eventId: '33333333-3333-4333-8333-333333333333',
    parkedUserId: 'user-a',
    parkedGeneration: 1,
  });
  const stale = resumeGuestClaimIntent({
    epoch: epoch('user-a', 2),
    isEpochCurrent: () => true,
  });
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.reason, 'epoch-stale');
});
