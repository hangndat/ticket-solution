import assert from 'node:assert/strict';
import test from 'node:test';
import {
  interpretAcceptInvite,
  interpretAccountDeletion,
  interpretCreateTenant,
  interpretMeTenants,
  interpretPlatformMe,
  interpretSupportGrant,
  PLATFORM_UNKNOWN,
} from '../src/platform/shape';
import { isPlatformOidcConfigured } from '../src/platform/oidc';
import { assertMutatingBrowser } from '../src/bff/csrf';
import { CSRF_COOKIE, CSRF_HEADER } from '../src/bff/csrf-constants';

test('platform OIDC fail closed without full PLATFORM_OIDC_*', () => {
  assert.equal(isPlatformOidcConfigured({}), false);
  assert.equal(
    isPlatformOidcConfigured({
      PLATFORM_OIDC_ISSUER: 'http://127.0.0.1:8080/realms/ticket',
      PLATFORM_OIDC_CLIENT_ID: 'ticket-platform-web',
      PLATFORM_OIDC_CLIENT_SECRET: 'x',
      PLATFORM_OIDC_REDIRECT_URI: 'http://localhost:3000/api/auth/platform/callback',
      // missing audience + acr
    }),
    false,
  );
  assert.equal(
    isPlatformOidcConfigured({
      PLATFORM_OIDC_ISSUER: 'http://127.0.0.1:8080/realms/ticket',
      PLATFORM_OIDC_CLIENT_ID: 'ticket-platform-web',
      PLATFORM_OIDC_CLIENT_SECRET: 'x',
      PLATFORM_OIDC_REDIRECT_URI: 'http://localhost:3000/api/auth/platform/callback',
      PLATFORM_OIDC_AUDIENCE: 'ticket-platform-api',
      PLATFORM_OIDC_REQUIRED_ACR: 'vemoki-mfa',
    }),
    true,
  );
});

test('interpretPlatformMe requires assurance enum', () => {
  assert.equal(
    interpretPlatformMe(
      200,
      { operator: true, permittedCommands: ['tenant.create'], assurance: 'mfa' },
      false,
    ).kind,
    'ok',
  );
  assert.equal(
    interpretPlatformMe(
      200,
      { operator: true, permittedCommands: [], assurance: 'otp' },
      false,
    ).kind,
    'unknown',
  );
  assert.equal(interpretPlatformMe(500, {}, false).kind, 'unknown');
});

test('interpretCreateTenant fail-closed on wrong status', () => {
  assert.equal(
    interpretCreateTenant(
      201,
      {
        tenantId: '11111111-1111-4111-8111-111111111111',
        status: 'PENDING',
        version: 1,
        ownerInviteId: '22222222-2222-4222-8222-222222222222',
      },
      false,
    ).kind,
    'ok',
  );
  assert.equal(
    interpretCreateTenant(
      201,
      {
        tenantId: '11111111-1111-4111-8111-111111111111',
        status: 'ACTIVE',
        version: 1,
        ownerInviteId: '22222222-2222-4222-8222-222222222222',
      },
      false,
    ).kind,
    'unknown',
  );
});

test('interpretMeTenants rejects non-role', () => {
  const bad = interpretMeTenants(
    200,
    {
      items: [
        {
          tenantId: '11111111-1111-4111-8111-111111111111',
          slug: 'a',
          name: 'A',
          status: 'ACTIVE',
          tenantPermissions: ['event.create'],
          role: 'Admin',
        },
      ],
    },
    false,
  );
  assert.equal(bad.kind, 'unknown');
  assert.equal(bad.kind === 'unknown' ? bad.message : '', PLATFORM_UNKNOWN);
});

test('interpretSupportGrant only cs.read', () => {
  assert.equal(
    interpretSupportGrant(
      201,
      {
        grantId: '11111111-1111-4111-8111-111111111111',
        tenantId: '11111111-1111-4111-8111-111111111111',
        eventId: '22222222-2222-4222-8222-222222222222',
        scopes: ['cs.read'],
        expiresAt: '2026-10-17T12:00:00.000Z',
      },
      false,
    ).kind,
    'ok',
  );
  assert.equal(
    interpretSupportGrant(
      201,
      {
        grantId: '11111111-1111-4111-8111-111111111111',
        tenantId: '11111111-1111-4111-8111-111111111111',
        eventId: '22222222-2222-4222-8222-222222222222',
        scopes: ['cs.write'],
        expiresAt: '2026-10-17T12:00:00.000Z',
      },
      false,
    ).kind,
    'unknown',
  );
});

test('account deletion ACK is AWAITING_POLICY only', () => {
  assert.equal(
    interpretAccountDeletion(
      202,
      {
        requestId: '11111111-1111-4111-8111-111111111111',
        state: 'AWAITING_POLICY',
        requestedAt: '2026-10-17T12:00:00.000Z',
        policyStatus: 'UNRESOLVED',
      },
      false,
    ).kind,
    'ok',
  );
  assert.equal(
    interpretAccountDeletion(
      202,
      {
        requestId: '11111111-1111-4111-8111-111111111111',
        state: 'COMPLETED',
        requestedAt: '2026-10-17T12:00:00.000Z',
        policyStatus: 'UNRESOLVED',
      },
      false,
    ).kind,
    'unknown',
  );
});

test('accept invite requires tenant+membership+status', () => {
  assert.equal(
    interpretAcceptInvite(
      200,
      {
        tenantId: '11111111-1111-4111-8111-111111111111',
        membershipId: '22222222-2222-4222-8222-222222222222',
        status: 'ACTIVE',
      },
      false,
    ).kind,
    'ok',
  );
});

test('CSRF mutating guard rejects missing token and non-json', () => {
  const origin = 'http://localhost:3000';
  const noToken = assertMutatingBrowser(
    new Request(origin + '/api/bff/x', {
      method: 'POST',
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        'Sec-Fetch-Site': 'same-origin',
      },
      body: '{}',
    }),
  );
  assert.ok(noToken);
  assert.equal(noToken!.status, 403);

  const badCt = assertMutatingBrowser(
    new Request(origin + '/api/bff/x', {
      method: 'POST',
      headers: {
        Origin: origin,
        'Content-Type': 'text/plain',
        'Sec-Fetch-Site': 'same-origin',
        Cookie: `${CSRF_COOKIE}=abc`,
        [CSRF_HEADER]: 'abc',
      },
      body: 'x',
    }),
  );
  assert.ok(badCt);
  assert.equal(badCt!.status, 415);

  const ok = assertMutatingBrowser(
    new Request(origin + '/api/bff/x', {
      method: 'POST',
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        'Sec-Fetch-Site': 'same-origin',
        Cookie: `${CSRF_COOKIE}=tokentokentokentokentokentokentoken12`,
        [CSRF_HEADER]: 'tokentokentokentokentokentokentoken12',
      },
      body: '{}',
    }),
  );
  assert.equal(ok, null);
});
