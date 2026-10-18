import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildEventMenuItems,
  derivePortalShellCapabilities,
  tenantHasAdminChrome,
} from '../src/nav/capabilities';
import {
  parseMeEventsResponse,
  parseMeTenantsResponse,
  parsePlatformMeResponse,
} from '../src/discovery/me';

test('capability shell is deny-by-default until server discovery parses', () => {
  const caps = derivePortalShellCapabilities({
    authenticated: false,
    meEvents: null,
    meTenants: null,
    platformMe: null,
  });
  assert.equal(caps.showOrgChrome, false);
  assert.equal(caps.showGateReport, false);
  assert.equal(caps.showGateDeeplink, false);
  assert.equal(caps.showPlatform, false);
});

test('Gate report nav requires report.read — gate.confirm only unlocks deeplink', () => {
  const meEvents = parseMeEventsResponse(200, {
    staffEligible: true,
    items: [
      {
        tenantId: 't1',
        eventId: 'e1',
        name: 'Demo',
        permissions: ['gate.confirm'],
      },
    ],
  });
  const meTenants = parseMeTenantsResponse(200, {
    items: [
      {
        tenantId: 't1',
        slug: 'demo',
        name: 'Demo Org',
        status: 'ACTIVE',
        role: 'Owner',
        tenantPermissions: ['event.list', 'event.create'],
      },
    ],
  });
  const caps = derivePortalShellCapabilities({
    authenticated: true,
    meEvents,
    meTenants,
    platformMe: null,
  });
  assert.equal(caps.showOrgChrome, true);
  assert.equal(caps.showGateDeeplink, true);
  assert.equal(caps.showGateReport, false);

  const menu = buildEventMenuItems('t1', 'e1', ['gate.confirm']);
  assert.equal(
    menu.some((m) => m.key === 'gate'),
    false,
  );
  const withReport = buildEventMenuItems('t1', 'e1', [
    'gate.confirm',
    'report.read',
  ]);
  assert.equal(
    withReport.some((m) => m.key === 'gate'),
    true,
  );
  assert.equal(
    withReport.some((m) => m.key === 'audit'),
    true,
  );
  assert.equal(
    buildEventMenuItems('t1', 'e1', ['inventory.import']).some(
      (m) => m.key === 'audit',
    ),
    true,
  );
  assert.equal(
    buildEventMenuItems('t1', 'e1', ['gate.confirm']).some(
      (m) => m.key === 'audit',
    ),
    false,
  );

  const withSetup = buildEventMenuItems('t1', 'e1', [
    'event.update',
    'config.publish',
  ]);
  for (const key of ['setup', 'types', 'sources', 'quota', 'config']) {
    assert.equal(
      withSetup.some((m) => m.key === key),
      true,
      `expected event menu key ${key}`,
    );
  }
});

test('platform operator chrome is isolated from staff tenant role', () => {
  const platformMe = parsePlatformMeResponse(200, {
    operator: true,
    permittedCommands: ['tenant.create'],
    assurance: 'mfa',
  });
  const caps = derivePortalShellCapabilities({
    authenticated: true,
    meEvents: { staffEligible: false, items: [] },
    meTenants: { items: [] },
    platformMe,
  });
  assert.equal(caps.showPlatform, true);
  assert.equal(caps.showOrgChrome, false);
});

test('invalid discovery payloads never unlock admin chrome', () => {
  assert.equal(parseMeTenantsResponse(200, { items: [{ tenantId: 1 }] }), null);
  assert.equal(parseMeEventsResponse(200, { staffEligible: true }), null);
  assert.equal(
    parsePlatformMeResponse(200, { operator: true, assurance: 'mfa' }),
    null,
  );
  assert.equal(
    tenantHasAdminChrome({
      tenantId: 't',
      slug: 's',
      name: 'n',
      status: 'ACTIVE',
      role: 'Scanner',
      tenantPermissions: ['gate.confirm'],
    }),
    false,
  );
});
