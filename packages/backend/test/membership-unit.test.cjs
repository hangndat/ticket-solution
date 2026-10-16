const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isMembershipActive, AUTHZ_ERROR_CODES, AuthzError } = require('../dist');

test('isMembershipActive deny-by-default: missing activate, future activate, revoked', () => {
  const now = new Date('2026-10-16T12:00:00.000Z');
  assert.equal(
    isMembershipActive({ activatedAt: null, revokedAt: null }, now),
    false,
  );
  assert.equal(
    isMembershipActive(
      {
        activatedAt: new Date('2026-10-16T13:00:00.000Z'),
        revokedAt: null,
      },
      now,
    ),
    false,
  );
  assert.equal(
    isMembershipActive(
      {
        activatedAt: new Date('2026-10-16T11:00:00.000Z'),
        revokedAt: new Date('2026-10-16T11:30:00.000Z'),
      },
      now,
    ),
    false,
  );
  assert.equal(
    isMembershipActive(
      {
        activatedAt: new Date('2026-10-16T11:00:00.000Z'),
        revokedAt: null,
      },
      now,
    ),
    true,
  );
});

test('AuthzError is fail-closed and non-retryable by default', () => {
  const error = new AuthzError(
    AUTHZ_ERROR_CODES.PERMISSION_DENIED,
    'missing permission',
  );
  assert.equal(error.name, 'AuthzError');
  assert.equal(error.code, 'PERMISSION_DENIED');
  assert.equal(error.retryable, false);
  assert.ok(error instanceof Error);
});
