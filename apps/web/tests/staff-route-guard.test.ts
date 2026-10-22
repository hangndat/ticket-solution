import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADMIN_TENANT_PERMISSIONS,
  buildNavLinks,
  deriveNavCapabilities,
  parseMeEventsResponse,
  parseMeTenantsResponse,
} from '../src/nav/capabilities';

/**
 * Staff SSR discovery policy (Issue #1021 / E01):
 * - gate.confirm no longer unlocks web /gate nav (D-6)
 * - 502/503 → render shell (tested via integration; policy mirrored here)
 */
test('gate.confirm assignment does not add web gate nav (D-6)', () => {
  const meEvents = parseMeEventsResponse(200, {
    staffEligible: true,
    items: [
      {
        tenantId: '11111111-1111-4111-8111-111111111111',
        eventId: '22222222-2222-4222-8222-222222222222',
        name: 'Night',
        permissions: ['gate.confirm'],
      },
    ],
  });
  assert.ok(meEvents);
  const caps = deriveNavCapabilities({
    authenticated: true,
    meEvents,
    meTenants: null,
    platformMe: null,
  });
  const hrefs = buildNavLinks(caps).map((l) => l.href);
  assert.ok(!hrefs.includes('/gate'));
  assert.equal(caps.showAdmin, false);
});

test('admin discovery: staffEligible + gate but empty tenantPermissions denies admin', () => {
  const meEvents = parseMeEventsResponse(200, {
    staffEligible: true,
    items: [
      {
        tenantId: '11111111-1111-4111-8111-111111111111',
        eventId: '22222222-2222-4222-8222-222222222222',
        name: 'Night',
        permissions: ['gate.confirm'],
      },
    ],
  });
  const meTenants = parseMeTenantsResponse(200, {
    items: [
      {
        tenantId: '11111111-1111-4111-8111-111111111111',
        slug: 'mfest-demo',
        name: 'MFest',
        status: 'ACTIVE',
        role: 'Owner',
        tenantPermissions: [],
      },
    ],
  });
  assert.ok(meEvents);
  assert.ok(meTenants);
  const caps = deriveNavCapabilities({
    authenticated: true,
    meEvents,
    meTenants,
    platformMe: null,
  });
  assert.ok(!buildNavLinks(caps).some((l) => l.href === '/gate'));
  assert.equal(caps.showAdmin, false);
});

test('admin discovery: staffEligible + admin tenant perms allows admin chrome', () => {
  const meEvents = parseMeEventsResponse(200, {
    staffEligible: true,
    items: [],
  });
  const meTenants = parseMeTenantsResponse(200, {
    items: [
      {
        tenantId: '11111111-1111-4111-8111-111111111111',
        slug: 'mfest-demo',
        name: 'MFest',
        status: 'ACTIVE',
        role: 'Owner',
        tenantPermissions: [...ADMIN_TENANT_PERMISSIONS],
      },
    ],
  });
  assert.ok(meEvents);
  assert.ok(meTenants);
  const caps = deriveNavCapabilities({
    authenticated: true,
    meEvents,
    meTenants,
    platformMe: null,
  });
  assert.equal(caps.showAdmin, true);
});

test('discovery: upstream timeout shape does not look authenticated', () => {
  const meEvents = parseMeEventsResponse(502, null);
  assert.equal(meEvents, null);
  const caps = deriveNavCapabilities({
    authenticated: meEvents !== null,
    meEvents,
    meTenants: null,
    platformMe: null,
  });
  assert.ok(!buildNavLinks(caps).some((l) => l.href === '/gate'));
});
