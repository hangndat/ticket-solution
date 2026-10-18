import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CSRF_COOKIE, CSRF_HEADER } from '../src/bff/csrf-constants';
import { assertMutatingBrowser } from '../src/bff/csrf';

function acceptRequest(headers: Record<string, string> = {}): Request {
  return new Request(
    'http://localhost:3000/api/bff/me/membership-invites/accept',
    {
      method: 'POST',
      headers: {
        origin: 'http://localhost:3000',
        'content-type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({
        token: 'fixture-token-not-logged',
        idempotencyKey: '11111111-1111-4111-8111-111111111111',
      }),
    },
  );
}

async function errorCode(response: Response | null): Promise<string | null> {
  if (!response) return null;
  const body = (await response.json()) as { code?: string };
  return body.code ?? null;
}

describe('invite accept BFF CSRF guard', () => {
  it('rejects missing Origin fail-closed', async () => {
    const blocked = assertMutatingBrowser(
      new Request(
        'http://localhost:3000/api/bff/me/membership-invites/accept',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        },
      ),
    );
    assert.ok(blocked);
    assert.equal(blocked!.status, 403);
    assert.equal(await errorCode(blocked), 'CSRF_ORIGIN_REQUIRED');
  });

  it('rejects mismatched Origin', async () => {
    const blocked = assertMutatingBrowser(
      acceptRequest({ origin: 'https://evil.example' }),
    );
    assert.ok(blocked);
    assert.equal(await errorCode(blocked), 'CSRF_ORIGIN_MISMATCH');
  });

  it('rejects missing CSRF double-submit', async () => {
    const blocked = assertMutatingBrowser(acceptRequest());
    assert.ok(blocked);
    assert.equal(blocked!.status, 403);
    assert.equal(await errorCode(blocked), 'CSRF_TOKEN_INVALID');
  });

  it('rejects mismatched CSRF header vs cookie', async () => {
    const blocked = assertMutatingBrowser(
      acceptRequest({
        [CSRF_HEADER]: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        cookie: `${CSRF_COOKIE}=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb`,
      }),
    );
    assert.ok(blocked);
    assert.equal(await errorCode(blocked), 'CSRF_TOKEN_INVALID');
  });

  it('allows matching CSRF + Origin + JSON (auth still required upstream)', () => {
    const token = 'cccccccccccccccccccccccccccccccc';
    const ok = assertMutatingBrowser(
      acceptRequest({
        [CSRF_HEADER]: token,
        cookie: `${CSRF_COOKIE}=${token}`,
      }),
    );
    assert.equal(ok, null);
  });
});
