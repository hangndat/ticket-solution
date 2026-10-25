import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decideStaffStatus,
  fetchStaffStatus,
  isConsumerAuthenticatedPath,
  isStaffMembership,
  staffPortalLoginUrl,
} from '../src/oidc/staff-gate';

const TENANT = '11111111-1111-4111-8111-111111111111';
const tenantItem = {
  tenantId: TENANT,
  slug: 'demo',
  name: 'Demo',
  status: 'ACTIVE' as const,
  role: 'Scanner' as const,
  tenantPermissions: [],
};
const attendeeTenant = { ...tenantItem, role: 'Attendee' as const };

test('isStaffMembership: staff roles count; ticket-owner Attendee does not', () => {
  assert.equal(isStaffMembership({ items: [tenantItem] }), true);
  assert.equal(isStaffMembership({ items: [attendeeTenant] }), false);
  assert.equal(
    isStaffMembership({ items: [attendeeTenant, tenantItem] }),
    true,
  );
  assert.equal(isStaffMembership({ items: [] }), false);
  assert.equal(isStaffMembership(null), false);
});

test('decideStaffStatus: 200 + items ⇒ staff', () => {
  assert.equal(decideStaffStatus(200, { items: [tenantItem] }), 'staff');
});

test('decideStaffStatus: 200 + empty items ⇒ attendee', () => {
  assert.equal(decideStaffStatus(200, { items: [] }), 'attendee');
  assert.equal(decideStaffStatus(200, { items: [attendeeTenant] }), 'attendee');
  assert.equal(
    decideStaffStatus(200, { items: [attendeeTenant, tenantItem] }),
    'staff',
  );
});

test('decideStaffStatus: 401/403 and malformed roles are unknown', () => {
  assert.equal(decideStaffStatus(401, null), 'unknown');
  assert.equal(decideStaffStatus(403, null), 'unknown');
  assert.equal(
    decideStaffStatus(200, { items: [{ ...attendeeTenant, role: 'Mystery' }] }),
    'unknown',
  );
  assert.equal(
    decideStaffStatus(200, {
      items: [{ ...attendeeTenant, status: 'BROKEN' }],
    }),
    'unknown',
  );
  assert.equal(
    decideStaffStatus(200, {
      items: [{ ...attendeeTenant, tenantPermissions: ['event.create'] }],
    }),
    'unknown',
  );
});

test('decideStaffStatus: malformed / 5xx body ⇒ unknown (no attendee session)', () => {
  assert.equal(decideStaffStatus(500, null), 'unknown');
  assert.equal(decideStaffStatus(200, { items: 'nope' }), 'unknown');
  assert.equal(decideStaffStatus(200, null), 'unknown');
});

test('fetchStaffStatus: calls GET /v1/me/tenants with bearer token', async () => {
  let calledUrl = '';
  let calledAuth = '';
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calledUrl = url;
    calledAuth = new Headers(init?.headers).get('Authorization') ?? '';
    return new Response(JSON.stringify({ items: [tenantItem] }), {
      status: 200,
    });
  }) as typeof fetch;

  const status = await fetchStaffStatus({
    accessToken: 'tok123',
    apiBaseUrl: 'http://127.0.0.1:3001',
    fetchImpl,
  });

  assert.equal(status, 'staff');
  assert.equal(calledUrl, 'http://127.0.0.1:3001/v1/me/tenants');
  assert.equal(calledAuth, 'Bearer tok123');
});

test('fetchStaffStatus: attendee on empty membership', async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ items: [] }), {
      status: 200,
    })) as typeof fetch;
  const status = await fetchStaffStatus({
    accessToken: 'tok',
    apiBaseUrl: 'http://api.local',
    fetchImpl,
  });
  assert.equal(status, 'attendee');
});

test('fetchStaffStatus: network failure / timeout ⇒ unknown, never throws', async () => {
  const fetchImpl = (async () => {
    throw new Error('network down');
  }) as typeof fetch;
  const status = await fetchStaffStatus({
    accessToken: 'tok',
    apiBaseUrl: 'http://api.local',
    fetchImpl,
  });
  assert.equal(status, 'unknown');

  const timeoutFetch = ((_url: string, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () =>
        reject(init.signal?.reason),
      );
    })) as typeof fetch;
  const timedOut = await fetchStaffStatus({
    accessToken: 'token',
    apiBaseUrl: 'http://api.local',
    fetchImpl: timeoutFetch,
    timeoutMs: 1,
  });
  assert.equal(timedOut, 'unknown');
});

test('staffPortalLoginUrl rejects same origin and HTTPS downgrade', () => {
  assert.equal(
    staffPortalLoginUrl('https://app.vemoki.com', 'https://portal.vemoki.com'),
    'https://portal.vemoki.com/api/auth/login',
  );
  assert.equal(
    staffPortalLoginUrl('https://app.vemoki.com', 'https://app.vemoki.com'),
    null,
  );
  assert.equal(
    staffPortalLoginUrl('http://localhost:3010', 'http://localhost:3013'),
    null,
  );
  assert.equal(
    staffPortalLoginUrl('https://app.vemoki.com', 'http://portal.vemoki.com'),
    null,
  );
  assert.equal(staffPortalLoginUrl('http://127.0.0.1:3320', null), null);
});

test('isConsumerAuthenticatedPath: matches guarded attendee surfaces only', () => {
  for (const p of [
    '/wallet',
    '/wallet/abc',
    '/account',
    '/redeem',
    '/redeem/x',
    '/claim/tok',
    '/invite/tok',
    '/api/bff/tickets',
    '/api/bff/redeem',
    '/api/bff/claim',
    '/t/demo/tickets/id',
  ]) {
    assert.equal(isConsumerAuthenticatedPath(p), true, p);
  }
  for (const p of [
    '/',
    '/t/demo',
    '/privacy',
    '/admin',
    '/api/bff/me/tenants',
    '/api/bff/public/tenants/demo/events',
    '/api/auth/platform/login',
  ]) {
    assert.equal(isConsumerAuthenticatedPath(p), false, p);
  }
});
