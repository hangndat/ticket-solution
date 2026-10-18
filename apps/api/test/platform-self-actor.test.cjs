const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  IdentityError,
  IDENTITY_ERROR_CODES,
  PlatformError,
  PLATFORM_ERROR_CODES,
} = require('@ticket/backend');
const { PlatformService } = require('../dist/platform');

function baseDeps(overrides = {}) {
  return {
    db: {},
    platformVerifier: null,
    identityVerifier: null,
    users: {
      async upsertFromVerifiedIdentity(identity) {
        return {
          userId: '11111111-1111-4111-8111-111111111111',
          issuer: identity.issuer,
          subject: identity.subject,
          email: identity.email,
          emailVerified: identity.emailVerified,
        };
      },
    },
    security: null,
    bootError: null,
    ...overrides,
  };
}

test('acceptInvite uses identityVerifier (ticket-api), not platform MFA verifier', async () => {
  let used = null;
  const service = new PlatformService(
    baseDeps({
      platformVerifier: {
        async verifyBearerToken() {
          used = 'platform';
          throw new PlatformError(
            PLATFORM_ERROR_CODES.MFA_REQUIRED,
            'MFA assurance required',
          );
        },
      },
      identityVerifier: {
        async verifyBearerToken(authorization) {
          used = 'identity';
          assert.match(String(authorization), /^Bearer /);
          return {
            issuer: 'http://issuer.test/realms/ticket',
            subject: 'staff-1',
            email: 'staff@example.com',
            emailVerified: true,
          };
        },
      },
      users: {
        async upsertFromVerifiedIdentity() {
          // Stop before DB invite accept — proves verifier + identity path ran.
          throw new IdentityError(
            IDENTITY_ERROR_CODES.UNAUTHENTICATED,
            'probe-after-identity-verify',
          );
        },
      },
    }),
  );

  await assert.rejects(
    () => service.acceptInvite('Bearer staff-ticket-web-token', { token: 'invite' }),
    (err) =>
      err?.response?.code === IDENTITY_ERROR_CODES.UNAUTHENTICATED ||
      err?.getResponse?.()?.code === IDENTITY_ERROR_CODES.UNAUTHENTICATED,
  );
  assert.equal(used, 'identity');
});

test('platform/me keeps platform MFA verifier (does not use identityVerifier)', async () => {
  let used = null;
  const service = new PlatformService(
    baseDeps({
      platformVerifier: {
        async verifyBearerToken() {
          used = 'platform';
          throw new PlatformError(
            PLATFORM_ERROR_CODES.MFA_REQUIRED,
            'MFA assurance required',
          );
        },
      },
      identityVerifier: {
        async verifyBearerToken() {
          used = 'identity';
          return {
            issuer: 'http://issuer.test/realms/ticket',
            subject: 'staff-1',
            email: 'staff@example.com',
            emailVerified: true,
          };
        },
      },
    }),
  );

  await assert.rejects(
    () => service.me('Bearer staff-ticket-web-token'),
    (err) =>
      err?.response?.code === PLATFORM_ERROR_CODES.MFA_REQUIRED ||
      err?.getResponse?.()?.code === PLATFORM_ERROR_CODES.MFA_REQUIRED,
  );
  assert.equal(used, 'platform');
});

test('acceptInvite fail-closed when identityVerifier missing', async () => {
  const service = new PlatformService(
    baseDeps({
      platformVerifier: {
        async verifyBearerToken() {
          return {
            issuer: 'x',
            subject: 'y',
            email: null,
            emailVerified: false,
            authTime: 0,
            acr: '2',
          };
        },
      },
      identityVerifier: null,
    }),
  );

  await assert.rejects(
    () => service.acceptInvite('Bearer t', { token: 'invite' }),
    (err) =>
      err?.response?.code === IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED ||
      err?.getResponse?.()?.code === IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
  );
});

test('listTenants keeps platform MFA verifier (does not use identityVerifier)', async () => {
  let used = null;
  const service = new PlatformService(
    baseDeps({
      platformVerifier: {
        async verifyBearerToken() {
          used = 'platform';
          throw new PlatformError(
            PLATFORM_ERROR_CODES.MFA_REQUIRED,
            'MFA assurance required',
          );
        },
      },
      identityVerifier: {
        async verifyBearerToken() {
          used = 'identity';
          return {
            issuer: 'http://issuer.test/realms/ticket',
            subject: 'staff-1',
            email: 'staff@example.com',
            emailVerified: true,
          };
        },
      },
    }),
  );

  await assert.rejects(
    () => service.listTenants('Bearer staff-ticket-web-token', { limit: '20' }),
    (err) =>
      err?.response?.code === PLATFORM_ERROR_CODES.MFA_REQUIRED ||
      err?.getResponse?.()?.code === PLATFORM_ERROR_CODES.MFA_REQUIRED,
  );
  assert.equal(used, 'platform');
});

test('tenantHealth keeps platform MFA verifier (H-P2)', async () => {
  let used = null;
  const service = new PlatformService(
    baseDeps({
      platformVerifier: {
        async verifyBearerToken() {
          used = 'platform';
          throw new PlatformError(
            PLATFORM_ERROR_CODES.MFA_REQUIRED,
            'MFA assurance required',
          );
        },
      },
      identityVerifier: {
        async verifyBearerToken() {
          used = 'identity';
          return {
            issuer: 'http://issuer.test/realms/ticket',
            subject: 'staff-1',
            email: 'staff@example.com',
            emailVerified: true,
          };
        },
      },
    }),
  );

  await assert.rejects(
    () =>
      service.tenantHealth(
        'Bearer staff-ticket-web-token',
        '11111111-1111-4111-8111-111111111111',
      ),
    (err) =>
      err?.response?.code === PLATFORM_ERROR_CODES.MFA_REQUIRED ||
      err?.getResponse?.()?.code === PLATFORM_ERROR_CODES.MFA_REQUIRED,
  );
  assert.equal(used, 'platform');
});

test('revokeSupportGrant keeps platform MFA verifier', async () => {
  let used = null;
  const service = new PlatformService(
    baseDeps({
      platformVerifier: {
        async verifyBearerToken() {
          used = 'platform';
          throw new PlatformError(
            PLATFORM_ERROR_CODES.MFA_REQUIRED,
            'MFA assurance required',
          );
        },
      },
      identityVerifier: {
        async verifyBearerToken() {
          used = 'identity';
          return {
            issuer: 'http://issuer.test/realms/ticket',
            subject: 'staff-1',
            email: 'staff@example.com',
            emailVerified: true,
          };
        },
      },
    }),
  );

  await assert.rejects(
    () =>
      service.revokeSupportGrant(
        'Bearer staff-ticket-web-token',
        '22222222-2222-4222-8222-222222222222',
        { reason: 'done' },
      ),
    (err) =>
      err?.response?.code === PLATFORM_ERROR_CODES.MFA_REQUIRED ||
      err?.getResponse?.()?.code === PLATFORM_ERROR_CODES.MFA_REQUIRED,
  );
  assert.equal(used, 'platform');
});
