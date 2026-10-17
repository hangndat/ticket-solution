import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SessionBoundary, type CredentialStore } from '../identity/session-boundary.ts';
import { createMemoryApnsRegistrationStore } from './apns-registration-store.ts';
import {
  __resetApnsRegistrationGenerationForTests,
  clearApnsRegistrationState,
  currentApnsRegistrationGeneration,
  registerApnsDeviceToken,
  resolveApnsApiEnvironment,
  type ApnsNotificationsLike,
} from './apns-device-token.ts';

function credentialStore(initial: string | null = null): CredentialStore & {
  peek: () => string | null;
} {
  let credential = initial;
  return {
    peek: () => credential,
    read: async () => credential,
    write: async (next) => {
      credential = next;
    },
    clear: async () => {
      credential = null;
    },
  };
}

function notificationsFixture(
  overrides: Partial<ApnsNotificationsLike> = {},
): ApnsNotificationsLike & { badges: number[] } {
  const badges: number[] = [];
  return {
    badges,
    getPermissionsAsync: async () => ({ status: 'granted' }),
    requestPermissionsAsync: async () => ({ status: 'granted' }),
    getDevicePushTokenAsync: async () => ({
      data: 'abcd1234efgh5678ijkl9012mnop3456',
    }),
    setBadgeCountAsync: async (count) => {
      badges.push(count);
    },
    ...overrides,
  };
}

function mockFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response>,
): typeof fetch {
  return ((url: string | URL, init?: RequestInit) =>
    handler(String(url), init)) as typeof fetch;
}

test('resolveApnsApiEnvironment maps production env to production', () => {
  assert.equal(resolveApnsApiEnvironment({}), 'sandbox');
  assert.equal(
    resolveApnsApiEnvironment({ APS_ENVIRONMENT: 'production' }),
    'production',
  );
  assert.equal(
    resolveApnsApiEnvironment({ APP_VARIANT: 'production' }),
    'production',
  );
});

test('permission-denied and empty token fail closed without POST', async () => {
  __resetApnsRegistrationGenerationForTests();
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test';
  const store = credentialStore('tok');
  const boundary = new SessionBoundary(store);
  await boundary.establish('tok', async () => ({ userId: 'user-a' }));
  let posts = 0;
  const denied = await registerApnsDeviceToken({
    session: boundary,
    platform: 'ios',
    store: createMemoryApnsRegistrationStore(),
    notifications: notificationsFixture({
      getPermissionsAsync: async () => ({ status: 'denied' }),
      requestPermissionsAsync: async () => ({ status: 'denied' }),
    }),
    fetchImpl: mockFetch(async () => {
      posts += 1;
      return new Response('{}', { status: 500 });
    }),
  });
  assert.equal(denied.status, 'permission-denied');
  assert.equal(posts, 0);

  const empty = await registerApnsDeviceToken({
    session: boundary,
    platform: 'ios',
    store: createMemoryApnsRegistrationStore(),
    notifications: notificationsFixture({
      getDevicePushTokenAsync: async () => ({ data: '   ' }),
    }),
    fetchImpl: mockFetch(async () => {
      posts += 1;
      return new Response('{}', { status: 500 });
    }),
  });
  assert.equal(empty.status, 'unavailable');
  assert.equal(posts, 0);
});

test('verified session POSTs device token and stores registrationId', async () => {
  __resetApnsRegistrationGenerationForTests();
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test';
  const store = credentialStore('tok');
  const boundary = new SessionBoundary(store);
  await boundary.establish('tok', async () => ({ userId: 'user-a' }));
  const regStore = createMemoryApnsRegistrationStore();
  const result = await registerApnsDeviceToken({
    session: boundary,
    platform: 'ios',
    store: regStore,
    notifications: notificationsFixture(),
    resolveEnvironment: () => 'sandbox',
    fetchImpl: mockFetch(async (url, init) => {
      assert.match(url, /\/v1\/me\/device-tokens$/);
      assert.equal(init?.method, 'POST');
      const body = JSON.parse(String(init?.body)) as {
        token: string;
        environment: string;
      };
      assert.equal(body.environment, 'sandbox');
      assert.ok(body.token.length >= 16);
      return new Response(
        JSON.stringify({
          registrationId: '22222222-2222-2222-2222-222222222222',
          environment: 'sandbox',
          registeredAt: '2026-10-17T02:00:00.000Z',
        }),
        { status: 200 },
      );
    }),
  });
  assert.equal(result.status, 'ready');
  if (result.status === 'ready') {
    assert.equal(result.backend, 'registered');
    assert.equal(
      result.registration?.registrationId,
      '22222222-2222-2222-2222-222222222222',
    );
  }
  assert.equal(
    regStore.peek()?.registrationId,
    '22222222-2222-2222-2222-222222222222',
  );
});

test('clearApnsRegistrationState DELETEs then clears local + badge', async () => {
  __resetApnsRegistrationGenerationForTests();
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test';
  const store = credentialStore('tok');
  const boundary = new SessionBoundary(store);
  await boundary.establish('tok', async () => ({ userId: 'user-a' }));
  const regStore = createMemoryApnsRegistrationStore({
    registrationId: '22222222-2222-2222-2222-222222222222',
    environment: 'sandbox',
    userId: 'user-a',
  });
  const notifications = notificationsFixture();
  let deleted = false;
  const genBefore = currentApnsRegistrationGeneration();
  await clearApnsRegistrationState({
    session: boundary,
    store: regStore,
    notifications,
    fetchImpl: mockFetch(async (url, init) => {
      assert.match(url, /\/v1\/me\/device-tokens\/22222222/);
      assert.equal(init?.method, 'DELETE');
      deleted = true;
      return new Response(null, { status: 204 });
    }),
  });
  assert.equal(deleted, true);
  assert.equal(regStore.peek(), null);
  assert.deepEqual(notifications.badges, [0]);
  assert.equal(currentApnsRegistrationGeneration(), genBefore + 1);
});

test('logout path: clear before logout cancels late register and drops store', async () => {
  __resetApnsRegistrationGenerationForTests();
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test';
  const store = credentialStore('tok');
  const boundary = new SessionBoundary(store);
  await boundary.establish('tok', async () => ({ userId: 'user-a' }));
  const regStore = createMemoryApnsRegistrationStore();
  const notifications = notificationsFixture({
    getDevicePushTokenAsync: async () => {
      // Simulate account-switch mid-flight: detach then logout.
      await clearApnsRegistrationState({
        session: boundary,
        store: regStore,
        notifications: notificationsFixture(),
        fetchImpl: mockFetch(async () => new Response(null, { status: 204 })),
      });
      await boundary.logout();
      return { data: 'abcd1234efgh5678ijkl9012mnop3456' };
    },
  });

  let posts = 0;
  const result = await registerApnsDeviceToken({
    session: boundary,
    platform: 'ios',
    store: regStore,
    notifications,
    fetchImpl: mockFetch(async () => {
      posts += 1;
      return new Response(
        JSON.stringify({
          registrationId: '33333333-3333-3333-3333-333333333333',
          environment: 'sandbox',
          registeredAt: '2026-10-17T03:00:00.000Z',
        }),
        { status: 200 },
      );
    }),
  });
  assert.equal(result.status, 'cancelled');
  assert.equal(posts, 0);
  assert.equal(regStore.peek(), null);
  assert.equal(boundary.getSnapshot().status, 'signed-out');
});

test('signed-out register skips backend POST (skipped-unsigned)', async () => {
  __resetApnsRegistrationGenerationForTests();
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test';
  const boundary = new SessionBoundary(credentialStore(null));
  let posts = 0;
  const result = await registerApnsDeviceToken({
    session: boundary,
    platform: 'ios',
    store: createMemoryApnsRegistrationStore(),
    notifications: notificationsFixture(),
    fetchImpl: mockFetch(async () => {
      posts += 1;
      return new Response('{}', { status: 500 });
    }),
  });
  assert.equal(result.status, 'ready');
  if (result.status === 'ready') {
    assert.equal(result.backend, 'skipped-unsigned');
  }
  assert.equal(posts, 0);
});
