const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  readPlatformSecurityConfig,
  tenantPermissionsForRole,
  eventPermissionsForRole,
  isMembershipRole,
  PLATFORM_ERROR_CODES,
  createPlatformOidcVerifier,
  createLocalJwks,
} = require('../dist');

// jose is dependency of backend — use from node_modules for token minting in unit test
const jose = require('jose');

test('platform security config fail-closed in production', () => {
  assert.throws(
    () => readPlatformSecurityConfig({ NODE_ENV: 'production' }),
    (e) => e.code === PLATFORM_ERROR_CODES.PLATFORM_MISCONFIGURED,
  );
  const cfg = readPlatformSecurityConfig({ NODE_ENV: 'development' });
  assert.equal(cfg.inviteTtlSeconds, 48 * 3600);
  assert.equal(cfg.supportTtlMaxSeconds, 3600);
  assert.equal(cfg.mfaAuthTimeMaxSeconds, 15 * 60);
});

test('role map is server allowlist without arbitrary permissions', () => {
  assert.ok(tenantPermissionsForRole('Owner').includes('members.manage'));
  assert.ok(eventPermissionsForRole('CS').includes('cs.lookup'));
  assert.ok(!eventPermissionsForRole('CS').includes('export.download'));
  assert.equal(isMembershipRole('Owner'), true);
  assert.equal(isMembershipRole('SuperAdmin'), false);
});

test('platform MFA verifier requires acr + fresh auth_time', async () => {
  const { publicKey, privateKey } = await jose.generateKeyPair('RS256');
  const jwk = await jose.exportJWK(publicKey);
  jwk.kid = 'platform-test';
  jwk.alg = 'RS256';
  const jwks = createLocalJwks(jwk);
  const security = readPlatformSecurityConfig({
    NODE_ENV: 'test',
    PLATFORM_MFA_ACR_VALUES: '2',
    PLATFORM_OIDC_AUDIENCE: 'platform-api',
  });
  const verifier = createPlatformOidcVerifier(
    {
      issuer: 'http://localhost/realms/ticket',
      audience: 'ignored',
      jwksUrl: 'http://localhost/jwks',
    },
    security,
    { jwks },
  );

  const mint = async (claims) => {
    const token = await new jose.SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'platform-test' })
      .setIssuer('http://localhost/realms/ticket')
      .setAudience('platform-api')
      .setSubject('op-1')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);
    return 'Bearer ' + token;
  };

  await assert.rejects(
    () => mint({ acr: '1', auth_time: Math.floor(Date.now() / 1000) }).then((h) =>
      verifier.verifyBearerToken(h),
    ),
    (e) => e.code === PLATFORM_ERROR_CODES.MFA_REQUIRED,
  );

  const ok = await verifier.verifyBearerToken(
    await mint({
      acr: '2',
      auth_time: Math.floor(Date.now() / 1000),
      email: 'op@example.com',
      email_verified: true,
    }),
  );
  assert.equal(ok.subject, 'op-1');
  assert.equal(ok.acr, '2');
});
