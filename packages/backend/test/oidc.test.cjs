const { test } = require('node:test');
const assert = require('node:assert/strict');
const jose = require('jose');
const {
  readOidcEnvironment,
  createOidcVerifier,
  createLocalJwks,
  IdentityError,
  IDENTITY_ERROR_CODES,
} = require('../dist');

const ISSUER = 'https://example.clerk.accounts.dev';
const AUDIENCE = 'ticket-api';

async function fixtureKeys() {
  const { privateKey, publicKey } = await jose.generateKeyPair('RS256');
  const publicJwk = await jose.exportJWK(publicKey);
  publicJwk.kid = 'test-kid';
  publicJwk.alg = 'RS256';
  publicJwk.use = 'sig';
  return { privateKey, publicJwk };
}

async function signToken(privateKey, claims = {}) {
  return new jose.SignJWT({
    email: 'user@example.com',
    email_verified: false,
    ...claims,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-kid' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(claims.sub ?? 'user_sub_1')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
}

test('readOidcEnvironment fails closed when config missing', () => {
  for (const env of [
    {},
    { OIDC_ISSUER: ISSUER },
    { OIDC_ISSUER: ISSUER, OIDC_AUDIENCE: AUDIENCE },
    {
      OIDC_ISSUER: ISSUER,
      OIDC_AUDIENCE: AUDIENCE,
      OIDC_JWKS_URL: 'not-a-url',
    },
  ]) {
    assert.throws(
      () => readOidcEnvironment(env),
      (error) =>
        error instanceof IdentityError &&
        error.code === IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
    );
  }
  const config = readOidcEnvironment({
    OIDC_ISSUER: ISSUER,
    OIDC_AUDIENCE: AUDIENCE,
    OIDC_JWKS_URL: 'https://example.clerk.accounts.dev/.well-known/jwks.json',
  });
  assert.equal(config.issuer, ISSUER);
});

test('OIDC verifier accepts local JWKS fixture and rejects bad tokens', async () => {
  const { privateKey, publicJwk } = await fixtureKeys();
  const verifier = createOidcVerifier(
    {
      issuer: ISSUER,
      audience: AUDIENCE,
      jwksUrl: 'https://jwks.test.local/jwks.json',
    },
    { jwks: createLocalJwks(publicJwk) },
  );

  await assert.rejects(
    () => verifier.verifyBearerToken(undefined),
    (error) =>
      error instanceof IdentityError &&
      error.code === IDENTITY_ERROR_CODES.UNAUTHENTICATED,
  );
  await assert.rejects(
    () => verifier.verifyBearerToken('Bearer not-a-jwt'),
    (error) =>
      error instanceof IdentityError &&
      error.code === IDENTITY_ERROR_CODES.UNAUTHENTICATED,
  );

  const other = await jose.generateKeyPair('RS256');
  const forged = await new jose.SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: 'test-kid' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject('forged')
    .setExpirationTime('5m')
    .sign(other.privateKey);
  await assert.rejects(
    () => verifier.verifyBearerToken('Bearer ' + forged),
    (error) =>
      error instanceof IdentityError &&
      error.code === IDENTITY_ERROR_CODES.UNAUTHENTICATED,
  );

  const token = await signToken(privateKey, { sub: 'user_abc' });
  const identity = await verifier.verifyBearerToken('Bearer ' + token);
  assert.equal(identity.subject, 'user_abc');
  assert.equal(identity.issuer, ISSUER);
  assert.equal(identity.email, 'user@example.com');
  assert.equal(identity.emailVerified, false);

  const verifiedToken = await signToken(privateKey, {
    sub: 'user_abc',
    email_verified: true,
  });
  const verified = await verifier.verifyBearerToken('Bearer ' + verifiedToken);
  assert.equal(verified.emailVerified, true);
});
