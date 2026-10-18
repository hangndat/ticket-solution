import assert from 'node:assert/strict';
import test from 'node:test';
import {
  gateDeeplinkUrl,
  isPortalOidcConfigured,
  productOrigin,
  resolvePortalAuthState,
} from '../src/oidc/config';
import { isPlatformOidcConfigured } from '../src/oidc/platform-config';
import { classifyRefreshFailure } from '../src/oidc/refresh';
import {
  codeChallengeS256,
  generateCodeVerifier,
  generateOAuthState,
} from '../src/oidc/pkce';

const valid = {
  OIDC_ISSUER: 'http://127.0.0.1:8080/realms/ticket',
  OIDC_CLIENT_ID: 'ticket-admin-web',
  OIDC_CLIENT_SECRET: 'dev-admin-secret',
  OIDC_REDIRECT_URI: 'http://127.0.0.1:3013/api/auth/callback',
};

test('portal OIDC requires ticket-admin-web style env — fail-closed when blank', () => {
  assert.equal(isPortalOidcConfigured({}), false);
  assert.equal(
    isPortalOidcConfigured({
      ...valid,
      OIDC_CLIENT_SECRET: '',
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

test('PKCE S256 challenge is deterministic for a verifier and state is opaque', () => {
  const verifier = generateCodeVerifier();
  assert.match(verifier, /^[A-Za-z0-9_-]+$/);
  assert.equal(codeChallengeS256(verifier), codeChallengeS256(verifier));
  assert.notEqual(codeChallengeS256(verifier), codeChallengeS256(generateCodeVerifier()));
  assert.notEqual(generateOAuthState(), generateOAuthState());
});

test('refresh failure classification clears session reasons without mock success', () => {
  assert.equal(
    classifyRefreshFailure({
      configured: false,
      hasRefresh: true,
      httpStatus: 200,
      accessToken: 'x',
    }).reason,
    'misconfigured',
  );
  assert.equal(
    classifyRefreshFailure({
      configured: true,
      hasRefresh: false,
      httpStatus: 200,
      accessToken: 'x',
    }).reason,
    'missing_refresh',
  );
  assert.equal(
    classifyRefreshFailure({
      configured: true,
      hasRefresh: true,
      httpStatus: null,
    }).reason,
    'network',
  );
  assert.equal(
    classifyRefreshFailure({
      configured: true,
      hasRefresh: true,
      httpStatus: 400,
    }).reason,
    'rejected',
  );
});

test('Gate deeplink targets PRODUCT_ORIGIN /gate — never portal scan path', () => {
  assert.equal(
    gateDeeplinkUrl({ PRODUCT_ORIGIN: 'https://app.vemoki.com' }),
    'https://app.vemoki.com/gate',
  );
  assert.equal(
    productOrigin({ PRODUCT_ORIGIN: 'https://app.vemoki.com/extra' }),
    'https://app.vemoki.com',
  );
});

test('platform OIDC zone requires audience + acr — isolated from staff client', () => {
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
