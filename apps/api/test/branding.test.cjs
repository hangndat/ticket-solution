const { test } = require('node:test');
const assert = require('node:assert/strict');
const jose = require('jose');
const {
  createOidcVerifier,
  createLocalJwks,
  AuthzError,
  AUTHZ_ERROR_CODES,
  BrandingError,
  BRANDING_ERROR_CODES,
  IDENTITY_ERROR_CODES,
} = require('@ticket/backend');
const { createApp } = require('../dist/app');

const ISSUER = 'http://127.0.0.1:8080/realms/ticket';
const AUDIENCE = 'ticket-api';
const TENANT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BRANDING_URL = '/v1/tenants/' + TENANT + '/branding';

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
    email: 'owner@example.com',
    email_verified: true,
    ...claims,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-kid' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(claims.sub ?? 'owner_1')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
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

/** Stub Prisma so auth succeeds but DB is never used for invalid-input paths. */
function stubDb(onTransaction) {
  return {
    async $transaction(fn, _opts) {
      if (onTransaction) return onTransaction(fn);
      throw new Error('branding stubDb: unexpected $transaction');
    },
  };
}

test('PUT branding requires bearer (401) and rejects non-uuid tenant (422)', async () => {
  const { verifier } = await localVerifier();
  const app = await createApp({
    logging: false,
    oidcVerifier: verifier,
    users: memoryUsers(),
    database: stubDb(),
  });
  try {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const missing = await app.inject({
      method: 'PUT',
      url: BRANDING_URL,
      payload: { expectedVersion: 1, displayName: 'X' },
    });
    assert.equal(missing.statusCode, 401);
    assert.equal(missing.json().code, IDENTITY_ERROR_CODES.UNAUTHENTICATED);

    const badScope = await app.inject({
      method: 'PUT',
      url: '/v1/tenants/not-a-uuid/branding',
      headers: { authorization: 'Bearer x' },
      payload: { expectedVersion: 1 },
    });
    assert.equal(badScope.statusCode, 422);
    assert.equal(badScope.json().code, 'SCOPE_REQUIRED');
  } finally {
    await app.close();
  }
});

test('PUT branding wrong field types return 422 INVALID_INPUT (not 500)', async () => {
  const { privateKey, verifier } = await localVerifier();
  let hitDb = false;
  const app = await createApp({
    logging: false,
    oidcVerifier: verifier,
    users: memoryUsers(),
    database: stubDb(() => {
      hitDb = true;
      throw new Error('should not reach DB for type errors');
    }),
  });
  try {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const token = await sign(privateKey);

    const cases = [
      { displayName: 99 },
      { primaryColor: true },
      { secondaryColor: 1.5 },
      { logoAssetId: { id: 'x' } },
    ];
    for (const field of cases) {
      const res = await app.inject({
        method: 'PUT',
        url: BRANDING_URL,
        headers: { authorization: 'Bearer ' + token },
        payload: { expectedVersion: 1, ...field },
      });
      assert.equal(
        res.statusCode,
        422,
        'expected 422 for ' + JSON.stringify(field) + ' got ' + res.statusCode,
      );
      assert.equal(res.json().code, BRANDING_ERROR_CODES.INVALID_INPUT);
      assert.equal(res.statusCode !== 500, true);
    }
    assert.equal(hitDb, false, 'invalid input must not open a tenant transaction');
  } finally {
    await app.close();
  }
});

test('PUT branding maps AuthzError to 403 (permission denied)', async () => {
  const { privateKey, verifier } = await localVerifier();
  const app = await createApp({
    logging: false,
    oidcVerifier: verifier,
    users: memoryUsers(),
    database: stubDb(async () => {
      throw new AuthzError(
        AUTHZ_ERROR_CODES.PERMISSION_DENIED,
        'Missing permission tenant.profile',
      );
    }),
  });
  try {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const token = await sign(privateKey);
    const res = await app.inject({
      method: 'PUT',
      url: BRANDING_URL,
      headers: { authorization: 'Bearer ' + token },
      payload: { expectedVersion: 1, displayName: 'Allowed shape' },
    });
    assert.equal(res.statusCode, 403);
    assert.equal(res.json().code, AUTHZ_ERROR_CODES.PERMISSION_DENIED);
  } finally {
    await app.close();
  }
});

test('PUT branding maps BrandingError STALE_VERSION to 409', async () => {
  const { privateKey, verifier } = await localVerifier();
  const app = await createApp({
    logging: false,
    oidcVerifier: verifier,
    users: memoryUsers(),
    database: stubDb(async () => {
      throw new BrandingError(
        BRANDING_ERROR_CODES.STALE_VERSION,
        'Stale tenant branding version',
      );
    }),
  });
  try {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const token = await sign(privateKey);
    const res = await app.inject({
      method: 'PUT',
      url: BRANDING_URL,
      headers: { authorization: 'Bearer ' + token },
      payload: { expectedVersion: 1, displayName: 'Vemoki' },
    });
    assert.equal(res.statusCode, 409);
    assert.equal(res.json().code, BRANDING_ERROR_CODES.STALE_VERSION);
  } finally {
    await app.close();
  }
});
