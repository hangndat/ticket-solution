import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SessionBoundary } from './session-boundary.ts';
import {
  StaffEligibilityStore,
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

    // Network fail → hide (safer O02)
    globalThis.fetch = async () => {
      throw new TypeError('Network request failed');
    };
    snap = await store.refresh(session);
    assert.equal(snap.staffEligible, false);
    assert.equal(snap.resolved, true);

    store.reset();
    assert.equal(store.getSnapshot().staffEligible, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = previous;
  }
});
