import assert from 'node:assert/strict';
import test from 'node:test';
import * as jose from 'jose';
import type { OidcWebConfig } from '../src/oidc/config';
import {
  clearWebRefreshFlightCache,
  singleFlightWebRefresh,
  webRefreshFlightKey,
  webRefreshFlightStatsForTests,
} from '../src/oidc/refresh-flight';
import { performWebRefreshFlight } from '../src/oidc/refresh';
import { createLocalJwks } from '../src/oidc/verify-tokens';

const ISSUER = 'http://127.0.0.1:8080/realms/ticket';
const CLIENT = 'ticket-web';
const AUD = 'ticket-api';

const baseConfig: OidcWebConfig = {
  issuer: ISSUER,
  clientId: CLIENT,
  clientSecret: 'dev-web-secret',
  redirectUri: 'http://127.0.0.1:3000/api/auth/callback',
  scopes: 'openid',
  audience: AUD,
  jwksUrl: 'http://127.0.0.1:8080/realms/ticket/protocol/openid-connect/certs',
};

async function mintAccess(privateKey: jose.KeyLike, sub: string) {
  return new jose.SignJWT({ sub, aud: AUD, azp: CLIENT })
    .setProtectedHeader({ alg: 'RS256', kid: 'web-test' })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
}

test('parallel refresh single-flight: one exchange, all waiters get same verified grant', async () => {
  clearWebRefreshFlightCache();
  const { publicKey, privateKey } = await jose.generateKeyPair('RS256');
  const jwk = await jose.exportJWK(publicKey);
  jwk.kid = 'web-test';
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

  const key = webRefreshFlightKey(refreshToken, ISSUER, CLIENT);
  const work = () =>
    performWebRefreshFlight({
      refreshToken,
      config: baseConfig,
      expectedSubject: 'user-1',
      exchange,
      jwks,
    });

  const [a, b, c] = await Promise.all([
    singleFlightWebRefresh(key, work),
    singleFlightWebRefresh(key, work),
    singleFlightWebRefresh(key, work),
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
  clearWebRefreshFlightCache();
});

test('refresh auth rejection is rejected (invalid_grant)', async () => {
  clearWebRefreshFlightCache();
  const result = await performWebRefreshFlight({
    refreshToken: 'rt-fail',
    config: baseConfig,
    exchange: async () => ({
      status: 400,
      body: { error: 'invalid_grant' },
    }),
    jwks: createLocalJwks([]),
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'rejected');
  clearWebRefreshFlightCache();
});

test('refresh IdP network failure is network, not rejected', async () => {
  clearWebRefreshFlightCache();
  const result = await performWebRefreshFlight({
    refreshToken: 'rt-net',
    config: baseConfig,
    exchange: async () => null,
    jwks: createLocalJwks([]),
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'network');
  clearWebRefreshFlightCache();
});

test('refresh IdP HTTP 5xx keeps session (network), not rejected', async () => {
  clearWebRefreshFlightCache();
  for (const status of [500, 502, 503]) {
    const result = await performWebRefreshFlight({
      refreshToken: 'rt-5xx',
      config: baseConfig,
      exchange: async () => ({
        status,
        body: { error: 'server_error' },
      }),
      jwks: createLocalJwks([]),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, 'network');
  }
  clearWebRefreshFlightCache();
});

test('refresh IdP timeout (exchange null) is network like transport failure', async () => {
  clearWebRefreshFlightCache();
  const result = await performWebRefreshFlight({
    refreshToken: 'rt-timeout',
    config: baseConfig,
    exchange: async () => {
      await new Promise((r) => setTimeout(r, 5));
      return null;
    },
    jwks: createLocalJwks([]),
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'network');
  clearWebRefreshFlightCache();
});

test('refresh failure clears flight cache and does not reuse forever', async () => {
  clearWebRefreshFlightCache();
  let exchangeCalls = 0;
  const exchange = async () => {
    exchangeCalls += 1;
    return { status: 400, body: { error: 'invalid_grant' } };
  };
  const key = webRefreshFlightKey('rt-fail', ISSUER, CLIENT);
  const first = await singleFlightWebRefresh(key, () =>
    performWebRefreshFlight({
      refreshToken: 'rt-fail',
      config: baseConfig,
      exchange,
      jwks: createLocalJwks([]),
    }),
  );
  assert.equal(first.ok, false);

  clearWebRefreshFlightCache();
  assert.deepEqual(webRefreshFlightStatsForTests(), {
    inflight: 0,
    recent: 0,
  });

  const second = await singleFlightWebRefresh(key, () =>
    performWebRefreshFlight({
      refreshToken: 'rt-fail',
      config: baseConfig,
      exchange,
      jwks: createLocalJwks([]),
    }),
  );
  assert.equal(second.ok, false);
  assert.equal(exchangeCalls, 2);
  clearWebRefreshFlightCache();
});

test('subject mismatch on refresh is rejected (no cookie apply path)', async () => {
  clearWebRefreshFlightCache();
  const { publicKey, privateKey } = await jose.generateKeyPair('RS256');
  const jwk = await jose.exportJWK(publicKey);
  jwk.kid = 'web-test';
  jwk.alg = 'RS256';
  const access = await mintAccess(privateKey, 'user-new');
  const result = await performWebRefreshFlight({
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
  clearWebRefreshFlightCache();
});

test('flight keys isolate different refresh tokens and clients', () => {
  const a = webRefreshFlightKey('rt-a', ISSUER, CLIENT);
  const b = webRefreshFlightKey('rt-b', ISSUER, CLIENT);
  const c = webRefreshFlightKey('rt-a', ISSUER, 'other-client');
  assert.notEqual(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^[a-f0-9]{64}$/);
});
