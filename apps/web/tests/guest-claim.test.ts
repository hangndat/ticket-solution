import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { APPROVAL_PENDING, IMPORT_ERROR_CODES } from '@ticket/contracts';
import {
  decideClaimBody,
  invitationClaimUpstreamPath,
} from '../src/guest/claim-api';
import {
  clearGuestClaimIntent,
  parkGuestClaimIntent,
  peekGuestClaimIntent,
  redactGuestClaimIntent,
  resumeGuestClaimIntent,
} from '../src/guest/claim-intent';

const scope = {
  tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  eventId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
};

describe('guest claim intent (no token logs)', () => {
  it('parks/resumes and redacts token', () => {
    clearGuestClaimIntent();
    const parked = parkGuestClaimIntent({
      token: 'super-secret-claim-token',
      tenantId: scope.tenantId,
      eventId: scope.eventId,
      tenantSlug: 'acme',
      eventSlug: 'gala',
    });
    assert.equal(peekGuestClaimIntent()?.token, parked.token);
    const resumed = resumeGuestClaimIntent();
    assert.equal(resumed.ok, true);

    const redacted = redactGuestClaimIntent(parked);
    assert.ok(redacted);
    assert.equal(redacted?.hasToken, true);
    assert.equal(redacted?.tokenLength, parked.token.length);
    assert.equal(
      JSON.stringify(redacted).includes('super-secret-claim-token'),
      false,
    );

    clearGuestClaimIntent();
    assert.equal(peekGuestClaimIntent(), null);
    assert.equal(resumeGuestClaimIntent().ok, false);
  });
});

describe('decideClaimBody C-I safety', () => {
  it('builds claim path and maps wrong-email / unverified / expired', () => {
    assert.equal(
      invitationClaimUpstreamPath(scope),
      `/v1/tenants/${scope.tenantId}/events/${scope.eventId}/invitations/claim`,
    );

    const key = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const mismatch = decideClaimBody(
      403,
      {
        code: IMPORT_ERROR_CODES.INVITATION_EMAIL_MISMATCH,
        message: 'mismatch',
        requestId: 'r1',
        retryable: false,
      },
      key,
      false,
    );
    assert.equal(mismatch.kind, 'denied');
    if (mismatch.kind === 'denied') {
      assert.equal(mismatch.code, IMPORT_ERROR_CODES.INVITATION_EMAIL_MISMATCH);
      assert.ok(mismatch.message.includes('không cấp vé'));
    }

    const unverified = decideClaimBody(
      403,
      {
        code: IMPORT_ERROR_CODES.EMAIL_NOT_VERIFIED,
        message: 'unverified',
        requestId: 'r2',
        retryable: false,
      },
      key,
      false,
    );
    assert.equal(unverified.kind, 'denied');

    const expired = decideClaimBody(
      410,
      {
        code: IMPORT_ERROR_CODES.INVITATION_EXPIRED,
        message: 'expired',
        requestId: 'r3',
        retryable: false,
      },
      key,
      false,
    );
    assert.equal(expired.kind, 'expired');

    const issued = decideClaimBody(
      201,
      {
        ticketId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        requestId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        operationId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        eventId: scope.eventId,
        ticketTypeId: 't',
        sourceId: 's',
        state: 'ACTIVE',
        credentialVersion: 1,
        replayed: false,
      },
      key,
      false,
    );
    assert.equal(issued.kind, 'issued');

    const pending = decideClaimBody(
      200,
      {
        code: APPROVAL_PENDING,
        status: 'PENDING_REVIEW',
        requestId: '11111111-1111-4111-8111-111111111111',
        operationId: '22222222-2222-4222-8222-222222222222',
        eventId: scope.eventId,
        ticketTypeId: 't',
        sourceId: 's',
        replayed: false,
      },
      key,
      false,
    );
    // Pending is not a ticket
    assert.equal(pending.kind, 'pending');
  });

  it('network/unknown never looks like issued ticket', () => {
    const key = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const unknown = decideClaimBody(0, null, key, true);
    assert.equal(unknown.kind, 'unknown');
    assert.notEqual(unknown.kind, 'issued');
  });
});
