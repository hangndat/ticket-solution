import assert from 'node:assert/strict';
import { test } from 'node:test';
import { claimPresentation } from './claim-presentation.ts';

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
