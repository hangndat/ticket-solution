import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SessionEpoch } from '../identity/session-boundary.ts';
import {
  clearRedeemDraftIntent,
  dropRedeemDraftIntentIfStale,
  parkRedeemDraftIntent,
  peekRedeemDraftIntent,
  redactRedeemDraftIntent,
  resumeRedeemDraftIntent,
} from './redeem-draft-intent.ts';

function epoch(userId: string, generation: number): SessionEpoch {
  return { userId, generation };
}

const basePark = {
  tenantId: 't',
  eventId: 'e',
  tenantSlug: 'org',
  eventSlug: 'ev',
  code: 'SECRET-CODE',
  answers: { q1: 'a' },
  termsAccepted: true,
  parkedUserId: null as string | null,
  parkedGeneration: null as number | null,
};

test('pre-login redeem draft resumes after verified epoch', () => {
  clearRedeemDraftIntent();
  parkRedeemDraftIntent(basePark);
  const resumed = resumeRedeemDraftIntent({
    epoch: epoch('user-a', 1),
    isEpochCurrent: () => true,
  });
  assert.equal(resumed.ok, true);
  if (resumed.ok) assert.equal(resumed.intent.code, 'SECRET-CODE');
});

test('account switch clears redeem draft', () => {
  clearRedeemDraftIntent();
  parkRedeemDraftIntent({
    ...basePark,
    parkedUserId: 'user-a',
    parkedGeneration: 1,
  });
  const stale = resumeRedeemDraftIntent({
    epoch: epoch('user-b', 1),
    isEpochCurrent: () => true,
  });
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.reason, 'user-mismatch');
  assert.equal(peekRedeemDraftIntent(), null);
});

test('generation bump clears redeem draft (re-login same user)', () => {
  clearRedeemDraftIntent();
  parkRedeemDraftIntent({
    ...basePark,
    parkedUserId: 'user-a',
    parkedGeneration: 1,
  });
  const stale = resumeRedeemDraftIntent({
    epoch: epoch('user-a', 2),
    isEpochCurrent: () => true,
  });
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.reason, 'epoch-stale');
});

test('dropRedeemDraftIntentIfStale on account switch and redacts code', () => {
  clearRedeemDraftIntent();
  parkRedeemDraftIntent({
    ...basePark,
    parkedUserId: 'user-a',
    parkedGeneration: 1,
  });
  const redacted = redactRedeemDraftIntent(peekRedeemDraftIntent());
  assert.ok(redacted);
  assert.equal('code' in redacted!, false);
  assert.equal(redacted!.hasCode, true);

  dropRedeemDraftIntentIfStale({
    epoch: epoch('user-b', 1),
    isEpochCurrent: () => true,
  });
  assert.equal(peekRedeemDraftIntent(), null);
});

test('pre-login park survives drop until resume or explicit clear', () => {
  clearRedeemDraftIntent();
  parkRedeemDraftIntent(basePark);
  dropRedeemDraftIntentIfStale({
    epoch: null,
    isEpochCurrent: () => false,
  });
  assert.ok(peekRedeemDraftIntent());
});
