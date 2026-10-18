import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GUEST_NAV_LINKS,
  type NavCapabilities,
  type NavLink,
} from '../src/nav/capabilities';
import { isMembershipAuthzDenial } from '../src/nav/membership-authz';
import {
  NavCapabilitiesStore,
  navCapabilitiesStore,
  resetNavCapabilitiesStoreForTests,
} from '../src/nav/nav-capabilities-store';
import {
  fetchJson,
  subscribeFetchJsonResult,
  type FetchJsonResult,
} from '../src/redeem/fetch-json';

const STAFF_CAPS: NavCapabilities = {
  authenticated: true,
  showAdmin: true,
  showGate: true,
  showPlatform: false,
  showAccount: true,
};

const STAFF_LINKS: NavLink[] = [
  { href: '/redeem', label: 'Đổi mã', testId: 'nav-redeem' },
  { href: '/claim', label: 'Nhận lời mời', testId: 'nav-claim' },
  { href: '/admin', label: 'Sự kiện', testId: 'nav-admin' },
  { href: '/gate', label: 'Cổng', testId: 'nav-gate' },
  { href: '/account', label: 'Tài khoản', testId: 'nav-account' },
  { href: '/auth', label: 'Đăng nhập', testId: 'nav-auth' },
];

test('isMembershipAuthzDenial matches MEMBERSHIP_* / PERMISSION_DENIED 401/403', () => {
  assert.equal(isMembershipAuthzDenial(401, null), true);
  assert.equal(isMembershipAuthzDenial(401, { code: 'UNAUTHENTICATED' }), true);
  assert.equal(
    isMembershipAuthzDenial(403, { code: 'MEMBERSHIP_REVOKED' }),
    true,
  );
  assert.equal(
    isMembershipAuthzDenial(403, { code: 'MEMBERSHIP_REQUIRED' }),
    true,
  );
  assert.equal(
    isMembershipAuthzDenial(403, { code: 'PERMISSION_DENIED' }),
    true,
  );
  assert.equal(isMembershipAuthzDenial(403, { code: 'SLUG_TAKEN' }), false);
  assert.equal(isMembershipAuthzDenial(403, { message: 'nope' }), false);
  assert.equal(isMembershipAuthzDenial(403, null), false);
  assert.equal(isMembershipAuthzDenial(200, { code: 'MEMBERSHIP_REVOKED' }), false);
  assert.equal(isMembershipAuthzDenial(500, { code: 'MEMBERSHIP_REVOKED' }), false);
});

test('NavCapabilitiesStore.reset clears staff links immediately', () => {
  const store = new NavCapabilitiesStore(async () => ({
    caps: STAFF_CAPS,
    links: STAFF_LINKS,
  }));
  store.replaceSnapshot({
    caps: STAFF_CAPS,
    links: STAFF_LINKS,
    resolved: true,
    loading: false,
  });
  assert.ok(store.getSnapshot().links.some((l) => l.href === '/admin'));

  store.reset();
  const snap = store.getSnapshot();
  assert.equal(snap.resolved, true);
  assert.equal(snap.loading, false);
  assert.equal(snap.caps.showAdmin, false);
  assert.equal(snap.caps.showGate, false);
  assert.deepEqual(
    snap.links.map((l) => l.href),
    GUEST_NAV_LINKS.map((l) => l.href),
  );
});

test('handleAuthzDenial clears staff then refetch can restore when still eligible', async () => {
  let loads = 0;
  const store = new NavCapabilitiesStore(async () => {
    loads += 1;
    return { caps: STAFF_CAPS, links: STAFF_LINKS };
  });
  store.replaceSnapshot({
    caps: STAFF_CAPS,
    links: STAFF_LINKS,
    resolved: true,
    loading: false,
  });

  store.handleAuthzDenial(403, { code: 'MEMBERSHIP_REVOKED' });
  // Immediately after denial: guest chrome (before refetch settles).
  assert.ok(!store.getSnapshot().links.some((l) => l.href === '/admin'));

  await new Promise((r) => setTimeout(r, 0));
  await store.refresh(); // ensure settled if race
  // Wait for the void refresh from handleAuthzDenial
  for (let i = 0; i < 20 && store.getSnapshot().loading; i += 1) {
    await new Promise((r) => setTimeout(r, 5));
  }
  assert.ok(loads >= 1);
  // Loader still returns staff — chrome restored after revalidation.
  assert.ok(store.getSnapshot().links.some((l) => l.href === '/admin'));
});

test('handleAuthzDenial ignores non-membership 403', () => {
  const store = new NavCapabilitiesStore(async () => ({
    caps: STAFF_CAPS,
    links: STAFF_LINKS,
  }));
  store.replaceSnapshot({
    caps: STAFF_CAPS,
    links: STAFF_LINKS,
    resolved: true,
    loading: false,
  });
  store.handleAuthzDenial(403, { code: 'SLUG_TAKEN' });
  assert.ok(store.getSnapshot().links.some((l) => l.href === '/admin'));
});

test('late refresh after reset cannot restore revoked chrome', async () => {
  let resolveLoad!: (v: { caps: NavCapabilities; links: NavLink[] }) => void;
  const store = new NavCapabilitiesStore(
    () =>
      new Promise((resolve) => {
        resolveLoad = resolve;
      }),
  );

  const pending = store.refresh();
  store.reset();
  resolveLoad({ caps: STAFF_CAPS, links: STAFF_LINKS });
  await pending;

  const snap = store.getSnapshot();
  assert.equal(snap.caps.showAdmin, false);
  assert.ok(!snap.links.some((l) => l.href === '/admin'));
});

test('fetchJson publishes results to observers (SEC-CACHE hook)', async () => {
  const seen: Array<{ result: FetchJsonResult; url: string }> = [];
  const unsub = subscribeFetchJsonResult((result, requestUrl) => {
    seen.push({ result, url: requestUrl });
  });
  const fetchImpl: typeof fetch = async () =>
    new Response(JSON.stringify({ code: 'MEMBERSHIP_REVOKED' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });

  const result = await fetchJson(
    '/api/bff/admin/events',
    { method: 'GET' },
    5_000,
    fetchImpl,
  );
  unsub();
  assert.equal(result.status, 403);
  assert.equal(seen.length, 1);
  assert.equal(seen[0]!.result.status, 403);
  assert.equal(seen[0]!.url, '/api/bff/admin/events');
  assert.deepEqual(seen[0]!.result.json, { code: 'MEMBERSHIP_REVOKED' });
});

test('isNavDiscoveryRequestUrl excludes me/events tenants platform/me', async () => {
  const { isNavDiscoveryRequestUrl } = await import(
    '../src/nav/bind-fetch-authz-observer'
  );
  assert.equal(isNavDiscoveryRequestUrl('/api/bff/me/events'), true);
  assert.equal(isNavDiscoveryRequestUrl('/api/bff/me/tenants'), true);
  assert.equal(isNavDiscoveryRequestUrl('/api/bff/platform/me'), true);
  assert.equal(isNavDiscoveryRequestUrl('/api/bff/admin/events'), false);
});

test('singleton reset helper clears shared store', () => {
  resetNavCapabilitiesStoreForTests();
  const snap = navCapabilitiesStore.getSnapshot();
  assert.equal(snap.caps.showAdmin, false);
  assert.deepEqual(
    snap.links.map((l) => l.href),
    GUEST_NAV_LINKS.map((l) => l.href),
  );
});
