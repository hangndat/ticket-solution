const { test } = require('node:test');
const assert = require('node:assert/strict');
const jose = require('jose');
const {
  createOidcVerifier,
  createLocalJwks,
  IdentityError,
  IDENTITY_ERROR_CODES,
} = require('@ticket/backend');
const { createApp, createOpenApi } = require('../dist/app');

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

async function sign(privateKey, claims = {}) {
  return new jose.SignJWT({
    email: 'attendee@example.com',
    email_verified: false,
    ...claims,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-kid' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(claims.sub ?? 'sub_1')
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
      const userId = existing?.userId ?? '11111111-1111-4111-8111-111111111111';
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

test('GET /v1/me fail-closed without token or with bad token', async () => {
  const { verifier } = await localVerifier();
  const app = await createApp({
    logging: false,
    oidcVerifier: verifier,
    users: memoryUsers(),
  });
  try {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const missing = await app.inject({ method: 'GET', url: '/v1/me' });
    assert.equal(missing.statusCode, 401);
    assert.equal(missing.json().code, IDENTITY_ERROR_CODES.UNAUTHENTICATED);

    const bad = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: 'Bearer not-a-jwt' },
    });
    assert.equal(bad.statusCode, 401);
    assert.equal(bad.json().code, IDENTITY_ERROR_CODES.UNAUTHENTICATED);
  } finally {
    await app.close();
  }
});

test('GET /v1/me returns MeResponse including emailVerified false', async () => {
  const { privateKey, verifier } = await localVerifier();
  const app = await createApp({
    logging: false,
    oidcVerifier: verifier,
    users: memoryUsers(),
  });
  try {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const token = await sign(privateKey, { sub: 'keycloak_user_1' });
    const response = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: 'Bearer ' + token },
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      userId: '11111111-1111-4111-8111-111111111111',
      issuer: ISSUER,
      subject: 'keycloak_user_1',
      email: 'attendee@example.com',
      emailVerified: false,
    });
  } finally {
    await app.close();
  }
});

test('GET /v1/me fails closed when OIDC env missing', async () => {
  const app = await createApp({
    logging: false,
    identityBootError: new IdentityError(
      IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
      'OIDC_ISSUER, OIDC_AUDIENCE, and OIDC_JWKS_URL are required',
    ),
  });
  try {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: 'Bearer anything' },
    });
    assert.equal(response.statusCode, 503);
    assert.equal(response.json().code, IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED);
  } finally {
    await app.close();
  }
});

test('OpenAPI includes /v1/me', async () => {
  const { verifier } = await localVerifier();
  const app = await createApp({
    logging: false,
    oidcVerifier: verifier,
    users: memoryUsers(),
  });
  try {
    await app.init();
    const doc = createOpenApi(app);
    assert.ok(doc.paths['/v1/health']);
    assert.ok(doc.paths['/v1/me']);
    assert.equal(doc.components.schemas.MeDto.required.includes('emailVerified'), true);
  } finally {
    await app.close();
  }
});
