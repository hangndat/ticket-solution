import assert from 'node:assert/strict';
import test from 'node:test';
import { loginHref } from '../src/oidc/login-href';
import { sanitizePostLoginPath } from '../src/oidc/post-login';
import { authNoticeFromParam } from '../src/oidc/auth-notice';
import { gateCredentialQrValue } from '../src/owner-ticket/gate-credential-payload';
import { encodeQrModules } from '../src/owner-ticket/qr-matrix';

test('loginHref uses allowlisted return paths (AC-S2)', () => {
  assert.equal(loginHref('/'), '/api/auth/login?return=/');
  assert.equal(loginHref('/redeem'), '/api/auth/login?return=%2Fredeem');
  assert.equal(loginHref('/account'), '/api/auth/login?return=%2Faccount');
  assert.equal(loginHref('/wallet'), '/api/auth/login?return=%2Fwallet');
  assert.equal(loginHref('https://evil.example'), '/api/auth/login?return=/');
  assert.equal(sanitizePostLoginPath('/'), '/');
  assert.equal(sanitizePostLoginPath('/wallet'), '/wallet');
  assert.equal(sanitizePostLoginPath('/admin'), null);
  assert.equal(sanitizePostLoginPath('/gate'), null);
  assert.equal(
    sanitizePostLoginPath(
      '/redeem?tenantSlug=mfest-demo&eventSlug=mfest&evil=1',
    ),
    '/redeem?tenantSlug=mfest-demo&eventSlug=mfest',
  );
  assert.equal(
    sanitizePostLoginPath('/redeem?tenantSlug=bad_slug&eventSlug=mfest'),
    '/redeem?eventSlug=mfest',
  );
});

test('authNoticeFromParam maps OIDC cancel/fail (AC-S1)', () => {
  const notice = authNoticeFromParam('auth_failed', {
    retryHref: loginHref('/'),
  });
  assert.ok(notice);
  assert.equal(notice.title, 'Không đăng nhập được');
  assert.ok(notice.retryHref.includes('/api/auth/login'));
  assert.equal(authNoticeFromParam('admin_denied'), null);
});

test('signed QR payload encodes JWS modules (AC-T1)', () => {
  const payload = gateCredentialQrValue({
    ticketId: '97f77680-4d65-4b6d-baf3-b3f699a006a6',
    tenantId: '11111111-1111-4111-8111-111111111111',
    eventId: '22222222-2222-4222-8222-222222222201',
    ticketTypeId: 't',
    sourceId: 's',
    state: 'ACTIVE',
    credentialVersion: 1,
    gateCredential: {
      v: 1,
      kind: 'ticket.gate_credential',
      jws: 'header.payload.signature',
    },
    manualEntryCode: 'ABCD2345EFGH6789',
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(payload, 'header.payload.signature');
  const modules = encodeQrModules(payload);
  assert.ok(modules.length > 10);
  assert.equal(modules.length, modules[0]?.length);
});
