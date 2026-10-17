import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CSRF_COOKIE, CSRF_HEADER } from '../src/bff/csrf-constants';
import { assertMutatingBrowser } from '../src/bff/csrf';

function mutRequest(
  headers: Record<string, string> = {},
): Request {
  return new Request('http://localhost:3000/api/bff/redeem', {
    method: 'POST',
    headers: {
      origin: 'http://localhost:3000',
      'content-type': 'application/json',
      ...headers,
    },
  });
}

async function errorCode(response: Response | null): Promise<string | null> {
  if (!response) return null;
  const body = (await response.json()) as { code?: string };
  return body.code ?? null;
}

describe('redeem BFF CSRF guard', () => {
  it('rejects missing CSRF double-submit', async () => {
    const blocked = assertMutatingBrowser(mutRequest());
    assert.ok(blocked);
    assert.equal(blocked!.status, 403);
    assert.equal(await errorCode(blocked), 'CSRF_TOKEN_INVALID');
  });

  it('rejects mismatched CSRF header vs cookie', async () => {
    const blocked = assertMutatingBrowser(
      mutRequest({
        [CSRF_HEADER]: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        cookie: `${CSRF_COOKIE}=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb`,
      }),
    );
    assert.ok(blocked);
    assert.equal(await errorCode(blocked), 'CSRF_TOKEN_INVALID');
  });

  it('allows matching CSRF + Origin + JSON', () => {
    const token = 'cccccccccccccccccccccccccccccccc';
    const ok = assertMutatingBrowser(
      mutRequest({
        [CSRF_HEADER]: token,
        cookie: `${CSRF_COOKIE}=${token}`,
      }),
    );
    assert.equal(ok, null);
  });

  it('rejects non-JSON content type', async () => {
    const blocked = assertMutatingBrowser(
      new Request('http://localhost:3000/api/bff/redeem', {
        method: 'POST',
        headers: {
          origin: 'http://localhost:3000',
          'content-type': 'text/plain',
          [CSRF_HEADER]: 'dddddddddddddddddddddddddddddddd',
          cookie: `${CSRF_COOKIE}=dddddddddddddddddddddddddddddddd`,
        },
      }),
    );
    assert.ok(blocked);
    assert.equal(blocked!.status, 415);
  });
});
