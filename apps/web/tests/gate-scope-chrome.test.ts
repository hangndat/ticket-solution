import assert from 'node:assert/strict';
import test from 'node:test';
import {
  pickGateScopeChrome,
  resolveGateScopeChrome,
} from '../app/gate/gate-scope-chrome';

test('pickGateScopeChrome chooses first gate.confirm assignment', () => {
  const scope = pickGateScopeChrome([
    {
      tenantId: 't1',
      eventId: 'e-admin',
      name: 'Admin only',
      permissions: ['event.list'],
    },
    {
      tenantId: 't2',
      eventId: 'e-gate',
      name: 'MFest',
      permissions: ['gate.confirm'],
    },
  ]);
  assert.deepEqual(scope, {
    tenantId: 't2',
    eventId: 'e-gate',
    eventName: 'MFest',
  });
});

test('resolveGateScopeChrome prefers query ids when eligible', () => {
  const items = [
    {
      tenantId: 't1',
      eventId: 'e1',
      name: 'First',
      permissions: ['gate.confirm'],
    },
    {
      tenantId: 't2',
      eventId: 'e2',
      name: 'Second',
      permissions: ['gate.confirm'],
    },
  ];
  const scope = resolveGateScopeChrome(items, {
    tenantId: 't2',
    eventId: 'e2',
  });
  assert.equal(scope?.eventName, 'Second');
});
