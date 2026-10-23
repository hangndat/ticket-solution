import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveShellLoadState } from '../src/nav/load-shell-context';

const operatorMe = {
  operator: true,
  permittedCommands: ['tenant.create'],
  assurance: 'mfa',
};

const staffTenants = {
  items: [
    {
      tenantId: '11111111-1111-4111-8111-111111111111',
      slug: 'demo',
      name: 'Demo',
      status: 'ACTIVE',
      role: 'Owner',
      tenantPermissions: ['event.create'],
    },
  ],
};

test('all three discovery 401 → unauthenticated', () => {
  const state = resolveShellLoadState({
    tenantsResult: { status: 401, json: null },
    eventsResult: { status: 401, json: null },
    platformResult: { status: 401, json: null },
  });
  assert.equal(state.status, 'unauthenticated');
});

test('operator-only: platform 200, me 401 → ready operator shell', () => {
  const state = resolveShellLoadState({
    tenantsResult: { status: 401, json: null },
    eventsResult: { status: 401, json: null },
    platformResult: { status: 200, json: operatorMe },
  });
  assert.equal(state.status, 'ready');
  if (state.status === 'ready') {
    assert.equal(state.caps.showPlatform, true);
    assert.equal(state.caps.showOrgChrome, false);
  }
});

test('staff-only: platform 401, me tenants 200 → ready staff shell', () => {
  const state = resolveShellLoadState({
    tenantsResult: { status: 200, json: staffTenants },
    eventsResult: {
      status: 200,
      json: { staffEligible: true, items: [] },
    },
    platformResult: { status: 401, json: null },
  });
  assert.equal(state.status, 'ready');
  if (state.status === 'ready') {
    assert.equal(state.caps.showOrgChrome, true);
    assert.equal(state.caps.showPlatform, false);
  }
});

test('single staff discovery 5xx with other 401 → serverUnreachable', () => {
  const state = resolveShellLoadState({
    tenantsResult: { status: 500, json: { error: 'upstream' } },
    eventsResult: { status: 401, json: null },
    platformResult: { status: 401, json: null },
  });
  assert.deepEqual(state, {
    status: 'error',
    messageKey: 'shell.load.serverUnreachable',
  });
});

test('mixed 401 and 5xx on staff discovery → serverUnreachable', () => {
  const state = resolveShellLoadState({
    tenantsResult: { status: 401, json: null },
    eventsResult: { status: 503, json: null },
    platformResult: { status: 401, json: null },
  });
  assert.deepEqual(state, {
    status: 'error',
    messageKey: 'shell.load.serverUnreachable',
  });
});

test('all three discovery 5xx → serverUnreachable', () => {
  const state = resolveShellLoadState({
    tenantsResult: { status: 500, json: null },
    eventsResult: { status: 502, json: null },
    platformResult: { status: 503, json: null },
  });
  assert.deepEqual(state, {
    status: 'error',
    messageKey: 'shell.load.serverUnreachable',
  });
});

test('network failure on staff discovery (status 0) → serverUnreachable', () => {
  const state = resolveShellLoadState({
    tenantsResult: { status: 0, json: null },
    eventsResult: { status: 0, json: null },
    platformResult: { status: 401, json: null },
  });
  assert.deepEqual(state, {
    status: 'error',
    messageKey: 'shell.load.serverUnreachable',
  });
});
