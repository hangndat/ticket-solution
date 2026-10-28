import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decideTicketWebPostLogin,
  lookupStaffEligible,
  portalStaffLoginLocation,
} from '../src/oidc/staff-portal-bounce';
import { sanitizePostLoginPath } from '../src/oidc/post-login';
import {
  buildNavLinks,
  deriveNavCapabilities,
} from '../src/nav/capabilities';
import { isRetiredWebGatePath } from '../src/portal/dual-run';

const PORTAL = 'https://portal.vemoki.com';

test('staff OIDC on ticket-web bounces to PORTAL_ORIGIN login (ADR-20)', () => {
  assert.deepEqual(
    decideTicketWebPostLogin({
      staffEligible: true,
      portalOrigin: PORTAL,
      attendeePath: '/wallet',
    }),
    {
      kind: 'portal',
      location: portalStaffLoginLocation(PORTAL),
    },
  );
  assert.equal(
    portalStaffLoginLocation(PORTAL),
    'https://portal.vemoki.com/api/auth/login',
  );
});

test('attendee stays on app; guest-equivalent miss stays (B06)', () => {
  assert.deepEqual(
    decideTicketWebPostLogin({
      staffEligible: false,
      portalOrigin: PORTAL,
      attendeePath: '/wallet',
    }),
    { kind: 'app', path: '/wallet' },
  );
  assert.deepEqual(
    decideTicketWebPostLogin({
      staffEligible: null,
      portalOrigin: PORTAL,
      attendeePath: '/redeem',
    }),
    { kind: 'app', path: '/redeem' },
  );
  assert.deepEqual(
    decideTicketWebPostLogin({
      staffEligible: true,
      portalOrigin: null,
      attendeePath: '/',
    }),
    { kind: 'app', path: '/' },
  );
});

test('post-login allowlist has no staff/admin/gate paths', () => {
  assert.equal(sanitizePostLoginPath('/admin'), null);
  assert.equal(sanitizePostLoginPath('/admin?tenantId=x'), null);
  assert.equal(sanitizePostLoginPath('/gate'), null);
  assert.equal(sanitizePostLoginPath('/platform'), null);
  assert.equal(sanitizePostLoginPath('/wallet'), '/wallet');
});

test('GET /gate is retired on consumer web (O23 / D-6)', () => {
  assert.equal(isRetiredWebGatePath('/gate'), true);
  assert.equal(isRetiredWebGatePath('/gate/scan'), true);
  assert.equal(isRetiredWebGatePath('/wallet'), false);
});

test('web SiteNav never includes staff/admin/gate even when staffEligible', () => {
  const caps = deriveNavCapabilities({
    authenticated: true,
    meEvents: { staffEligible: true, items: [] },
    meTenants: {
      items: [
        {
          tenantId: '11111111-1111-4111-8111-111111111111',
          slug: 'demo',
          name: 'Demo',
          status: 'ACTIVE',
          role: 'Owner',
          tenantPermissions: ['event.create', 'members.manage'],
        },
      ],
    },
    platformMe: { operator: true, permittedCommands: [], assurance: 'mfa' },
  });
  const hrefs = buildNavLinks(caps).map((l) => l.href);
  assert.ok(!hrefs.includes('/admin'));
  assert.ok(!hrefs.includes('/gate'));
  assert.ok(!hrefs.includes('/platform'));
  assert.ok(!hrefs.some((h) => h.includes('nav-portal-staff')));
  assert.equal(
    buildNavLinks(caps).some((l) => l.testId === 'nav-portal-staff'),
    false,
  );
});

test('lookupStaffEligible maps me/events staffEligible fail-closed', async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(JSON.stringify({ staffEligible: true, items: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  assert.equal(
    await lookupStaffEligible('tok', { fetchImpl, apiBase: 'http://api.test' }),
    true,
  );

  const attendee: typeof fetch = async () =>
    new Response(JSON.stringify({ staffEligible: false, items: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  assert.equal(
    await lookupStaffEligible('tok', {
      fetchImpl: attendee,
      apiBase: 'http://api.test',
    }),
    false,
  );

  const boom: typeof fetch = async () => {
    throw new Error('network');
  };
  assert.equal(
    await lookupStaffEligible('tok', {
      fetchImpl: boom,
      apiBase: 'http://api.test',
    }),
    null,
  );
});
