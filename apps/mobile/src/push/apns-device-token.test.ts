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

test('empty token and native token throw fail closed without POST', async () => {
  __resetApnsRegistrationGenerationForTests();
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test';
  const store = credentialStore('tok');
  const boundary = new SessionBoundary(store);
  await boundary.establish('tok', async () => ({ userId: 'user-a' }));
  let posts = 0;

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

  const threw = await registerApnsDeviceToken({
    session: boundary,
    platform: 'ios',
    store: createMemoryApnsRegistrationStore(),
    notifications: notificationsFixture({
      getDevicePushTokenAsync: async () => {
        throw new Error('native unavailable');
      },
    }),
    fetchImpl: mockFetch(async () => {
      posts += 1;
      return new Response('{}', { status: 500 });
    }),
  });
  assert.equal(threw.status, 'unavailable');
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

test('deferred old APNs detach leaves a newly authenticated registration intact', async () => {
  __resetApnsRegistrationGenerationForTests();
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test';
  const boundary = new SessionBoundary(credentialStore('old'));
  await boundary.establish('old', async () => ({ userId: 'user-a' }));
  const epoch = boundary.captureEpoch()!;
  const regStore = createMemoryApnsRegistrationStore({
    registrationId: '22222222-2222-2222-2222-222222222222',
    environment: 'sandbox', userId: 'user-a',
  });
  const notifications = notificationsFixture();
  let release!: () => void;
  let started!: () => void;
  const hold = new Promise<void>((done) => { release = done; });
  const atDelete = new Promise<void>((done) => { started = done; });
  const detach = clearApnsRegistrationState({
    session: boundary, store: regStore, notifications,
    shouldContinue: () => boundary.isEpochCurrent(epoch),
    fetchImpl: mockFetch(async () => { started(); await hold; return new Response(null, { status: 204 }); }),
  });
  await atDelete;
  await boundary.establish('new', async () => ({ userId: 'user-b' }));
  await regStore.write({
    registrationId: '33333333-3333-3333-3333-333333333333',
    environment: 'sandbox', userId: 'user-b',
  });
  release();
  await detach;
  assert.equal(regStore.peek()?.userId, 'user-b');
  assert.deepEqual(notifications.badges, []);
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

test('late POST 2xx after clear compensates with DELETE registrationId', async () => {
  __resetApnsRegistrationGenerationForTests();
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test';
  const store = credentialStore('tok');
  const boundary = new SessionBoundary(store);
  await boundary.establish('tok', async () => ({ userId: 'user-a' }));
  const regStore = createMemoryApnsRegistrationStore();

  let resolvePost: ((value: Response) => void) | undefined;
  const postBody = new Promise<Response>((resolve) => {
    resolvePost = resolve;
  });
  let postStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    postStarted = resolve;
  });
  const deletedUrls: string[] = [];

  const registerPromise = registerApnsDeviceToken({
    session: boundary,
    platform: 'ios',
    store: regStore,
    notifications: notificationsFixture(),
    resolveEnvironment: () => 'sandbox',
    fetchImpl: mockFetch(async (url, init) => {
      if (init?.method === 'POST') {
        postStarted();
        return postBody;
      }
      if (init?.method === 'DELETE') {
        deletedUrls.push(url);
        return new Response(null, { status: 204 });
      }
      return new Response('', { status: 500 });
    }),
  });

  await started;
  await clearApnsRegistrationState({
    session: boundary,
    store: regStore,
    notifications: notificationsFixture(),
    fetchImpl: mockFetch(async () => new Response(null, { status: 204 })),
  });
  resolvePost!(
    new Response(
      JSON.stringify({
        registrationId: '44444444-4444-4444-4444-444444444444',
        environment: 'sandbox',
        registeredAt: '2026-10-17T04:00:00.000Z',
      }),
      { status: 200 },
    ),
  );

  const result = await registerPromise;
  assert.equal(result.status, 'cancelled');
  assert.ok(
    deletedUrls.some((url) =>
      url.includes('/v1/me/device-tokens/44444444-4444-4444-4444-444444444444'),
    ),
    `expected compensating DELETE, got ${JSON.stringify(deletedUrls)}`,
  );
  assert.equal(regStore.peek(), null);
});

test('DELETE failure after late POST retains a pending detach and reports failure', async () => {
  __resetApnsRegistrationGenerationForTests();
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test';
  const store = credentialStore('tok');
  const boundary = new SessionBoundary(store);
  await boundary.establish('tok', async () => ({ userId: 'user-a' }));
  const regStore = createMemoryApnsRegistrationStore();

  let resolvePost: ((value: Response) => void) | undefined;
  const postBody = new Promise<Response>((resolve) => {
    resolvePost = resolve;
  });
  let postStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    postStarted = resolve;
  });

  const registerPromise = registerApnsDeviceToken({
    session: boundary,
    platform: 'ios',
    store: regStore,
    notifications: notificationsFixture(),
    resolveEnvironment: () => 'sandbox',
    fetchImpl: mockFetch(async (_url, init) => {
      if (init?.method === 'POST') {
        postStarted();
        return postBody;
      }
      if (init?.method === 'DELETE') {
        throw new TypeError('network down during compensate DELETE');
      }
      return new Response('', { status: 500 });
    }),
  });

  await started;
  await clearApnsRegistrationState({
    session: boundary,
    store: regStore,
    notifications: notificationsFixture(),
    fetchImpl: mockFetch(async () => new Response(null, { status: 204 })),
  });
  resolvePost!(
    new Response(
      JSON.stringify({
        registrationId: '55555555-5555-5555-5555-555555555555',
        environment: 'sandbox',
        registeredAt: '2026-10-17T04:30:00.000Z',
      }),
      { status: 200 },
    ),
  );

  await assert.rejects(registerPromise, /Chưa xác nhận gỡ đăng ký thông báo/);
  assert.equal(regStore.peek(), null);
  assert.equal((await regStore.pendingFor('user-a'))[0]?.registrationId, '55555555-5555-5555-5555-555555555555');
});

test('late A POST compensation preserves B registration and B logout DELETEs B', async () => {
  __resetApnsRegistrationGenerationForTests();
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test';
  const boundary = new SessionBoundary(credentialStore('bearer-a'));
  await boundary.establish('bearer-a', async () => ({ userId: 'user-a' }));
  const regStore = createMemoryApnsRegistrationStore();
  let resolveA!: (value: Response) => void;
  let startedA!: () => void;
  const aPost = new Promise<Response>((resolve) => { resolveA = resolve; });
  const aStarted = new Promise<void>((resolve) => { startedA = resolve; });
  const deletes: string[] = [];
  const fetchImpl = mockFetch(async (url, init) => {
    if (init?.method === 'POST' && new Headers(init.headers).get('Authorization') === 'Bearer bearer-a') {
      startedA();
      return aPost;
    }
    if (init?.method === 'POST') return new Response(JSON.stringify({
      registrationId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      environment: 'sandbox', registeredAt: '2026-10-24T00:00:00.000Z',
    }), { status: 200 });
    if (init?.method === 'DELETE') {
      deletes.push(url);
      return new Response(null, { status: 204 });
    }
    return new Response(null, { status: 500 });
  });
  const a = registerApnsDeviceToken({ session: boundary, store: regStore, platform: 'ios',
    notifications: notificationsFixture(), fetchImpl, resolveEnvironment: () => 'sandbox' });
  await aStarted;
  await clearApnsRegistrationState({ session: boundary, store: regStore,
    notifications: notificationsFixture(), fetchImpl });
  await boundary.establish('bearer-b', async () => ({ userId: 'user-b' }));
  const b = await registerApnsDeviceToken({ session: boundary, store: regStore, platform: 'ios',
    notifications: notificationsFixture(), fetchImpl, resolveEnvironment: () => 'sandbox' });
  assert.equal(b.status, 'ready');
  resolveA(new Response(JSON.stringify({
    registrationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    environment: 'sandbox', registeredAt: '2026-10-24T00:00:00.000Z',
  }), { status: 200 }));
  assert.equal((await a).status, 'cancelled');
  assert.equal(regStore.peek()?.userId, 'user-b');
  await clearApnsRegistrationState({ session: boundary, store: regStore,
    notifications: notificationsFixture(), fetchImpl });
  assert.deepEqual(deletes.map((url) => url.split('/').at(-1)), [
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  ]);
});

test('APNs compare-and-clear is atomic with a B write', async () => {
  const regStore = createMemoryApnsRegistrationStore({ userId: 'A', registrationId: 'A-id', environment: 'sandbox' });
  const old = await regStore.read();
  await regStore.write({ userId: 'B', registrationId: 'B-id', environment: 'sandbox' });
  await regStore.clearIfMatches(old!);
  assert.equal(regStore.peek()?.registrationId, 'B-id');
});

for (const status of [401, 503]) {
  test(`APNs logout DELETE ${status} retains pending ID until confirmed retry`, async () => {
    __resetApnsRegistrationGenerationForTests();
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test';
    const boundary = new SessionBoundary(credentialStore('A-token'));
    await boundary.establish('A-token', async () => ({ userId: 'A' }));
    const regStore = createMemoryApnsRegistrationStore({
      userId: 'A', registrationId: 'A-id', environment: 'sandbox',
    });
    await assert.rejects(clearApnsRegistrationState({
      session: boundary, store: regStore, notifications: notificationsFixture(),
      fetchImpl: mockFetch(async () => new Response(null, { status })),
    }), /Chưa xác nhận gỡ đăng ký thông báo/);
    assert.equal(regStore.peek(), null);
    assert.equal((await regStore.pendingFor('A'))[0]?.registrationId, 'A-id');
    await clearApnsRegistrationState({
      session: boundary, store: regStore, notifications: notificationsFixture(),
      fetchImpl: mockFetch(async () => new Response(null, { status: 204 })),
    });
    assert.deepEqual(await regStore.pendingFor('A'), []);
  });
}

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

test('getDevicePushToken failure fails closed without POST (no permission gate)', async () => {
  __resetApnsRegistrationGenerationForTests();
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test';
  const store = credentialStore('tok');
  const boundary = new SessionBoundary(store);
  await boundary.establish('tok', async () => ({ userId: 'user-a' }));
  let posts = 0;
  const unavailable = await registerApnsDeviceToken({
    session: boundary,
    platform: 'ios',
    store: createMemoryApnsRegistrationStore(),
    notifications: notificationsFixture({
      getDevicePushTokenAsync: async () => {
        throw new Error('native token failed');
      },
    }),
    fetchImpl: mockFetch(async () => {
      posts += 1;
      return new Response('{}', { status: 500 });
    }),
  });
  assert.equal(unavailable.status, 'unavailable');
  assert.equal(posts, 0);
});

