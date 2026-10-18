import assert from 'node:assert/strict';
import test from 'node:test';
import {
  gateDeeplinkUrl,
  isGateDeeplinkId,
  isPortalOidcConfigured,
  productOrigin,
  resolvePortalAuthState,
} from '../src/oidc/config';
import { isPlatformOidcConfigured } from '../src/oidc/platform-config';
import {
  codeChallengeS256,
  generateCodeVerifier,
  generateOAuthState,
  generateOidcNonce,
} from '../src/oidc/pkce';

const valid = {
  OIDC_ISSUER: 'http://127.0.0.1:8080/realms/ticket',
  OIDC_CLIENT_ID: 'ticket-admin-web',
  OIDC_CLIENT_SECRET: 'test-secret',
  OIDC_REDIRECT_URI: 'http://127.0.0.1:3013/api/auth/callback',
  OIDC_AUDIENCE: 'ticket-api',
  OIDC_JWKS_URL:
    'http://127.0.0.1:8080/realms/ticket/protocol/openid-connect/certs',
};

test('portal OIDC requires audience + jwks — fail-closed when blank', () => {
  assert.equal(isPortalOidcConfigured({}), false);
  assert.equal(
    isPortalOidcConfigured({
      ...valid,
      OIDC_CLIENT_SECRET: '',
    }),
    false,
  );
  assert.equal(
    isPortalOidcConfigured({
      ...valid,
      OIDC_AUDIENCE: '',
    }),
    false,
  );
  assert.equal(isPortalOidcConfigured(valid), true);
});

test('unconfigured never resolves as authenticated even with a cookie present', () => {
  assert.deepEqual(
    resolvePortalAuthState({ configured: false, hasAccessToken: true }),
    { status: 'unconfigured', authenticated: false },
  );
  assert.deepEqual(
    resolvePortalAuthState({ configured: true, hasAccessToken: false }),
    { status: 'signed_out', authenticated: false },
  );
  assert.deepEqual(
    resolvePortalAuthState({ configured: true, hasAccessToken: true }),
    { status: 'signed_in', authenticated: true },
  );
});

test('PKCE S256 + nonce generators are opaque random values', () => {
  const verifier = generateCodeVerifier();
  assert.match(verifier, /^[A-Za-z0-9_-]+$/);
  assert.equal(codeChallengeS256(verifier), codeChallengeS256(verifier));
  assert.notEqual(
    codeChallengeS256(verifier),
    codeChallengeS256(generateCodeVerifier()),
  );
  assert.notEqual(generateOAuthState(), generateOAuthState());
  assert.notEqual(generateOidcNonce(), generateOidcNonce());
});

test('Gate deeplink allowlists tenantId/eventId query only', () => {
  assert.equal(
    gateDeeplinkUrl({ PRODUCT_ORIGIN: 'https://app.vemoki.com' }),
    'https://app.vemoki.com/gate',
  );
  assert.equal(
    gateDeeplinkUrl(
      { PRODUCT_ORIGIN: 'https://app.vemoki.com' },
      '/gate',
      { tenantId: 't1', eventId: 'e2' },
    ),
    'https://app.vemoki.com/gate?tenantId=t1&eventId=e2',
  );
  assert.equal(
    gateDeeplinkUrl(
      { PRODUCT_ORIGIN: 'https://app.vemoki.com' },
      '/gate',
      { tenantId: '../evil', eventId: 'e2' },
    ),
    'https://app.vemoki.com/gate?eventId=e2',
  );
  assert.equal(isGateDeeplinkId('ok_1-2'), true);
  assert.equal(isGateDeeplinkId('bad/id'), false);
  assert.equal(
    productOrigin({ PRODUCT_ORIGIN: 'https://app.vemoki.com/extra' }),
    'https://app.vemoki.com',
  );
});

test('platform OIDC zone requires audience + acr + jwks — isolated from staff client', () => {
  assert.equal(isPlatformOidcConfigured(valid), false);
  assert.equal(
    isPlatformOidcConfigured({
      ...valid,
      PLATFORM_OIDC_CLIENT_ID: 'ticket-platform-web',
      PLATFORM_OIDC_CLIENT_SECRET: 'plat-secret',
      PLATFORM_OIDC_REDIRECT_URI:
        'http://127.0.0.1:3013/api/auth/platform/callback',
      PLATFORM_OIDC_AUDIENCE: 'ticket-platform-api',
      PLATFORM_OIDC_REQUIRED_ACR: '2',
    }),
    true,
  );
});
