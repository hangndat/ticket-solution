import assert from 'node:assert/strict';
import test from 'node:test';
import {
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

test('guest / unauthenticated never gets staff chrome', () => {
  const caps = deriveNavCapabilities({
    authenticated: false,
    meEvents: null,
    meTenants: null,
    platformMe: null,
  });
  assert.deepEqual(caps, {
    authenticated: false,
    showAccount: false,
  });
  const hrefs = buildNavLinks(caps).map((l) => l.href);
  assert.deepEqual(hrefs, ['/', '/redeem', '/api/auth/login?return=%2Fwallet']);
  assert.equal(buildNavLinks(caps).at(-1)?.label, 'Đăng nhập');
  assert.equal(buildNavLinks(caps).at(-1)?.testId, 'nav-login');
  assert.ok(!hrefs.includes('/admin'));
  assert.ok(!hrefs.includes('/gate'));
  assert.ok(!hrefs.includes('/platform'));
  assert.ok(!hrefs.includes('/wallet'), 'guest must not see Vé của tôi');
  assert.ok(!hrefs.includes('/auth'), 'guest login goes to PKCE, not /auth UI');
});

test('attendee-only: staffEligible false → attendee chrome, no staff nav', () => {
  const caps = deriveNavCapabilities({
    authenticated: true,
    meEvents: { staffEligible: false, items: [] },
    meTenants: { items: [] },
    platformMe: null,
  });
  assert.equal(caps.showAccount, true);
  const links = buildNavLinks(caps);
  const hrefs = links.map((l) => l.href);
  assert.ok(hrefs.includes('/account'));
  assert.ok(hrefs.includes('/wallet'));
  assert.ok(!hrefs.includes('/admin'));
  assert.ok(!hrefs.includes('/gate'));
  assert.ok(!hrefs.includes('/claim'), 'email invitation is link-only');
  assert.ok(!hrefs.includes('/auth'), 'logged-in nav uses Tài khoản, not Đăng nhập');
});

test('staffEligible Owner still has no web staff nav (ADR-20 portal home)', () => {
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
          tenantPermissions: [
            'event.create',
            'event.list',
            'members.manage',
            'tenant.profile',
          ],
        },
      ],
    },
    platformMe: null,
  });
  const hrefs = buildNavLinks(caps).map((l) => l.href);
  assert.ok(!hrefs.includes('/admin'));
  assert.ok(!hrefs.includes('/gate'));
  assert.ok(!hrefs.includes('/platform'));
  assert.equal(
    buildNavLinks(caps).some((l) => l.testId === 'nav-portal-staff'),
    false,
  );
});

test('Scanner with gate.confirm has no web gate nav (O23 / D-6)', () => {
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
  const hrefs = buildNavLinks(caps).map((l) => l.href);
  assert.ok(!hrefs.includes('/gate'));
  assert.ok(!hrefs.includes('/admin'));
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
