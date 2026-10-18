import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SessionBoundary } from './session-boundary.ts';
import {
  StaffEligibilityStore,
  isMembershipAuthzDenial,
  staffDenyCopy,
  staffEligibleFromMeEvents,
} from './staff-eligibility.ts';

test('staffEligibleFromMeEvents is deny-by-default', () => {
  assert.equal(staffEligibleFromMeEvents(null), false);
  assert.equal(staffEligibleFromMeEvents(undefined), false);
  assert.equal(staffEligibleFromMeEvents({}), false);
  assert.equal(staffEligibleFromMeEvents({ staffEligible: false }), false);
  assert.equal(staffEligibleFromMeEvents({ staffEligible: 'true' }), false);
  assert.equal(staffEligibleFromMeEvents({ staffEligible: true }), true);
});

test('isMembershipAuthzDenial matches MEMBERSHIP_* / PERMISSION_DENIED 401/403', () => {
  assert.equal(isMembershipAuthzDenial(401, null), true);
  assert.equal(isMembershipAuthzDenial(403, { code: 'MEMBERSHIP_REVOKED' }), true);
  assert.equal(isMembershipAuthzDenial(403, { code: 'MEMBERSHIP_REQUIRED' }), true);
  assert.equal(isMembershipAuthzDenial(403, { code: 'PERMISSION_DENIED' }), true);
  assert.equal(isMembershipAuthzDenial(403, { code: 'ALREADY_CHECKED_IN' }), false);
  assert.equal(isMembershipAuthzDenial(403, {}), false);
  assert.equal(isMembershipAuthzDenial(200, { code: 'MEMBERSHIP_REVOKED' }), false);
  assert.equal(isMembershipAuthzDenial(500, { code: 'MEMBERSHIP_REVOKED' }), false);
});

test('staffDenyCopy is Vietnamese fail-closed', () => {
  assert.match(staffDenyCopy.title, /Không có quyền/);
  assert.match(staffDenyCopy.body, /ẩn/);
  assert.match(staffDenyCopy.announcement, /Không cho vào/);
});

test('StaffEligibilityStore hides staff when signed out', async () => {
  const store = new StaffEligibilityStore();
  let credential: string | null = null;
  const session = new SessionBoundary({
    read: async () => credential,
    write: async (next) => {
      credential = next;
    },
    clear: async () => {
      credential = null;
    },
  });
  const snap = await store.refresh(session);
  assert.equal(snap.staffEligible, false);
  assert.equal(snap.resolved, true);
  assert.equal(snap.loading, false);
});

test('StaffEligibilityStore shows staff only when MeEvents staffEligible true', async () => {
  const previous = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:39999';
  const originalFetch = globalThis.fetch;
  let eligible = false;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        staffEligible: eligible,
        items: eligible
          ? [
              {
                tenantId: '11111111-1111-1111-1111-111111111111',
                eventId: '22222222-2222-2222-2222-222222222222',
                name: 'Demo',
                permissions: ['gate.confirm'],
              },
            ]
          : [],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );

  let credential: string | null = 'tok';
  const session = new SessionBoundary({
    read: async () => credential,
    write: async (next) => {
      credential = next;
    },
    clear: async () => {
      credential = null;
    },
  });
  await session.establish('tok', async () => ({ userId: 'usr_staff' }));

  const store = new StaffEligibilityStore();
  try {
    eligible = false;
    let snap = await store.refresh(session);
    assert.equal(snap.staffEligible, false);
    assert.equal(snap.resolved, true);

    eligible = true;
    snap = await store.refresh(session);
    assert.equal(snap.staffEligible, true);

    // SEC-CACHE: 401/403 MeEvents must not keep staffEligible=true sticky
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ code: 'MEMBERSHIP_REVOKED' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    snap = await store.refresh(session);
    assert.equal(snap.staffEligible, false);
    assert.equal(snap.resolved, true);
    assert.equal(snap.loading, false);

    // Restore eligible, then explicit reset (Gate MEMBERSHIP_* path)
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          staffEligible: true,
          items: [
            {
              tenantId: '11111111-1111-1111-1111-111111111111',
              eventId: '22222222-2222-2222-2222-222222222222',
              name: 'Demo',
              permissions: ['gate.confirm'],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    snap = await store.refresh(session);
    assert.equal(snap.staffEligible, true);
    store.reset();
    assert.equal(store.getSnapshot().staffEligible, false);
    assert.equal(store.getSnapshot().resolved, true);

    // Network fail → hide (safer O02)
    globalThis.fetch = async () => {
      throw new TypeError('Network request failed');
    };
    snap = await store.refresh(session);
    assert.equal(snap.staffEligible, false);
    assert.equal(snap.resolved, true);
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = previous;
  }
});

test('StaffEligibilityStore reset aborts in-flight so late ok cannot restore revoke', async () => {
  const previous = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:39998';
  const originalFetch = globalThis.fetch;

  const deferred: {
    resolve: ((value: Response) => void) | null;
  } = { resolve: null };
  globalThis.fetch = () =>
    new Promise<Response>((resolve) => {
      deferred.resolve = resolve;
    });

  let credential: string | null = 'tok';
  const session = new SessionBoundary({
    read: async () => credential,
    write: async (next) => {
      credential = next;
    },
    clear: async () => {
      credential = null;
    },
  });
  await session.establish('tok', async () => ({ userId: 'usr_staff' }));
  const store = new StaffEligibilityStore();

  try {
    const pending = store.refresh(session);
    for (let i = 0; i < 50 && !deferred.resolve; i += 1) {
      await new Promise<void>((r) => setImmediate(r));
    }
    const finish = deferred.resolve;
    assert.ok(finish, 'fetch must be waiting after credential resolve');
    assert.equal(store.getSnapshot().loading, true);
    assert.equal(store.getSnapshot().staffEligible, false);

    store.reset();
    assert.equal(store.getSnapshot().staffEligible, false);
    assert.equal(store.getSnapshot().resolved, true);

    finish(
      new Response(
        JSON.stringify({
          staffEligible: true,
          items: [
            {
              tenantId: '11111111-1111-1111-1111-111111111111',
              eventId: '22222222-2222-2222-2222-222222222222',
              name: 'Demo',
              permissions: ['gate.confirm'],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    await pending;
    assert.equal(
      store.getSnapshot().staffEligible,
      false,
      'late MeEvents ok must not revive chrome after reset',
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = previous;
  }
});
