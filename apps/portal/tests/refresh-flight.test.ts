import assert from 'node:assert/strict';
import test from 'node:test';
import * as jose from 'jose';
import type { PortalOidcConfig } from '../src/oidc/config';
import {
  clearStaffRefreshFlightCache,
  singleFlightStaffRefresh,
  staffRefreshFlightKey,
  staffRefreshFlightStatsForTests,
} from '../src/oidc/refresh-flight';
import { performStaffRefreshFlight } from '../src/oidc/refresh';
import { createLocalJwks } from '../src/oidc/verify-tokens';
import { requirePublicOrigin } from '../src/oidc/public-origin';

const ISSUER = 'http://127.0.0.1:8080/realms/ticket';
const CLIENT = 'ticket-admin-web';
const AUD = 'ticket-api';

const baseConfig: PortalOidcConfig = {
  issuer: ISSUER,
  clientId: CLIENT,
  clientSecret: 'test-secret',
  redirectUri: 'http://127.0.0.1:3013/api/auth/callback',
  scopes: 'openid',
  audience: AUD,
  jwksUrl: 'http://127.0.0.1:8080/realms/ticket/protocol/openid-connect/certs',
};

async function mintAccess(privateKey: jose.KeyLike, sub: string) {
  return new jose.SignJWT({ sub, aud: AUD, azp: CLIENT })
    .setProtectedHeader({ alg: 'RS256', kid: 'portal-test' })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
}

test('requirePublicOrigin returns 503 when production origin unresolved — no Host fallback', () => {
  const prevNode = process.env.NODE_ENV;
  const prevOrigin = process.env.WEB_PUBLIC_ORIGIN;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.WEB_PUBLIC_ORIGIN;
    const missing = requirePublicOrigin({
      url: 'https://evil.example/api/auth/callback',
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.response.status, 503);

    process.env.WEB_PUBLIC_ORIGIN = 'not a url';
    const malformed = requirePublicOrigin({
      url: 'https://evil.example/api/auth/callback',
    });
    assert.equal(malformed.ok, false);
    if (!malformed.ok) assert.equal(malformed.response.status, 503);

    process.env.WEB_PUBLIC_ORIGIN = 'https://portal.vemoki.com';
    const ok = requirePublicOrigin({
      url: 'https://evil.example/api/auth/callback',
    });
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.origin, 'https://portal.vemoki.com');
  } finally {
    process.env.NODE_ENV = prevNode;
    if (prevOrigin === undefined) delete process.env.WEB_PUBLIC_ORIGIN;
    else process.env.WEB_PUBLIC_ORIGIN = prevOrigin;
  }
});

test('dev loopback still resolves via helper when WEB_PUBLIC_ORIGIN unset', () => {
  const prevNode = process.env.NODE_ENV;
  const prevOrigin = process.env.WEB_PUBLIC_ORIGIN;
  try {
    process.env.NODE_ENV = 'development';
    delete process.env.WEB_PUBLIC_ORIGIN;
    const ok = requirePublicOrigin({
      url: 'http://127.0.0.1:3013/api/auth/callback',
    });
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.origin, 'http://127.0.0.1:3013');
  } finally {
    process.env.NODE_ENV = prevNode;
    if (prevOrigin === undefined) delete process.env.WEB_PUBLIC_ORIGIN;
    else process.env.WEB_PUBLIC_ORIGIN = prevOrigin;
  }
});

test('parallel refresh single-flight: one exchange, all waiters get same verified grant', async () => {
  clearStaffRefreshFlightCache();
  const { publicKey, privateKey } = await jose.generateKeyPair('RS256');
  const jwk = await jose.exportJWK(publicKey);
  jwk.kid = 'portal-test';
  jwk.alg = 'RS256';
  const jwks = createLocalJwks(jwk);
  const access = await mintAccess(privateKey, 'user-1');
  const refreshToken = 'refresh-shared-1';

  let exchangeCalls = 0;
  const exchange = async () => {
    exchangeCalls += 1;
    await new Promise((r) => setTimeout(r, 30));
    return {
      status: 200,
      body: {
        access_token: access,
        refresh_token: 'refresh-rotated-1',
        expires_in: 300,
      },
    };
  };

  const key = staffRefreshFlightKey(refreshToken, ISSUER, CLIENT);
  const work = () =>
    performStaffRefreshFlight({
      refreshToken,
      config: baseConfig,
      expectedSubject: 'user-1',
      exchange,
      jwks,
    });

  const [a, b, c] = await Promise.all([
    singleFlightStaffRefresh(key, work),
    singleFlightStaffRefresh(key, work),
    singleFlightStaffRefresh(key, work),
  ]);

  assert.equal(exchangeCalls, 1);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(c.ok, true);
  if (a.ok && b.ok && c.ok) {
    assert.equal(a.grant.accessToken, b.grant.accessToken);
    assert.equal(b.grant.accessToken, c.grant.accessToken);
    assert.equal(a.grant.refreshToken, 'refresh-rotated-1');
    assert.equal(a.grant.subject, 'user-1');
  }
  clearStaffRefreshFlightCache();
});

test('refresh failure clears flight cache and does not reuse forever', async () => {
  clearStaffRefreshFlightCache();
  let exchangeCalls = 0;
  const exchange = async () => {
    exchangeCalls += 1;
    return { status: 400, body: { error: 'invalid_grant' } };
  };
  const key = staffRefreshFlightKey('rt-fail', ISSUER, CLIENT);
  const first = await singleFlightStaffRefresh(key, () =>
    performStaffRefreshFlight({
      refreshToken: 'rt-fail',
      config: baseConfig,
      exchange,
      jwks: createLocalJwks([]),
    }),
  );
  assert.equal(first.ok, false);
  if (!first.ok) assert.equal(first.reason, 'rejected');

  // Simulate logout / failure cleanup — must not keep serving old failure forever.
  clearStaffRefreshFlightCache();
  assert.deepEqual(staffRefreshFlightStatsForTests(), {
    inflight: 0,
    recent: 0,
  });

  const second = await singleFlightStaffRefresh(key, () =>
    performStaffRefreshFlight({
      refreshToken: 'rt-fail',
      config: baseConfig,
      exchange,
      jwks: createLocalJwks([]),
    }),
  );
  assert.equal(second.ok, false);
  assert.equal(exchangeCalls, 2);
  clearStaffRefreshFlightCache();
});

test('subject mismatch on refresh is rejected (no cookie apply path)', async () => {
  clearStaffRefreshFlightCache();
  const { publicKey, privateKey } = await jose.generateKeyPair('RS256');
  const jwk = await jose.exportJWK(publicKey);
  jwk.kid = 'portal-test';
  jwk.alg = 'RS256';
  const access = await mintAccess(privateKey, 'user-new');
  const result = await performStaffRefreshFlight({
    refreshToken: 'rt-x',
    config: baseConfig,
    expectedSubject: 'user-old',
    exchange: async () => ({
      status: 200,
      body: { access_token: access, expires_in: 300 },
    }),
    jwks: createLocalJwks(jwk),
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'rejected');
  clearStaffRefreshFlightCache();
});

test('flight keys isolate different refresh tokens and clients', () => {
  const a = staffRefreshFlightKey('rt-a', ISSUER, CLIENT);
  const b = staffRefreshFlightKey('rt-b', ISSUER, CLIENT);
  const c = staffRefreshFlightKey('rt-a', ISSUER, 'other-client');
  assert.notEqual(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^[a-f0-9]{64}$/);
});
