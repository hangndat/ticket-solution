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

async function sign(privateKey) {
  return new jose.SignJWT({
    email: 'attendee@example.com',
    email_verified: true,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-kid' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject('me_tickets_sub')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
}

function memoryUsers() {
  const rows = new Map();
  return {
    async upsertFromVerifiedIdentity(identity) {
      const key = identity.issuer + '\0' + identity.subject;
      const existing = rows.get(key);
      const userId = existing?.userId ?? '22222222-2222-4222-8222-222222222222';
      const stored = {
        userId,
        issuer: identity.issuer,
        subject: identity.subject,
        email: identity.email,
        emailVerified: identity.emailVerified,
      };
      rows.set(key, stored);
      return stored;
    },
  };
}

test('GET /v1/me/tickets auth and tenantId validation', async () => {
  const { privateKey, verifier } = await localVerifier();
  const app = await createApp({
    logging: false,
    oidcVerifier: verifier,
    users: memoryUsers(),
    env: {
      ...process.env,
      CODE_HMAC_PEPPER: 'api-me-tickets-test-pepper',
      CODE_HMAC_VERSION: '1',
      TICKET_CREDENTIAL_KEY: 'api-me-tickets-cred-key-material',
    },
  });
  try {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const unauth = await app.inject({ method: 'GET', url: '/v1/me/tickets' });
    assert.equal(unauth.statusCode, 401);
    assert.equal(unauth.json().code, IDENTITY_ERROR_CODES.UNAUTHENTICATED);

    const token = await sign(privateKey);
    const badTenant = await app.inject({
      method: 'GET',
      url: '/v1/me/tickets?tenantId=not-a-uuid',
      headers: { authorization: 'Bearer ' + token },
    });
    assert.equal(badTenant.statusCode, 422);
    assert.equal(badTenant.json().code, 'INVALID_TENANT');

    const noDb = await app.inject({
      method: 'GET',
      url: '/v1/me/tickets',
      headers: { authorization: 'Bearer ' + token },
    });
    assert.equal(noDb.statusCode, 503);
    assert.equal(noDb.json().code, IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED);
  } finally {
    await app.close();
  }
});
