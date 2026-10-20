import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';
import { assertSameOrigin } from '../src/bff/origin';
import {
  resolvePublicOrigin,
  webPublicOriginAllowlist,
} from '../src/oidc/public-origin';

function mutRequest(
  url: string,
  headers: Record<string, string> = {},
  method = 'POST',
): Request {
  return new Request(url, { method, headers });
}

async function errorCode(response: Response | null): Promise<string | null> {
  if (!response) return null;
  const body = (await response.json()) as { code?: string };
  return body.code ?? null;
}

const originalWebPublicOrigin = process.env.WEB_PUBLIC_ORIGIN;
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalWebPublicOrigin === undefined) {
    delete process.env.WEB_PUBLIC_ORIGIN;
  } else {
    process.env.WEB_PUBLIC_ORIGIN = originalWebPublicOrigin;
  }
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

describe('assertSameOrigin CSRF/Origin', () => {
  it('allows safe methods without Origin', () => {
    delete process.env.WEB_PUBLIC_ORIGIN;
    const req = new Request('http://localhost:3000/api/bff/admin/events', {
      method: 'GET',
    });
    assert.equal(assertSameOrigin(req), null);
  });

  it('fail-closed: missing Origin on mutation is 403', async () => {
    delete process.env.WEB_PUBLIC_ORIGIN;
    const blocked = assertSameOrigin(
      mutRequest('http://localhost:3000/api/bff/admin/events'),
    );
    assert.ok(blocked);
    assert.equal(blocked!.status, 403);
    assert.equal(await errorCode(blocked), 'CSRF_ORIGIN_REQUIRED');
  });

  it('fail-closed: missing Origin still blocked even with Sec-Fetch-Site same-origin', async () => {
    delete process.env.WEB_PUBLIC_ORIGIN;
    const blocked = assertSameOrigin(
      mutRequest('http://localhost:3000/api/bff/admin/events', {
        'sec-fetch-site': 'same-origin',
      }),
    );
    assert.ok(blocked);
    assert.equal(blocked!.status, 403);
    assert.equal(await errorCode(blocked), 'CSRF_ORIGIN_REQUIRED');
  });

  it('rejects mismatched Origin', async () => {
    delete process.env.WEB_PUBLIC_ORIGIN;
    const blocked = assertSameOrigin(
      mutRequest('http://localhost:3000/api/bff/admin/events', {
        origin: 'https://evil.example',
      }),
    );
    assert.ok(blocked);
    assert.equal(blocked!.status, 403);
    assert.equal(await errorCode(blocked), 'CSRF_ORIGIN_MISMATCH');
  });

  it('allows matching Origin', () => {
    delete process.env.WEB_PUBLIC_ORIGIN;
    const ok = assertSameOrigin(
      mutRequest('http://localhost:3000/api/bff/admin/events', {
        origin: 'http://localhost:3000',
      }),
    );
    assert.equal(ok, null);
  });

  it('treats 127.0.0.1 and localhost as equivalent', () => {
    delete process.env.WEB_PUBLIC_ORIGIN;
    const ok = assertSameOrigin(
      mutRequest('http://127.0.0.1:3000/api/bff/admin/events', {
        origin: 'http://localhost:3000',
      }),
    );
    assert.equal(ok, null);
    const ok2 = assertSameOrigin(
      mutRequest('http://localhost:3000/api/bff/admin/events', {
        origin: 'http://127.0.0.1:3000',
      }),
    );
    assert.equal(ok2, null);
  });

  it('WEB_PUBLIC_ORIGIN: allows browser Origin when request.url is internal bind', () => {
    process.env.WEB_PUBLIC_ORIGIN = 'https://vemoki.com';
    const ok = assertSameOrigin(
      mutRequest('http://127.0.0.1:3000/api/bff/me/membership-invites/accept', {
        origin: 'https://vemoki.com',
      }),
    );
    assert.equal(ok, null);
  });

  it('WEB_PUBLIC_ORIGIN: rejects Origin not on allowlist even if matches request.url', async () => {
    process.env.WEB_PUBLIC_ORIGIN = 'https://vemoki.com';
    const blocked = assertSameOrigin(
      mutRequest('http://evil.example/api/bff/me/membership-invites/accept', {
        origin: 'http://evil.example',
      }),
    );
    assert.ok(blocked);
    assert.equal(blocked!.status, 403);
    assert.equal(await errorCode(blocked), 'CSRF_ORIGIN_MISMATCH');
  });

  it('production without WEB_PUBLIC_ORIGIN never trusts spoofed forwarding', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.WEB_PUBLIC_ORIGIN;
    const blocked = assertSameOrigin(
      mutRequest('http://127.0.0.1:3000/api/bff/admin/events', {
        origin: 'https://evil.test',
        'x-forwarded-host': 'evil.test',
        'x-forwarded-proto': 'https',
      }),
    );
    assert.ok(blocked);
    assert.equal(await errorCode(blocked), 'ORIGIN_NOT_CONFIGURED');
  });
});

describe('resolvePublicOrigin', () => {
  it('prefers WEB_PUBLIC_ORIGIN over X-Forwarded-* and bind URL', () => {
    process.env.WEB_PUBLIC_ORIGIN = 'https://vemoki.com';
    const req = {
      url: 'http://0.0.0.0:3000/api/auth/callback',
    };
    assert.equal(resolvePublicOrigin(req), 'https://vemoki.com');
  });

  it('does not trust X-Forwarded when WEB_PUBLIC_ORIGIN unset', () => {
    delete process.env.WEB_PUBLIC_ORIGIN;
    const req = {
      url: 'http://127.0.0.1:3000/x',
    };
    assert.equal(resolvePublicOrigin(req), 'http://127.0.0.1:3000');
  });

  it('returns null in production when WEB_PUBLIC_ORIGIN unset', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.WEB_PUBLIC_ORIGIN;
    assert.equal(
      resolvePublicOrigin({ url: 'http://127.0.0.1:3000/x' }),
      null,
    );
  });

  it('parses comma-separated WEB_PUBLIC_ORIGIN allowlist', () => {
    process.env.WEB_PUBLIC_ORIGIN =
      'https://vemoki.com, http://localhost:3000';
    assert.deepEqual(webPublicOriginAllowlist(), [
      'https://vemoki.com',
      'http://localhost:3000',
    ]);
  });
});
