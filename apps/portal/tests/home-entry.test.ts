import assert from 'node:assert/strict';
import test from 'node:test';
import type { MeEventItem, MeTenantItem } from '@ticket/contracts';
import { firstAllowedTenantPath } from '../src/nav/capability-policy';
import { resolveHomeEntry } from '../src/nav/home-entry';
import { resolveOnboardingSurface } from '../src/onboarding';

function entryFor(tenants: MeTenantItem[], events: MeEventItem[]) {
  const surface = resolveOnboardingSurface({
    tenants,
    userId: 'new-user',
    eventCountForTenant: (tenantId) =>
      events.filter((event) => event.tenantId === tenantId).length,
  });
  if (surface.kind === 'signup' || surface.kind === 'customer') return surface.kind;
  return resolveHomeEntry(surface, tenants, events);
}

test('report-only Manager with event.create enters assigned Gate from home and switcher', () => {
  const tenant: MeTenantItem = {
    tenantId: 't1',
    slug: 'report',
    name: 'Report',
    status: 'ACTIVE',
    role: 'Manager',
    tenantPermissions: ['event.create'],
  };
  const event: MeEventItem = {
    tenantId: 't1',
    eventId: 'e1',
    name: 'Assigned event',
    permissions: ['report.read'],
  };
  const gate = '/t/t1/e/e1/gate';
  assert.equal(entryFor([tenant], [event]), gate);
  assert.equal(firstAllowedTenantPath(tenant, [event]), gate);
});

test('CS enters assigned Support from home', () => {
  const tenant: MeTenantItem = {
    tenantId: 't1',
    slug: 'support',
    name: 'Support',
    status: 'ACTIVE',
    role: 'CS',
    tenantPermissions: [],
  };
  const event: MeEventItem = {
    tenantId: 't1',
    eventId: 'e1',
    name: 'Assigned event',
    permissions: ['cs.lookup'],
  };
  assert.equal(entryFor([tenant], [event]), '/t/t1/e/e1/support');
});

test('new ACTIVE Owner with onboarding grants keeps first-run, with or without an event', () => {
  const tenant: MeTenantItem = {
    tenantId: 't1',
    slug: 'new-org',
    name: 'New org',
    status: 'ACTIVE',
    role: 'Owner',
    tenantPermissions: ['tenant.profile', 'members.manage', 'event.create'],
  };
  const event: MeEventItem = {
    tenantId: 't1',
    eventId: 'e1',
    name: 'First event',
    permissions: ['event.config', 'report.read'],
  };
  assert.equal(entryFor([tenant], []), '/onboarding/t1');
  assert.equal(entryFor([tenant], [event]), '/onboarding/t1');
});

test('PENDING activation keeps wait flow even if discovery contains an assigned event', () => {
  const tenant: MeTenantItem = {
    tenantId: 't1',
    slug: 'pending',
    name: 'Pending org',
    status: 'PENDING',
    role: 'Owner',
    tenantPermissions: ['event.create'],
  };
  const event: MeEventItem = {
    tenantId: 't1',
    eventId: 'e1',
    name: 'Assigned event',
    permissions: ['report.read'],
  };
  assert.equal(entryFor([tenant], [event]), '/onboarding/t1');
});
