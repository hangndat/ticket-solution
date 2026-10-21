import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWebAuthorizeUrl } from '../src/oidc/authorize';
import type { OidcWebConfig } from '../src/oidc/config';

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
    codeChallenge: 'challenge',
  });
  assert.equal(url.searchParams.get('audience'), 'ticket-api');
  assert.equal(url.searchParams.get('client_id'), 'ticket-web');
  assert.equal(url.searchParams.get('code_challenge'), 'challenge');
});
