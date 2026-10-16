import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchMe, verifyViaMe } from './fetch-me.ts';

test('fetchMe returns null when API base URL is missing', async () => {
  const previous = process.env.EXPO_PUBLIC_API_BASE_URL;
  delete process.env.EXPO_PUBLIC_API_BASE_URL;
  assert.equal(await fetchMe('token'), null);
  if (previous === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
  else process.env.EXPO_PUBLIC_API_BASE_URL = previous;
});

test('fetchMe returns null when bearer is empty', async () => {
  const previous = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:3001';
  assert.equal(await fetchMe(''), null);
  if (previous === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
  else process.env.EXPO_PUBLIC_API_BASE_URL = previous;
});

test('fetchMe and verifyViaMe accept only server MeResponse with userId', async () => {
  const previous = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:39999';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ email: 'a@b.c' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  try {
    assert.equal(await fetchMe('token'), null);
    assert.equal(await verifyViaMe('token'), null);
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = previous;
  }
});

test('verifyViaMe maps MeResponse.userId and rejects HTTP errors', async () => {
  const previous = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:39999';
  const originalFetch = globalThis.fetch;
  let status = 200;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        userId: 'usr_1',
        issuer: 'https://clerk.example',
        subject: 'user_abc',
        email: 'a@b.c',
        emailVerified: true,
      }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  try {
    assert.deepEqual(await verifyViaMe('token'), { userId: 'usr_1' });
    status = 401;
    assert.equal(await verifyViaMe('token'), null);
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = previous;
  }
});

test('SessionBoundary establish still requires verifyViaMe — no stub userId', async () => {
  const { SessionBoundary } = await import('./session-boundary.ts');
  let credential: string | null = null;
  const boundary = new SessionBoundary({
    read: async () => credential,
    write: async (next) => {
      credential = next;
    },
    clear: async () => {
      credential = null;
    },
  });
  await boundary.establish('raw-jwt', async () => null);
  assert.equal(boundary.getSnapshot().status, 'signed-out');
  assert.equal(credential, null);
});
