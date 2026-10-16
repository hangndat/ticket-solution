import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isClerkConfigured,
  resolveWebAuthState,
} from '../src/clerk/config';

test('missing or blank Clerk keys are unconfigured', () => {
  assert.equal(isClerkConfigured({}), false);
  assert.equal(
    isClerkConfigured({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: '',
      CLERK_SECRET_KEY: '',
    }),
    false,
  );
  assert.equal(
    isClerkConfigured({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_x',
      CLERK_SECRET_KEY: '',
    }),
    false,
  );
  assert.equal(
    isClerkConfigured({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: '   ',
      CLERK_SECRET_KEY: 'sk_test_x',
    }),
    false,
  );
});

test('unconfigured never resolves as authenticated (even with a userId)', () => {
  const state = resolveWebAuthState({
    configured: false,
    userId: 'user_should_be_ignored',
  });
  assert.equal(state.authenticated, false);
  assert.equal(state.status, 'unconfigured');
});

test('configured without userId is signed out, not authenticated', () => {
  assert.equal(
    isClerkConfigured({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_x',
      CLERK_SECRET_KEY: 'sk_test_x',
    }),
    true,
  );
  const state = resolveWebAuthState({ configured: true, userId: null });
  assert.equal(state.authenticated, false);
  assert.equal(state.status, 'signed_out');
});

test('configured with userId is authenticated', () => {
  const state = resolveWebAuthState({
    configured: true,
    userId: 'user_abc',
  });
  assert.equal(state.authenticated, true);
  assert.equal(state.status, 'signed_in');
  if (state.status === 'signed_in') {
    assert.equal(state.userId, 'user_abc');
  }
});
