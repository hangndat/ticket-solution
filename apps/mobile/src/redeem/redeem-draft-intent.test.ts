import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SessionEpoch } from '../identity/session-boundary.ts';
import {
  clearGlobalRedeemDraftIntent,
  dropGlobalRedeemDraftIntentIfStale,
  parkGlobalRedeemDraftIntent,
  peekGlobalRedeemDraftIntent,
  redactGlobalRedeemDraftIntent,
  resumeGlobalRedeemDraftIntent,
} from './redeem-draft-intent.ts';

function epoch(userId: string, generation: number): SessionEpoch {
  return { userId, generation };
}

test('pre-login park resumes after verified epoch', () => {
  clearGlobalRedeemDraftIntent();
  parkGlobalRedeemDraftIntent({
    code: 'PARKED-CODE',
    parkedUserId: null,
    parkedGeneration: null,
  });
  const e = epoch('user-a', 1);
  const resumed = resumeGlobalRedeemDraftIntent({
    epoch: e,
    isEpochCurrent: () => true,
  });
  assert.equal(resumed.ok, true);
  if (resumed.ok) assert.equal(resumed.intent.code, 'PARKED-CODE');
});

test('account switch drops parked draft and redacts code', () => {
  clearGlobalRedeemDraftIntent();
  parkGlobalRedeemDraftIntent({
    code: 'SECRET-CODE',
    parkedUserId: 'user-a',
    parkedGeneration: 1,
  });
  const redacted = redactGlobalRedeemDraftIntent(peekGlobalRedeemDraftIntent());
  assert.ok(redacted);
  assert.equal('code' in redacted!, false);
  assert.equal(redacted!.hasCode, true);

  dropGlobalRedeemDraftIntentIfStale({
    epoch: epoch('user-b', 1),
    isEpochCurrent: () => true,
  });
  assert.equal(peekGlobalRedeemDraftIntent(), null);
});
