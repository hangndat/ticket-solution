const { test } = require('node:test');
const assert = require('node:assert/strict');
const jose = require('jose');
const {
  createOidcVerifier,
  createLocalJwks,
  IDENTITY_ERROR_CODES,
} = require('@ticket/backend');
const { createApp } = require('../dist/app');

const ISSUER = 'http://127.0.0.1:8080/realms/ticket';
const AUDIENCE = 'ticket-api';

async function localVerifier() {
  const { privateKey, publicKey } = await jose.generateKeyPair('RS256');
  const publicJwk = await jose.exportJWK(publicKey);
  publicJwk.kid = 'test-kid';
  publicJwk.alg = 'RS256';
  publicJwk.use = 'sig';
  const verifier = createOidcVerifier(
    {
      issuer: ISSUER,
      audience: AUDIENCE,
      jwksUrl: 'https://jwks.test.local/jwks.json',
    },
    { jwks: createLocalJwks(publicJwk) },
  );
  return { privateKey, verifier };
}

function memoryUsers() {
  return {
    async upsertFromVerifiedIdentity(identity) {
      return {
        userId: '11111111-1111-4111-8111-111111111111',
        issuer: identity.issuer,
        subject: identity.subject,
        email: identity.email,
        emailVerified: identity.emailVerified,
      };
    },
  };
}

test('GET event report rejects a non-uuid scope', async () => {
  const app = await createApp(false);
  try {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/tenants/not-a-uuid/events/also-bad/report',
    });
    assert.equal(response.statusCode, 422);
    assert.equal(response.json().code, 'SCOPE_REQUIRED');
  } finally {
    await app.close();
  }
});

test('GET event report requires a bearer before reading tenant data', async () => {
  const { privateKey, verifier } = await localVerifier();
  const app = await createApp({
    logging: false,
    oidcVerifier: verifier,
    users: memoryUsers(),
  });
  try {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const missing = await app.inject({
      method: 'GET',
      url: '/v1/tenants/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/events/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/report',
    });
    assert.equal(missing.statusCode, 401);
    assert.equal(missing.json().code, IDENTITY_ERROR_CODES.UNAUTHENTICATED);

    const token = await new jose.SignJWT({
      email: 'staff@example.com',
      email_verified: true,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-kid' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setSubject('staff')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);
    const authed = await app.inject({
      method: 'GET',
      url: '/v1/tenants/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/events/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/report',
      headers: { authorization: 'Bearer ' + token },
    });
    assert.equal(authed.statusCode, 503);
    assert.equal(authed.json().code, IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED);
    assert.equal(
      JSON.stringify(authed.json()).includes('staff@example.com'),
      false,
    );
  } finally {
    await app.close();
  }
});
