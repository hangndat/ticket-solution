import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canAccessEventRoute,
  canAccessPortalPath,
  canAccessTenantRoute,
  canPerformEventAction,
  canPerformTenantAction,
  EVENT_ACTIONS,
  EVENT_ROUTES,
  TENANT_ACTIONS,
  TENANT_ROUTES,
} from '../src/nav/capability-policy';
import {
  buildEventMenuItems,
  buildOrgMenuItems,
} from '../src/nav/capabilities';
import type { MessageKey } from '../src/i18n/messages';

const translate = (key: MessageKey) => key;

/** Server discovery fixtures; role labels are descriptive and grant no access. */
const matrix = [
  {
    role: 'Owner',
    tenant: ['event.create', 'event.list', 'members.manage', 'tenant.profile'],
    event: [
      'event.update',
      'event.config',
      'config.publish',
      'inventory.import',
      'redemption.approve',
      'notify.send',
      'report.read',
      'cs.lookup',
      'export.create',
      'export.download',
    ],
  },
  {
    role: 'Manager',
    tenant: ['event.list'],
    event: [
      'event.update',
      'event.config',
      'config.publish',
      'inventory.import',
      'report.read',
    ],
  },
  {
    role: 'CS',
    tenant: [],
    event: ['cs.lookup', 'notify.send', 'redemption.approve'],
  },
  { role: 'Supervisor', tenant: [], event: ['report.read', 'gate.undo'] },
  { role: 'Scanner', tenant: [], event: ['gate.confirm'] },
  { role: 'report-only', tenant: [], event: ['report.read'] },
] as const;

test('Owner/Manager/CS/Supervisor/Scanner/report-only matrix: menu, direct route and action share permission codes', () => {
  for (const row of matrix) {
    const tenant = {
      tenantId: 't1',
      slug: 'demo',
      name: 'Demo',
      status: 'ACTIVE' as const,
      role: 'Owner' as const,
      tenantPermissions: [...row.tenant],
    };
    const event = {
      tenantId: 't1',
      eventId: 'e1',
      name: 'Event',
      permissions: [...row.event],
    };
    const orgMenu = buildOrgMenuItems('t1', tenant, [event], translate);
    const eventMenu = buildEventMenuItems('t1', 'e1', row.event, translate);
    const context = {
      tenantId: 't1',
      tenantPermissions: row.tenant,
      eventId: 'e1',
      eventPermissions: row.event,
      tenantEventPermissions: [row.event],
    };
    for (const route of Object.keys(
      TENANT_ROUTES,
    ) as (keyof typeof TENANT_ROUTES)[]) {
      const expected =
        canAccessTenantRoute(route, row.tenant) ||
        (route === 'overview' && row.event.includes('report.read'));
      const suffix = route === 'overview' ? '' : `/${route}`;
      assert.equal(
        canAccessPortalPath(`/t/t1${suffix}`, context),
        expected,
        `${row.role}: ${route} direct`,
      );
      if (route !== 'events/new') {
        assert.equal(
          orgMenu.some((item) => item.key === route),
          expected,
          `${row.role}: ${route} menu`,
        );
      }
    }
    assert.equal(
      canAccessPortalPath('/t/t1/analytics', context),
      row.event.includes('report.read'),
      `${row.role}: analytics direct`,
    );
    assert.equal(
      orgMenu.some((item) => item.key === 'analytics'),
      row.event.includes('report.read'),
      `${row.role}: analytics menu`,
    );
    for (const route of Object.keys(
      EVENT_ROUTES,
    ) as (keyof typeof EVENT_ROUTES)[]) {
      const expected = canAccessEventRoute(route, row.event);
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
    for (const action of Object.keys(
      EVENT_ACTIONS,
    ) as (keyof typeof EVENT_ACTIONS)[]) {
      assert.equal(
        canPerformEventAction(action, row.event),
        EVENT_ACTIONS[action].some((code) => row.event.includes(code)),
        `${row.role}: ${action}`,
      );
    }
    for (const action of Object.keys(
      TENANT_ACTIONS,
    ) as (keyof typeof TENANT_ACTIONS)[]) {
      assert.equal(
        canPerformTenantAction(action, row.tenant),
        TENANT_ACTIONS[action].some((code) => row.tenant.includes(code)),
        `${row.role}: ${action}`,
      );
    }
    assert.equal(canAccessPortalPath('/t/other/e/e1/gate', context), false);
    assert.equal(canAccessPortalPath('/t/t1/e/other/gate', context), false);
  }
});

test('Role label and revoked discovery grant nothing', () => {
  const context = {
    tenantId: 't1',
    tenantPermissions: [],
    eventId: 'e1',
    eventPermissions: [],
    tenantEventPermissions: [],
  };
  assert.equal(canAccessPortalPath('/t/t1/members', context), false);
  assert.equal(canAccessPortalPath('/t/t1/e/e1/gate', context), false);
  assert.equal(canPerformEventAction('createExport', []), false);
});
