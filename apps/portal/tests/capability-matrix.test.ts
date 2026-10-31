import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canAccessPortalPath,
  canPerformEventAction,
  canPerformTenantAction,
  firstAllowedEventPath,
  firstAllowedTenantPath,
} from '../src/nav/capability-policy';
import {
  buildEventMenuItems,
  buildOrgMenuItems,
} from '../src/nav/capabilities';
import type { MessageKey } from '../src/i18n/messages';

const translate = (key: MessageKey) => key;
const tenantRoutes = [
  'overview',
  'events',
  'events/new',
  'members',
  'settings',
  'analytics',
] as const;
const eventRoutes = [
  'overview',
  'setup',
  'types',
  'sources',
  'quota',
  'config',
  'guests',
  'gate',
  'audit',
  'support',
] as const;
const tenantActions = [
  'createEvent',
  'listEvents',
  'manageMembers',
  'editSettings',
] as const;
const eventActions = [
  'readReport',
  'readCodes',
  'lookupSupport',
  'saveConfig',
  'createType',
  'createSource',
  'updateEvent',
  'publishConfig',
  'importInventory',
  'approveRedemption',
  'sendNotification',
  'createExport',
  'downloadExport',
] as const;

// Literal discovery grants mirror server role-map. Expected results below do not use policy tables.
const managerEvent = [
  'event.config',
  'event.publish',
  'inventory.import',
  'redemption.approve',
  'report.read',
  'export.create',
  'export.download',
];
const rows = [
  {
    role: 'Owner',
    tenant: ['tenant.profile', 'members.manage', 'event.create', 'event.list'],
    event: [
      ...managerEvent,
      'cs.lookup',
      'cs.resend',
      'gate.confirm',
      'gate.undo',
      'ticket.revoke',
    ],
    tenantRoutes: [
      'overview',
      'events',
      'events/new',
      'members',
      'settings',
      'analytics',
    ],
    eventRoutes: [
      'overview',
      'types',
      'sources',
      'quota',
      'config',
      'guests',
      'gate',
      'audit',
      'support',
    ],
    tenantActions: [
      'createEvent',
      'listEvents',
      'manageMembers',
      'editSettings',
    ],
    eventActions: [
      'readReport',
      'readCodes',
      'lookupSupport',
      'saveConfig',
      'createType',
      'createSource',
      'publishConfig',
      'importInventory',
      'approveRedemption',
      'sendNotification',
      'createExport',
      'downloadExport',
    ],
    entry: '/t/t1',
    eventEntry: '/t/t1/e/e1',
  },
  {
    role: 'Manager',
    tenant: ['event.create'],
    event: managerEvent,
    tenantRoutes: ['overview', 'events/new', 'analytics'],
    eventRoutes: [
      'overview',
      'types',
      'sources',
      'quota',
      'config',
      'guests',
      'gate',
      'audit',
    ],
    tenantActions: ['createEvent'],
    eventActions: [
      'readReport',
      'readCodes',
      'saveConfig',
      'createType',
      'createSource',
      'publishConfig',
      'importInventory',
      'approveRedemption',
      'sendNotification',
      'createExport',
      'downloadExport',
    ],
    entry: '/t/t1',
    eventEntry: '/t/t1/e/e1',
  },
  {
    role: 'CS',
    tenant: [],
    event: ['cs.lookup', 'cs.resend'],
    tenantRoutes: [],
    eventRoutes: ['support', 'guests'],
    tenantActions: [],
    eventActions: ['lookupSupport'],
    entry: '/t/t1/e/e1/support',
    eventEntry: '/t/t1/e/e1/support',
  },
  {
    role: 'Supervisor',
    tenant: [],
    event: ['gate.confirm', 'gate.undo', 'ticket.revoke'],
    tenantRoutes: [],
    eventRoutes: [],
    tenantActions: [],
    eventActions: [],
    entry: null,
    eventEntry: null,
  },
  {
    role: 'Scanner',
    tenant: [],
    event: ['gate.confirm'],
    tenantRoutes: [],
    eventRoutes: [],
    tenantActions: [],
    eventActions: [],
    entry: null,
    eventEntry: null,
  },
  {
    role: 'report-only',
    tenant: [],
    event: ['report.read'],
    tenantRoutes: ['overview', 'analytics'],
    eventRoutes: ['gate', 'audit'],
    tenantActions: [],
    eventActions: ['readReport'],
    entry: '/t/t1/e/e1/gate',
    eventEntry: '/t/t1/e/e1/gate',
  },
];

test('server discovery matrix: direct routes, menu, actions and entry', () => {
  for (const row of rows) {
    const tenant = {
      tenantId: 't1',
      slug: 'demo',
      name: 'Demo',
      status: 'ACTIVE' as const,
      role: row.role as 'Owner',
      tenantPermissions: row.tenant,
    };
    const event = {
      tenantId: 't1',
      eventId: 'e1',
      name: 'Event',
      permissions: row.event,
    };
    const context = {
      tenantId: 't1',
      tenantPermissions: row.tenant,
      eventId: 'e1',
      eventPermissions: row.event,
      tenantEventPermissions: [row.event],
    };
    const orgMenu = buildOrgMenuItems('t1', tenant, [event], translate);
    const eventMenu = buildEventMenuItems('t1', 'e1', row.event, translate);
    for (const route of tenantRoutes) {
      const expected = row.tenantRoutes.includes(route);
      const suffix = route === 'overview' ? '' : `/${route}`;
      assert.equal(
        canAccessPortalPath(`/t/t1${suffix}`, context),
        expected,
        `${row.role}: ${route} direct`,
      );
      if (route !== 'events/new')
        assert.equal(
          orgMenu.some((item) => item.key === route),
          expected,
          `${row.role}: ${route} menu`,
        );
    }
    for (const route of eventRoutes) {
      const expected = row.eventRoutes.includes(route);
      const suffix = route === 'overview' ? '' : `/${route}`;
      assert.equal(
        canAccessPortalPath(`/t/t1/e/e1${suffix}`, context),
        expected,
        `${row.role}: ${route} direct`,
      );
      assert.equal(
        eventMenu.some((item) => item.key === route),
        expected,
        `${row.role}: ${route} menu`,
      );
    }
    for (const action of tenantActions)
      assert.equal(
        canPerformTenantAction(action, row.tenant),
        row.tenantActions.includes(action),
        `${row.role}: ${action}`,
      );
    for (const action of eventActions)
      assert.equal(
        canPerformEventAction(action, row.event),
        row.eventActions.includes(action),
        `${row.role}: ${action}`,
      );
    assert.equal(
      firstAllowedEventPath(event),
      row.eventEntry,
      `${row.role}: event entry`,
    );
    assert.equal(
      firstAllowedTenantPath(tenant, [event]),
      row.entry,
      `${row.role}: tenant entry`,
    );
    assert.equal(canAccessPortalPath('/t/other/e/e1/gate', context), false);
    assert.equal(canAccessPortalPath('/t/t1/e/other/gate', context), false);
    assert.equal(
      canAccessPortalPath('/t/t1/reports', context),
      canAccessPortalPath('/t/t1/analytics', context),
      `${row.role}: /reports grant matches /analytics`,
    );
    assert.equal(
      canAccessPortalPath('/t/t1/e/e1/reports', context),
      canAccessPortalPath('/t/t1/e/e1/gate', context),
      `${row.role}: event /reports grant matches /gate`,
    );
    assert.equal(
      orgMenu.some(
        (item) => item.key === 'reports' || item.href.endsWith('/reports'),
      ),
      false,
      `${row.role}: org menu has no second reports product`,
    );
  }
});

test('legacy /reports is analytics (or event gate), not a forbidden dead URL', () => {
  const reportOnly = {
    tenantId: 't1',
    tenantPermissions: [] as string[],
    eventId: 'e1',
    eventPermissions: ['report.read'],
    tenantEventPermissions: [['report.read']],
  };
  const scanner = {
    ...reportOnly,
    eventPermissions: ['gate.confirm'],
    tenantEventPermissions: [['gate.confirm']],
  };
  assert.equal(canAccessPortalPath('/t/t1/analytics', reportOnly), true);
  assert.equal(canAccessPortalPath('/t/t1/reports', reportOnly), true);
  assert.equal(canAccessPortalPath('/t/t1/e/e1/gate', reportOnly), true);
  assert.equal(canAccessPortalPath('/t/t1/e/e1/reports', reportOnly), true);
  assert.equal(canAccessPortalPath('/t/t1/reports', scanner), false);
  assert.equal(canAccessPortalPath('/t/t1/analytics', scanner), false);
  assert.equal(canAccessPortalPath('/t/t1/e/e1/reports', scanner), false);
  assert.deepEqual(
    buildOrgMenuItems(
      't1',
      {
        tenantId: 't1',
        slug: 'demo',
        name: 'Demo',
        status: 'ACTIVE',
        role: 'Owner',
        tenantPermissions: [],
      },
      [
        {
          tenantId: 't1',
          eventId: 'e1',
          name: 'Event',
          permissions: ['report.read'],
        },
      ],
      translate,
    ).map((item) => item.key),
    ['overview', 'analytics'],
  );
});

test('role label grants nothing and revoked discovery denies routes and actions', () => {
  const tenant = {
    tenantId: 't1',
    slug: 'demo',
    name: 'Demo',
    status: 'ACTIVE' as const,
    role: 'Owner' as const,
    tenantPermissions: [],
  };
  const event = {
    tenantId: 't1',
    eventId: 'e1',
    name: 'Event',
    permissions: [],
  };
  assert.deepEqual(buildOrgMenuItems('t1', tenant, [event], translate), []);
  assert.deepEqual(buildEventMenuItems('t1', 'e1', [], translate), []);
  assert.equal(firstAllowedTenantPath(tenant, [event]), null);
  assert.equal(firstAllowedEventPath(event), null);
  assert.equal(
    canAccessPortalPath('/t/t1/e/e1/support', {
      tenantId: 't1',
      tenantPermissions: [],
      eventId: 'e1',
      eventPermissions: [],
      tenantEventPermissions: [[]],
    }),
    false,
  );
  assert.equal(canPerformEventAction('publishConfig', []), false);
  assert.equal(canPerformTenantAction('manageMembers', []), false);
});
