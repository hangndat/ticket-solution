import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADMIN_TENANT_PERMISSIONS,
  buildNavLinks,
  deriveNavCapabilities,
  parseMeEventsResponse,
  parseMeTenantsResponse,
  parsePlatformMeResponse,
} from '../src/nav/capabilities';

const TENANT = '11111111-1111-4111-8111-111111111111';
const EVENT = '22222222-2222-4222-8222-222222222222';

test('parseMeEventsResponse requires staffEligible + tenantId items', () => {
  assert.equal(parseMeEventsResponse(401, { staffEligible: false, items: [] }), null);
  assert.equal(
    parseMeEventsResponse(200, { items: [] }),
    null,
    'missing staffEligible',
  );
  assert.equal(
    parseMeEventsResponse(200, {
      staffEligible: true,
      items: [{ eventId: EVENT, name: 'Demo', permissions: ['gate.confirm'] }],
    }),
    null,
    'missing tenantId',
  );
  const ok = parseMeEventsResponse(200, {
    staffEligible: true,
    items: [
      {
        tenantId: TENANT,
        eventId: EVENT,
        name: 'Demo',
        permissions: ['gate.confirm'],
      },
    ],
  });
  assert.ok(ok);
  assert.equal(ok.staffEligible, true);
  assert.equal(ok.items.length, 1);
});

test('guest / unauthenticated never gets Admin Cổng Platform', () => {
  const caps = deriveNavCapabilities({
    authenticated: false,
    meEvents: null,
    meTenants: null,
    platformMe: null,
  });
  assert.deepEqual(caps, {
    authenticated: false,
    showAdmin: false,
    showGate: false,
    showPlatform: false,
    showAccount: false,
  });
  const hrefs = buildNavLinks(caps).map((l) => l.href);
  assert.deepEqual(hrefs, [
    '/redeem',
    '/claim',
    '/api/auth/login?return=/',
  ]);
  assert.ok(!hrefs.includes('/admin'));
  assert.ok(!hrefs.includes('/gate'));
  assert.ok(!hrefs.includes('/platform'));
  assert.ok(!hrefs.includes('/auth'), 'guest login goes to PKCE, not /auth UI');
});

test('attendee-only: staffEligible false → no staff chrome', () => {
  const caps = deriveNavCapabilities({
    authenticated: true,
    meEvents: { staffEligible: false, items: [] },
    meTenants: { items: [] },
    platformMe: null,
  });
  assert.equal(caps.showAdmin, false);
  assert.equal(caps.showGate, false);
  assert.equal(caps.showPlatform, false);
  assert.equal(caps.showAccount, true);
  const links = buildNavLinks(caps);
  const hrefs = links.map((l) => l.href);
  assert.ok(hrefs.includes('/account'));
  assert.ok(!hrefs.includes('/auth'), 'logged-in nav uses Tài khoản, not Đăng nhập');
});

test('Scanner with gate.confirm shows Gate, not Admin without tenant perms', () => {
  const caps = deriveNavCapabilities({
    authenticated: true,
    meEvents: {
      staffEligible: true,
      items: [
        {
          tenantId: TENANT,
          eventId: EVENT,
          name: 'Night',
          permissions: ['gate.confirm'],
        },
      ],
    },
    meTenants: {
      items: [
        {
          tenantId: TENANT,
          slug: 'demo',
          name: 'Demo',
          status: 'ACTIVE',
          role: 'Scanner',
          tenantPermissions: [],
        },
      ],
    },
    platformMe: null,
  });
  assert.equal(caps.showGate, true);
  assert.equal(caps.showAdmin, false);
  const hrefs = buildNavLinks(caps).map((l) => l.href);
  assert.ok(hrefs.includes('/gate'));
  assert.ok(!hrefs.includes('/admin'));
});

test('Owner membership with admin tenant perms shows Admin; Gate needs assignment', () => {
  const caps = deriveNavCapabilities({
    authenticated: true,
    meEvents: { staffEligible: true, items: [] },
    meTenants: {
      items: [
        {
          tenantId: TENANT,
          slug: 'demo',
          name: 'Demo',
          status: 'ACTIVE',
          role: 'Owner',
          tenantPermissions: [...ADMIN_TENANT_PERMISSIONS],
        },
      ],
    },
    platformMe: null,
  });
  assert.equal(caps.showAdmin, true);
  assert.equal(caps.showGate, false);
});

test('platform operator unlocks Platform chrome only', () => {
  const caps = deriveNavCapabilities({
    authenticated: true,
    meEvents: { staffEligible: false, items: [] },
    meTenants: { items: [] },
    platformMe: {
      operator: true,
      permittedCommands: ['tenant.create'],
      assurance: 'mfa',
    },
  });
  assert.equal(caps.showPlatform, true);
  assert.equal(caps.showAdmin, false);
  assert.equal(caps.showGate, false);
});

test('invalid MeTenants / PlatformMe parse fail-closed', () => {
  assert.equal(parseMeTenantsResponse(200, { items: 'nope' }), null);
  assert.equal(
    parsePlatformMeResponse(200, {
      operator: true,
      permittedCommands: [],
      assurance: 'otp',
    }),
    null,
  );
});
