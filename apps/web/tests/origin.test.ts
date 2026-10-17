import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertSameOrigin } from '../src/bff/origin';

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

describe('assertSameOrigin CSRF/Origin', () => {
  it('allows safe methods without Origin', () => {
    const req = new Request('http://localhost:3000/api/bff/admin/events', {
      method: 'GET',
    });
    assert.equal(assertSameOrigin(req), null);
  });

  it('fail-closed: missing Origin on mutation is 403', async () => {
    const blocked = assertSameOrigin(
      mutRequest('http://localhost:3000/api/bff/admin/events'),
    );
    assert.ok(blocked);
    assert.equal(blocked!.status, 403);
    assert.equal(await errorCode(blocked), 'CSRF_ORIGIN_REQUIRED');
  });

  it('fail-closed: missing Origin still blocked even with Sec-Fetch-Site same-origin', async () => {
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
    const ok = assertSameOrigin(
      mutRequest('http://localhost:3000/api/bff/admin/events', {
        origin: 'http://localhost:3000',
      }),
    );
    assert.equal(ok, null);
  });

  it('treats 127.0.0.1 and localhost as equivalent', () => {
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
});
