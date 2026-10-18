import assert from 'node:assert/strict';
import test from 'node:test';
import * as jose from 'jose';
import {
  acceptOidcTokenGrant,
  createLocalJwks,
  TokenVerifyError,
  verifyAccessToken,
  verifyIdToken,
} from '../src/oidc/verify-tokens';

const ISSUER = 'http://127.0.0.1:8080/realms/ticket';
const STAFF_CLIENT = 'ticket-admin-web';
const STAFF_AUD = 'ticket-api';
const PLATFORM_CLIENT = 'ticket-platform-web';
const PLATFORM_AUD = 'ticket-platform-api';

async function testKeys() {
  const { publicKey, privateKey } = await jose.generateKeyPair('RS256');
  const jwk = await jose.exportJWK(publicKey);
  jwk.kid = 'portal-test';
  jwk.alg = 'RS256';
  return {
    privateKey,
    jwks: createLocalJwks(jwk),
  };
}

async function signAccess(
  privateKey: jose.KeyLike,
  claims: Record<string, unknown>,
) {
  return new jose.SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'portal-test' })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
}

async function signId(
  privateKey: jose.KeyLike,
  claims: Record<string, unknown>,
) {
  return new jose.SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'portal-test' })
    .setIssuer(ISSUER)
    .setAudience(STAFF_CLIENT)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
}

test('accepts staff grant when access aud + id_token nonce verify via local JWKS', async () => {
  const { privateKey, jwks } = await testKeys();
  const nonce = 'n-ok';
  const access = await signAccess(privateKey, {
    sub: 'user-1',
    aud: STAFF_AUD,
    azp: STAFF_CLIENT,
  });
  const idToken = await signId(privateKey, {
    sub: 'user-1',
    nonce,
  });
  const grant = await acceptOidcTokenGrant({
    accessToken: access,
    idToken,
    refreshToken: 'rt-1',
    issuer: ISSUER,
    clientId: STAFF_CLIENT,
    accessAudience: STAFF_AUD,
    jwks,
    nonce,
  });
  assert.equal(grant.subject, 'user-1');
  assert.equal(grant.idToken, idToken);
});

test('rejects wrong nonce, issuer, audience, signature, expired, subject mismatch', async () => {
  const { privateKey, jwks } = await testKeys();
  const other = await jose.generateKeyPair('RS256');
  const nonce = 'n-expected';

  const goodAccess = await signAccess(privateKey, {
    sub: 'user-1',
    aud: STAFF_AUD,
  });
  const wrongNonceId = await signId(privateKey, {
    sub: 'user-1',
    nonce: 'n-other',
  });
  await assert.rejects(
    () =>
      acceptOidcTokenGrant({
        accessToken: goodAccess,
        idToken: wrongNonceId,
        issuer: ISSUER,
        clientId: STAFF_CLIENT,
        accessAudience: STAFF_AUD,
        jwks,
        nonce,
      }),
    (err: unknown) =>
      err instanceof TokenVerifyError && err.reason === 'nonce',
  );

  const wrongIssAccess = await new jose.SignJWT({
    sub: 'user-1',
    aud: STAFF_AUD,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'portal-test' })
    .setIssuer('http://evil.example/realms/x')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
  await assert.rejects(
    () =>
      verifyAccessToken(wrongIssAccess, {
        issuer: ISSUER,
        audience: STAFF_AUD,
        clientId: STAFF_CLIENT,
        jwks,
      }),
    (err: unknown) =>
      err instanceof TokenVerifyError && err.reason === 'issuer',
  );

  const wrongAud = await signAccess(privateKey, {
    sub: 'user-1',
    aud: 'wrong-api',
  });
  await assert.rejects(
    () =>
      verifyAccessToken(wrongAud, {
        issuer: ISSUER,
        audience: STAFF_AUD,
        clientId: STAFF_CLIENT,
        jwks,
      }),
    (err: unknown) =>
      err instanceof TokenVerifyError && err.reason === 'audience',
  );

  const forged = await signAccess(other.privateKey, {
    sub: 'user-1',
    aud: STAFF_AUD,
  });
  await assert.rejects(
    () =>
      verifyAccessToken(forged, {
        issuer: ISSUER,
        audience: STAFF_AUD,
        clientId: STAFF_CLIENT,
        jwks,
      }),
    (err: unknown) =>
      err instanceof TokenVerifyError && err.reason === 'invalid_signature',
  );

  const expired = await new jose.SignJWT({ sub: 'user-1', aud: STAFF_AUD })
    .setProtectedHeader({ alg: 'RS256', kid: 'portal-test' })
    .setIssuer(ISSUER)
    .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
    .sign(privateKey);
  await assert.rejects(
    () =>
      verifyAccessToken(expired, {
        issuer: ISSUER,
        audience: STAFF_AUD,
        clientId: STAFF_CLIENT,
        jwks,
      }),
    (err: unknown) =>
      err instanceof TokenVerifyError && err.reason === 'expired',
  );

  const idOtherSub = await signId(privateKey, {
    sub: 'user-2',
    nonce,
  });
  await assert.rejects(
    () =>
      acceptOidcTokenGrant({
        accessToken: goodAccess,
        idToken: idOtherSub,
        issuer: ISSUER,
        clientId: STAFF_CLIENT,
        accessAudience: STAFF_AUD,
        jwks,
        nonce,
      }),
    (err: unknown) =>
      err instanceof TokenVerifyError && err.reason === 'subject',
  );

  const matchingId = await signId(privateKey, { sub: 'user-1', nonce });
  await assert.rejects(
    () =>
      acceptOidcTokenGrant({
        accessToken: goodAccess,
        idToken: matchingId,
        issuer: ISSUER,
        clientId: STAFF_CLIENT,
        accessAudience: STAFF_AUD,
        jwks,
        nonce,
        expectedSubject: 'someone-else',
      }),
    (err: unknown) =>
      err instanceof TokenVerifyError && err.reason === 'subject',
  );
});

test('platform access requires exact ACR string and fresh auth_time (default 900s)', async () => {
  const { privateKey, jwks } = await testKeys();
  const now = Math.floor(Date.now() / 1000);
  const ok = await signAccess(privateKey, {
    sub: 'ops-1',
    aud: PLATFORM_AUD,
    azp: PLATFORM_CLIENT,
    acr: '2',
    auth_time: now - 30,
  });
  const verified = await verifyAccessToken(ok, {
    issuer: ISSUER,
    audience: PLATFORM_AUD,
    clientId: PLATFORM_CLIENT,
    jwks,
    platform: { requiredAcr: '2', maxAuthAgeSeconds: 900 },
  });
  assert.equal(verified.subject, 'ops-1');

  const wrongAcr = await signAccess(privateKey, {
    sub: 'ops-1',
    aud: PLATFORM_AUD,
    acr: '1',
    auth_time: now - 30,
  });
  await assert.rejects(
    () =>
      verifyAccessToken(wrongAcr, {
        issuer: ISSUER,
        audience: PLATFORM_AUD,
        clientId: PLATFORM_CLIENT,
        jwks,
        platform: { requiredAcr: '2', maxAuthAgeSeconds: 900 },
      }),
    (err: unknown) => err instanceof TokenVerifyError && err.reason === 'acr',
  );

  // Numeric-looking ACR must still be exact string equality, not >=.
  const acrNumericTrap = await signAccess(privateKey, {
    sub: 'ops-1',
    aud: PLATFORM_AUD,
    acr: '3',
    auth_time: now - 30,
  });
  await assert.rejects(
    () =>
      verifyAccessToken(acrNumericTrap, {
        issuer: ISSUER,
        audience: PLATFORM_AUD,
        clientId: PLATFORM_CLIENT,
        jwks,
        platform: { requiredAcr: '2', maxAuthAgeSeconds: 900 },
      }),
    (err: unknown) => err instanceof TokenVerifyError && err.reason === 'acr',
  );

  const stale = await signAccess(privateKey, {
    sub: 'ops-1',
    aud: PLATFORM_AUD,
    acr: '2',
    auth_time: now - 901,
  });
  await assert.rejects(
    () =>
      verifyAccessToken(stale, {
        issuer: ISSUER,
        audience: PLATFORM_AUD,
        clientId: PLATFORM_CLIENT,
        jwks,
        platform: { requiredAcr: '2', maxAuthAgeSeconds: 900 },
      }),
    (err: unknown) =>
      err instanceof TokenVerifyError && err.reason === 'auth_time',
  );
});

test('multi-aud id_token requires azp === client_id', async () => {
  const { privateKey, jwks } = await testKeys();
  const nonce = 'n-azp';
  const withAzp = await new jose.SignJWT({
    sub: 'user-1',
    nonce,
    azp: STAFF_CLIENT,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'portal-test' })
    .setIssuer(ISSUER)
    .setAudience([STAFF_CLIENT, 'extra'])
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
  const ok = await verifyIdToken(withAzp, {
    issuer: ISSUER,
    clientId: STAFF_CLIENT,
    nonce,
    jwks,
  });
  assert.equal(ok.subject, 'user-1');

  const missingAzp = await new jose.SignJWT({ sub: 'user-1', nonce })
    .setProtectedHeader({ alg: 'RS256', kid: 'portal-test' })
    .setIssuer(ISSUER)
    .setAudience([STAFF_CLIENT, 'extra'])
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
  await assert.rejects(
    () =>
      verifyIdToken(missingAzp, {
        issuer: ISSUER,
        clientId: STAFF_CLIENT,
        nonce,
        jwks,
      }),
    (err: unknown) => err instanceof TokenVerifyError && err.reason === 'azp',
  );
});
