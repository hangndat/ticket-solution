import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { NextRequest } from 'next/server';
import { SESSION_COOKIES } from '@ticket/web-session';

test('staff login redirect is private and preserves the safe return path', async () => {
  const values = new Map<string, string>();
  mock.module('next/headers', {
    namedExports: {
      cookies: async () => ({
        set: (name: string, value: string) => {
          values.set(name, value);
        },
        delete: (name: string) => {
          values.delete(name);
        },
      }),
    },
  });

  const env = {
    OIDC_ISSUER: 'https://auth.example.test/realms/ticket',
    OIDC_CLIENT_ID: 'ticket-admin-web',
    OIDC_CLIENT_SECRET: 'test-only-secret',
    OIDC_REDIRECT_URI: 'https://portal.example.test/api/auth/callback',
    OIDC_AUDIENCE: 'ticket-api',
    OIDC_JWKS_URL:
      'https://auth.example.test/realms/ticket/protocol/openid-connect/certs',
  };
  const previous = Object.fromEntries(
    Object.keys(env).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, env);

  try {
    const { GET } = await import('../app/api/auth/login/route.ts');
    const response = await GET(
      new NextRequest(
        'https://portal.example.test/api/auth/login?return=%2Fadmin',
      ),
    );
    assert.equal(response.status, 307);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    const location = new URL(response.headers.get('Location')!);
    assert.equal(location.origin, 'https://auth.example.test');
    assert.equal(
      location.searchParams.get('redirect_uri'),
      env.OIDC_REDIRECT_URI,
    );
    assert.equal(values.get(SESSION_COOKIES.returnPath), '/admin');
    assert.ok(values.get(SESSION_COOKIES.pkce));
    assert.ok(values.get(SESSION_COOKIES.state));

    const unsafe = await GET(
      new NextRequest(
        'https://portal.example.test/api/auth/login?return=https%3A%2F%2Fevil.example%2Fadmin',
      ),
    );
    assert.equal(unsafe.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(values.has(SESSION_COOKIES.returnPath), false);
    assert.equal(
      new URL(unsafe.headers.get('Location')!).origin,
      location.origin,
    );
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    mock.reset();
  }
});
