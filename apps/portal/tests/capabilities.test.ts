import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildEventMenuItems,
  buildOrgMenuItems,
  derivePortalShellCapabilities,
  tenantHasAdminChrome,
  tenantHasAnalytics,
} from '../src/nav/capabilities';
import {
  parseMeEventsResponse,
  parseMeTenantsResponse,
  parsePlatformMeResponse,
} from '../src/discovery/me';
import { t } from '../src/i18n/t';
import type { MessageKey } from '../src/i18n/messages';

/** Identity stub: menu labels are catalog keys, not hard-coded locale text. */
const keyStub = (key: MessageKey) => key;
const viT = (key: MessageKey) => t('vi', key);
const enT = (key: MessageKey) => t('en', key);

test('capability shell is deny-by-default until server discovery parses', () => {
  const caps = derivePortalShellCapabilities({
    authenticated: false,
    meEvents: null,
    meTenants: null,
    platformMe: null,
  });
  assert.equal(caps.showOrgChrome, false);
  assert.equal(caps.showGateReport, false);
  assert.equal(caps.showGateScanHint, false);
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
  assert.equal(caps.showGateScanHint, true);
  assert.equal(caps.showGateReport, false);

  const menu = buildEventMenuItems('t1', 'e1', ['gate.confirm'], keyStub);
  assert.equal(
    menu.some((m) => m.key === 'gate'),
    false,
  );
  const withReport = buildEventMenuItems(
    't1',
    'e1',
    ['gate.confirm', 'report.read'],
    keyStub,
  );
  assert.equal(
    withReport.some((m) => m.key === 'gate'),
    true,
  );
  assert.equal(
    withReport.some((m) => m.key === 'audit'),
    true,
  );
  assert.equal(
    buildEventMenuItems('t1', 'e1', ['inventory.import'], keyStub).some(
      (m) => m.key === 'audit',
    ),
    true,
  );
  assert.equal(
    buildEventMenuItems('t1', 'e1', ['gate.confirm'], keyStub).some(
      (m) => m.key === 'audit',
    ),
    false,
  );

  const withSetup = buildEventMenuItems(
    't1',
    'e1',
    ['event.update', 'config.publish'],
    keyStub,
  );
  for (const key of ['setup', 'types', 'sources', 'quota', 'config']) {
    assert.equal(
      withSetup.some((m) => m.key === key),
      true,
      `expected event menu key ${key}`,
    );
    assert.equal(
      withSetup.find((m) => m.key === key)?.group,
      'setup',
    );
  }
  assert.equal(withSetup.find((m) => m.key === 'overview')?.group, 'run');
});

test('event menu splits live ops from setup', () => {
  const menu = buildEventMenuItems(
    't1',
    'e1',
    [
      'event.update',
      'config.publish',
      'inventory.import',
      'report.read',
      'cs.lookup',
    ],
    keyStub,
  );
  assert.deepEqual(
    menu.filter((item) => item.group === 'run').map((item) => item.key),
    ['overview', 'gate', 'audit', 'support'],
  );
  assert.deepEqual(
    menu.filter((item) => item.group === 'setup').map((item) => item.key),
    ['setup', 'types', 'sources', 'quota', 'config', 'guests'],
  );
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

test('Phân tích org nav requires report.read assignment — not role name', () => {
  const tenant = {
    tenantId: 't1',
    slug: 'demo',
    name: 'Demo Org',
    status: 'ACTIVE' as const,
    role: 'Owner' as const,
    tenantPermissions: ['event.list', 'event.create'],
  };
  assert.equal(
    tenantHasAnalytics('t1', [
      {
        tenantId: 't1',
        eventId: 'e1',
        name: 'Demo',
        permissions: ['gate.confirm'],
      },
    ]),
    false,
  );
  assert.equal(
    buildOrgMenuItems(
      't1',
      tenant,
      [
        {
          tenantId: 't1',
          eventId: 'e1',
          name: 'Demo',
          permissions: ['gate.confirm'],
        },
      ],
      keyStub,
    ).some((m) => m.key === 'analytics'),
    false,
  );
  assert.equal(
    tenantHasAnalytics('t1', [
      {
        tenantId: 't1',
        eventId: 'e1',
        name: 'Demo',
        permissions: ['report.read'],
      },
    ]),
    true,
  );
  const withReport = buildOrgMenuItems(
    't1',
    tenant,
    [
      {
        tenantId: 't1',
        eventId: 'e1',
        name: 'Demo',
        permissions: ['report.read'],
      },
    ],
    viT,
  );
  assert.equal(
    withReport.some((m) => m.key === 'analytics' && m.label === 'Phân tích'),
    true,
  );
  assert.equal(
    buildOrgMenuItems(
      't1',
      tenant,
      [
        {
          tenantId: 't1',
          eventId: 'e1',
          name: 'Demo',
          permissions: ['report.read'],
        },
      ],
      enT,
    ).find((m) => m.key === 'analytics')?.label,
    'Analytics',
  );
  assert.equal(
    withReport.find((m) => m.key === 'analytics')?.href,
    '/t/t1/analytics',
  );
  // Cross-tenant report.read must not unlock this org's Analytics nav.
  assert.equal(
    tenantHasAnalytics('t1', [
      {
        tenantId: 't2',
        eventId: 'e9',
        name: 'Other',
        permissions: ['report.read'],
      },
    ]),
    false,
  );
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

test('menu labels come from the injected translator (VI default / EN switch)', () => {
  const tenant = {
    tenantId: 't1',
    slug: 'demo',
    name: 'Demo Org',
    status: 'ACTIVE',
    role: 'Owner',
    tenantPermissions: ['event.list', 'members.manage', 'tenant.profile'],
  } as const;
  const keys = buildOrgMenuItems(
    't1',
    { ...tenant, tenantPermissions: [...tenant.tenantPermissions] },
    null,
    keyStub,
  );
  assert.deepEqual(
    keys.map((m) => m.label),
    [
      'nav.org.overview',
      'nav.org.events',
      'nav.org.members',
      'nav.org.settings',
    ],
  );
  const vi = buildOrgMenuItems(
    't1',
    { ...tenant, tenantPermissions: [...tenant.tenantPermissions] },
    null,
    viT,
  );
  const en = buildOrgMenuItems(
    't1',
    { ...tenant, tenantPermissions: [...tenant.tenantPermissions] },
    null,
    enT,
  );
  assert.equal(vi[0]!.label, 'Tổng quan tổ chức');
  assert.equal(en[0]!.label, 'Organization overview');
  // hrefs / keys / permissions are locale-independent (org+event context preserved)
  assert.deepEqual(
    vi.map((m) => [m.key, m.href, m.permission]),
    en.map((m) => [m.key, m.href, m.permission]),
  );
  const evVi = buildEventMenuItems('t1', 'e1', ['report.read'], viT);
  const evEn = buildEventMenuItems('t1', 'e1', ['report.read'], enT);
  assert.equal(evVi.find((m) => m.key === 'gate')!.label, 'Cổng');
  assert.equal(evEn.find((m) => m.key === 'gate')!.label, 'Gate');
});
