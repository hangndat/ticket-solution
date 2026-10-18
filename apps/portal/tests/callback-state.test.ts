import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Pure callback validation mirror — same rules as /api/auth/callback.
 * Keeps PKCE/state fail-closed without spinning Next runtime.
 */
function validateCallbackState(input: {
  code: string | null;
  state: string | null;
  expectedState: string | null | undefined;
  verifier: string | null | undefined;
  oauthError: string | null;
}): 'ok' | 'oauth_error' | 'invalid_state' {
  if (input.oauthError) return 'oauth_error';
  if (
    !input.code ||
    !input.state ||
    !input.expectedState ||
    input.state !== input.expectedState ||
    !input.verifier
  ) {
    return 'invalid_state';
  }
  return 'ok';
}

test('callback rejects missing code/state/verifier or state mismatch', () => {
  assert.equal(
    validateCallbackState({
      code: null,
      state: 's',
      expectedState: 's',
      verifier: 'v',
      oauthError: null,
    }),
    'invalid_state',
  );
  assert.equal(
    validateCallbackState({
      code: 'c',
      state: 'a',
      expectedState: 'b',
      verifier: 'v',
      oauthError: null,
    }),
    'invalid_state',
  );
  assert.equal(
    validateCallbackState({
      code: 'c',
      state: 's',
      expectedState: 's',
      verifier: undefined,
      oauthError: null,
    }),
    'invalid_state',
  );
});

test('callback surfaces IdP oauth error separately from state failure', () => {
  assert.equal(
    validateCallbackState({
      code: 'c',
      state: 's',
      expectedState: 's',
      verifier: 'v',
      oauthError: 'access_denied',
    }),
    'oauth_error',
  );
  assert.equal(
    validateCallbackState({
      code: 'c',
      state: 's',
      expectedState: 's',
      verifier: 'v',
      oauthError: null,
    }),
    'ok',
  );
});
