import assert from 'node:assert/strict';
import test from 'node:test';
import {
  APPROVAL_PENDING,
  FORM_ERROR_CODES,
  ISSUE_ERROR_CODES,
} from '@ticket/contracts';
import { decideRedeemBody } from '../src/redeem/decide';
import { messageForDecision } from '../src/redeem/messages';
import {
  isOwnerRedemptionStatus,
} from '../src/redeem/owner-status';
import {
  parsePublishedRedeemSchema,
} from '../src/redeem/published-schema';
import {
  redeemPayloadFingerprint,
  resolveIdempotencyKey,
} from '../src/redeem/attempt-key';

test('pending hold is not issued or denied', () => {
  const decision = decideRedeemBody(
    200,
    {
      code: APPROVAL_PENDING,
      requestId: '55555555-5555-4555-8555-555555555555',
      operationId: '66666666-6666-4666-8666-666666666666',
      eventId: '22222222-2222-4222-8222-222222222222',
      ticketTypeId: 'tt',
      sourceId: 'src',
      status: 'PENDING_REVIEW',
      expiresAt: '2026-10-18T10:00:00.000Z',
      replayed: false,
    },
    'key-1',
  );
  assert.equal(decision.kind, 'pending');
  if (decision.kind === 'pending') {
    assert.match(decision.message, /no seat guarantee/i);
    assert.equal(messageForDecision(decision).kind, 'pending');
  }
});

test('issued ticket and stale form/terms are discriminated', () => {
  const issued = decideRedeemBody(
    201,
    {
      ticketId: '99999999-9999-4999-8999-999999999999',
      requestId: 'r',
      operationId: 'o',
      eventId: 'e',
      ticketTypeId: 't',
      sourceId: 's',
      state: 'ACTIVE',
      credentialVersion: 1,
      replayed: false,
    },
    'key-2',
  );
  assert.equal(issued.kind, 'issued');

  const stale = decideRedeemBody(
    409,
    {
      code: FORM_ERROR_CODES.FORM_VERSION_STALE,
      message: 'reload',
      requestId: 'r',
      retryable: false,
    },
    'key-3',
  );
  assert.equal(stale.kind, 'stale');
  assert.equal(messageForDecision(stale).kind, 'stale');

  const expired = decideRedeemBody(
    410,
    {
      code: FORM_ERROR_CODES.PENDING_EXPIRED,
      message: 'gone',
      requestId: 'r',
      retryable: false,
    },
    'key-4',
  );
  assert.equal(expired.kind, 'expired');
});

test('network / 5xx stays unknown — not a ticket', () => {
  const decision = decideRedeemBody(0, null, 'keep-key', true);
  assert.equal(decision.kind, 'unknown');
  if (decision.kind === 'unknown') {
    assert.equal(decision.idempotencyKey, 'keep-key');
  }
  const denied = decideRedeemBody(
    422,
    { code: ISSUE_ERROR_CODES.CODE_INVALID, message: 'bad', requestId: 'r', retryable: false },
    'k',
  );
  assert.equal(denied.kind, 'denied');
});

test('fingerprint includes answers+consent; timeout reuses same key', () => {
  const payload = {
    tenantId: '11111111-1111-4111-8111-111111111111',
    eventId: '22222222-2222-4222-8222-222222222222',
    code: 'CODE-A',
    formVersion: 'form-v1',
    termsVersion: 'terms-v1',
    answers: { full_name: 'Ada', agree: true },
    termsAccepted: true,
  };
  const fingerprint = redeemPayloadFingerprint(payload);
  assert.match(fingerprint, /full_name/);
  assert.match(fingerprint, /termsAccepted/);

  const existing = { key: 'keep-me', fingerprint, unclear: true };
  const reused = resolveIdempotencyKey(existing, fingerprint, () => 'fresh');
  assert.equal(reused.reused, true);
  assert.equal(reused.key, 'keep-me');

  const changedConsent = resolveIdempotencyKey(
    existing,
    redeemPayloadFingerprint({ ...payload, termsAccepted: false }),
    () => 'fresh-2',
  );
  assert.equal(changedConsent.reused, false);
});

test('owner status and published schema parsers accept C-F shapes', () => {
  assert.equal(
    isOwnerRedemptionStatus({
      status: 'PENDING_REVIEW',
      requestId: '55555555-5555-4555-8555-555555555555',
      eventId: '22222222-2222-4222-8222-222222222222',
      ticketTypeId: 't',
      sourceId: 's',
      expiresAt: null,
      submittedAt: '2026-10-17T10:00:00.000Z',
    }),
    true,
  );
  assert.equal(
    isOwnerRedemptionStatus({ status: 'ISSUED', requestId: 'r', eventId: 'e' }),
    false,
  );

  const schema = parsePublishedRedeemSchema({
    id: '22222222-2222-4222-8222-222222222222',
    tenantId: '11111111-1111-4111-8111-111111111111',
    schemaVersion: 1,
    publishedConfigVersion: 2,
    form: {
      formVersion: 'form-v1',
      fields: [
        { id: 'full_name', label: 'Name', type: 'text', required: true },
      ],
    },
    terms: { version: 'terms-v1', bodyMarkdown: 'Be kind.' },
  });
  assert.ok(schema);
  assert.equal(schema?.tenantId, '11111111-1111-4111-8111-111111111111');
  assert.equal(schema?.form?.formVersion, 'form-v1');
  assert.equal(schema?.terms?.version, 'terms-v1');
});
