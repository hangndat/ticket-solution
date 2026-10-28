import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertSameOrigin } from '../src/bff/origin';

function gateConfirmRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3000/api/bff/gate/confirm', {
    method: 'POST',
    headers: {
      origin: 'http://localhost:3000',
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({
      tenantId: '11111111-1111-4111-8111-111111111111',
      eventId: '22222222-2222-4222-8222-222222222222',
      reservationId: '33333333-3333-4333-8333-333333333333',
      staffSessionId: '44444444-4444-4444-8444-444444444444',
      token: 'hold-token',
    }),
  });
}

async function errorCode(response: Response | null): Promise<string | null> {
  if (!response) return null;
  const body = (await response.json()) as { code?: string };
  return body.code ?? null;
}

describe('gate BFF Origin/CSRF guard (assertSameOrigin)', () => {
  it('rejects missing Origin fail-closed', async () => {
    const blocked = assertSameOrigin(
      new Request('http://localhost:3000/api/bff/gate/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
    );
    assert.ok(blocked);
    assert.equal(blocked!.status, 403);
    assert.equal(await errorCode(blocked), 'CSRF_ORIGIN_REQUIRED');
  });

  it('rejects mismatched Origin', async () => {
    const blocked = assertSameOrigin(
      gateConfirmRequest({ origin: 'https://evil.example' }),
    );
    assert.ok(blocked);
    assert.equal(await errorCode(blocked), 'CSRF_ORIGIN_MISMATCH');
  });

  it('allows matching Origin (auth still required upstream)', () => {
    const ok = assertSameOrigin(gateConfirmRequest());
    assert.equal(ok, null);
  });

  it('applies to sessions and reservations paths the same way', async () => {
    for (const path of [
      '/api/bff/gate/sessions',
      '/api/bff/gate/reservations',
    ]) {
      const blocked = assertSameOrigin(
        new Request(`http://localhost:3000${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        }),
      );
      assert.ok(blocked, path);
      assert.equal(await errorCode(blocked), 'CSRF_ORIGIN_REQUIRED');
    }
  });
});
