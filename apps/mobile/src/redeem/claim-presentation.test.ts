import assert from 'node:assert/strict';
import { test } from 'node:test';
import { claimPresentation } from './claim-presentation.ts';
import { claimInvitation } from './claim-client.ts';
import {
  clearGuestClaimIntent,
  dropGuestClaimIntentIfStale,
  parkGuestClaimIntent,
  peekGuestClaimIntent,
  resumeGuestClaimIntent,
} from './claim-intent.ts';

test('invalid link routes guest to Events and verified attendee to wallet', () => {
  for (const verified of [false, true]) {
    const view = claimPresentation({
      hasInvite: false,
      verified,
      decision: null,
    });
    assert.equal(view.phase, 'invalid');
    assert.equal(
      view.homeHref,
      verified ? '/(tabs)/my-tickets' : '/(tabs)/(events)',
    );
  }
});

test('guest waits for verification; issued and pending have distinct states', () => {
  assert.equal(
    claimPresentation({ hasInvite: true, verified: false, decision: null })
      .phase,
    'guest',
  );
  assert.equal(
    claimPresentation({ hasInvite: true, verified: true, decision: null })
      .phase,
    'form',
  );
  assert.equal(
    claimPresentation({
      hasInvite: true,
      verified: true,
      decision: {
        kind: 'pending',
        requestId: 'request',
        operationId: 'operation',
        eventId: 'event',
        replayed: false,
        message: 'pending',
      },
    }).phase,
    'pending',
  );
  assert.equal(
    claimPresentation({
      hasInvite: true,
      verified: true,
      decision: { kind: 'issued', ticketId: 'ticket', replayed: false },
    }).phase,
    'issued',
  );
});

test('expired or revoked invitation never offers claim form', () => {
  for (const code of ['INVITATION_EXPIRED', 'INVITATION_REVOKED']) {
    assert.equal(
      claimPresentation({
        hasInvite: true,
        verified: true,
        decision: { kind: 'denied', code, message: 'ignored' },
      }).phase,
      'invalid',
    );
  }
});

test('verified server 403 denial keeps its failure state and exits to wallet', async () => {
  const denied = await claimInvitation({
    apiBase: 'https://example.invalid',
    bearer: 'synthetic-bearer',
    tenantId: 'tenant',
    eventId: 'event',
    token: 'synthetic-invitation-token',
    idempotencyKey: 'synthetic-attempt',
    fetchImpl: async () =>
      new Response(JSON.stringify({ code: 'INVITATION_EMAIL_MISMATCH' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
  });
  assert.equal(denied.kind, 'denied');
  const view = claimPresentation({
    hasInvite: false,
    verified: true,
    decision: denied,
  });
  assert.equal(view.phase, 'failure');
  assert.equal(view.homeLabel, 'Về Vé của tôi');
  assert.equal(view.homeHref, '/(tabs)/my-tickets');
});

test('verified claim remains pending with refresh after its one-time intent is consumed', () => {
  clearGuestClaimIntent();
  const epoch = { userId: 'synthetic-a', generation: 1 };
  parkGuestClaimIntent({
    token: 'synthetic-invitation-pending',
    tenantId: '22222222-2222-4222-8222-222222222222',
    eventId: '33333333-3333-4333-8333-333333333333',
    parkedUserId: epoch.userId,
    parkedGeneration: epoch.generation,
  });
  assert.equal(
    resumeGuestClaimIntent({ epoch, isEpochCurrent: () => true }).ok,
    true,
  );
  assert.equal(
    claimPresentation({
      hasInvite: peekGuestClaimIntent() !== null,
      verified: true,
      decision: null,
    }).phase,
    'form',
  );

  const pending = {
    kind: 'pending' as const,
    requestId: 'request',
    operationId: 'operation',
    eventId: 'event',
    replayed: false,
    message: 'pending',
  };
  clearGuestClaimIntent();
  assert.equal(peekGuestClaimIntent(), null);
  assert.equal(
    claimPresentation({ hasInvite: false, verified: true, decision: pending })
      .phase,
    'pending',
  );
  assert.ok(
    pending.requestId,
    'pending receipt still supports owner-status refresh',
  );
  assert.equal(
    claimPresentation({
      hasInvite: false,
      verified: true,
      decision: { kind: 'issued', ticketId: 'ticket', replayed: false },
    }).phase,
    'issued',
  );
  assert.equal(
    claimPresentation({
      hasInvite: false,
      verified: true,
      decision: { kind: 'denied', code: 'REJECTED', message: 'ignored' },
    }).phase,
    'failure',
  );
  assert.equal(
    claimPresentation({
      hasInvite: false,
      verified: true,
      decision: {
        kind: 'denied',
        code: 'INVITATION_EXPIRED',
        message: 'ignored',
      },
    }).phase,
    'invalid',
  );
});

test('account switch drops intent before a late response can be presented', () => {
  clearGuestClaimIntent();
  parkGuestClaimIntent({
    token: 'synthetic-invitation-late',
    tenantId: '22222222-2222-4222-8222-222222222222',
    eventId: '33333333-3333-4333-8333-333333333333',
    parkedUserId: 'synthetic-a',
    parkedGeneration: 1,
  });
  const oldEpoch = { userId: 'synthetic-a', generation: 1 };
  const newEpoch = { userId: 'synthetic-b', generation: 2 };
  dropGuestClaimIntentIfStale({ epoch: newEpoch, isEpochCurrent: () => true });
  assert.equal(peekGuestClaimIntent(), null);
  assert.equal(
    resumeGuestClaimIntent({ epoch: oldEpoch, isEpochCurrent: () => false }).ok,
    false,
  );
  assert.equal(
    claimPresentation({ hasInvite: false, verified: true, decision: null })
      .phase,
    'invalid',
  );
});
