import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWebAuthorizeUrl } from '../src/oidc/authorize';
import type { OidcWebConfig } from '../src/oidc/config';
import { generateOAuthState, generateOidcNonce } from '../src/oidc/pkce';

const config: OidcWebConfig = {
  issuer: 'http://127.0.0.1:8080/realms/ticket',
  clientId: 'ticket-web',
  clientSecret: 'secret',
  redirectUri: 'http://127.0.0.1:3000/api/auth/callback',
  scopes: 'openid profile email',
  audience: 'ticket-api',
  jwksUrl:
    'http://127.0.0.1:8080/realms/ticket/protocol/openid-connect/certs',
};

test('buildWebAuthorizeUrl requests ticket-api audience for Keycloak', () => {
  const url = buildWebAuthorizeUrl(config, {
    state: 'state-1',
    nonce: 'nonce-1',
    codeChallenge: 'challenge',
  });
  assert.equal(url.searchParams.get('audience'), 'ticket-api');
  assert.equal(url.searchParams.get('client_id'), 'ticket-web');
  assert.equal(url.searchParams.get('code_challenge'), 'challenge');
  assert.equal(url.searchParams.get('nonce'), 'nonce-1');
});

test('OIDC nonce is a fresh value independent of OAuth state', () => {
  const state = generateOAuthState();
  const first = generateOidcNonce();
  const second = generateOidcNonce();
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, state);
  assert.notEqual(first, second);
});
