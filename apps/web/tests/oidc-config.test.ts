import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isOidcConfigured,
  resolveWebAuthState,
} from '../src/oidc/config';

const valid = {
  OIDC_ISSUER: 'http://127.0.0.1:8080/realms/ticket',
  OIDC_CLIENT_ID: 'ticket-web',
  OIDC_CLIENT_SECRET: 'dev-web-secret-change-me',
  OIDC_REDIRECT_URI: 'http://127.0.0.1:3000/api/auth/callback',
};

test('missing or blank OIDC env is unconfigured', () => {
  assert.equal(isOidcConfigured({}), false);
  assert.equal(
    isOidcConfigured({
      OIDC_ISSUER: '',
      OIDC_CLIENT_ID: 'ticket-web',
      OIDC_CLIENT_SECRET: 'x',
      OIDC_REDIRECT_URI: 'http://127.0.0.1:3000/api/auth/callback',
    }),
    false,
  );
  assert.equal(
    isOidcConfigured({
      OIDC_ISSUER: valid.OIDC_ISSUER,
      OIDC_CLIENT_ID: valid.OIDC_CLIENT_ID,
      OIDC_CLIENT_SECRET: '',
      OIDC_REDIRECT_URI: valid.OIDC_REDIRECT_URI,
    }),
    false,
  );
});

test('unconfigured never resolves as authenticated (even with a subject)', () => {
  const state = resolveWebAuthState({
    configured: false,
    subject: 'should_be_ignored',
  });
  assert.equal(state.authenticated, false);
  assert.equal(state.status, 'unconfigured');
});

test('configured without subject is signed out, not authenticated', () => {
  assert.equal(isOidcConfigured(valid), true);
  const state = resolveWebAuthState({ configured: true, subject: null });
  assert.equal(state.authenticated, false);
  assert.equal(state.status, 'signed_out');
});

test('configured with subject is authenticated', () => {
  const state = resolveWebAuthState({
    configured: true,
    subject: 'user-sub-1',
  });
  assert.equal(state.authenticated, true);
  assert.equal(state.status, 'signed_in');
  if (state.status === 'signed_in') {
    assert.equal(state.subject, 'user-sub-1');
  }
});
