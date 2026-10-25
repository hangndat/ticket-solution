import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { MeEventItem, MeTenantItem } from '@ticket/contracts';
import {
  isEventAssigned,
  isEventPagePermitted,
  type EventPageMenuKey,
} from '../src/prep/event-access-resolver';

const tenantStub = (overrides: Partial<MeTenantItem> = {}): MeTenantItem => ({
  tenantId: 't1',
  name: 'Tenant',
  slug: 'tenant',
  role: 'owner',
  status: 'active',
  tenantPermissions: [],
  ...overrides,
});

const eventStub = (permissions: string[]): MeEventItem => ({
  tenantId: 't1',
  eventId: 'e1',
  name: 'Event',
  status: 'draft',
  permissions,
});

describe('isEventAssigned', () => {
  test('denies when tenant or event missing', () => {
    assert.equal(isEventAssigned(null, eventStub(['cs.lookup'])), false);
    assert.equal(isEventAssigned(tenantStub(), null), false);
    assert.equal(
      isEventAssigned(tenantStub(), eventStub(['cs.lookup'])),
      true,
    );
  });

  test('does not require tenant admin chrome', () => {
    assert.equal(
      isEventAssigned(tenantStub({ tenantPermissions: [] }), eventStub(['cs.lookup'])),
      true,
    );
  });
});

describe('isEventPagePermitted — menu-aligned matrix', () => {
  const cases: {
    page: EventPageMenuKey;
    permissions: string[];
    expected: boolean;
  }[] = [
    { page: 'overview', permissions: [], expected: true },
    { page: 'overview', permissions: ['cs.lookup'], expected: true },
    { page: 'support', permissions: ['cs.lookup'], expected: true },
    { page: 'support', permissions: ['report.read'], expected: false },
    { page: 'setup', permissions: ['cs.lookup'], expected: false },
    { page: 'setup', permissions: ['event.update'], expected: true },
    { page: 'types', permissions: ['config.publish'], expected: true },
    { page: 'gate', permissions: ['report.read'], expected: true },
    { page: 'gate', permissions: ['gate.confirm'], expected: false },
    { page: 'guests', permissions: ['inventory.import'], expected: true },
    { page: 'audit', permissions: ['report.read'], expected: true },
    { page: 'audit', permissions: ['inventory.import'], expected: true },
    { page: 'audit', permissions: ['gate.confirm'], expected: false },
  ];

  for (const { page, permissions, expected } of cases) {
    test(`${page} with [${permissions.join(', ')}] → ${expected}`, () => {
      assert.equal(isEventPagePermitted(page, permissions), expected);
    });
  }
});
