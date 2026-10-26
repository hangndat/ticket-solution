import assert from 'node:assert/strict';
import { before, describe, it, mock } from 'node:test';
import { CSRF_COOKIE, CSRF_HEADER } from '../src/bff/csrf-constants';

const ORIGIN = 'http://127.0.0.1:3013';
const TENANT = '11111111-1111-4111-8111-111111111111';
const EVENT = '22222222-2222-4222-8222-222222222222';
const KEY = '33333333-3333-4333-8333-333333333333';
const CSRF = 'tokentokentokentokentokentokentoken12';

function request(body: unknown, csrf = true) {
  return new Request(`${ORIGIN}/api/bff/tenants/${TENANT}/events/${EVENT}`, {
    method: 'PATCH',
    headers: {
      Origin: ORIGIN,
      'Content-Type': 'application/json',
      'Sec-Fetch-Site': 'same-origin',
      ...(csrf ? { [CSRF_HEADER]: CSRF, Cookie: `${CSRF_COOKIE}=${CSRF}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('Setup metadata BFF PATCH', () => {
  const forwarded: { path: string; init: RequestInit }[] = [];
  let PATCH: (
    request: Request,
    context: { params: Promise<{ tenantId: string; eventId: string }> },
  ) => Promise<Response>;
  const context = { params: Promise.resolve({ tenantId: TENANT, eventId: EVENT }) };

  before(async () => {
    mock.module('next/headers', {
      namedExports: {
        cookies: async () => ({
          get: (name: string) => name === CSRF_COOKIE ? { value: CSRF } : undefined,
          set: () => {},
        }),
      },
    });
    const { bffApiError } = await import('../src/bff/api-error.ts');
    mock.module('../src/bff/upstream.ts', {
      namedExports: {
        bffApiError,
        forwardStaffBearer: async (path: string, init: RequestInit) => {
          forwarded.push({ path, init });
          return new Response(JSON.stringify({ revision: 3 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        },
      },
    });
    process.env.WEB_PUBLIC_ORIGIN = ORIGIN;
    PATCH = (await import('../app/api/bff/tenants/[tenantId]/events/[eventId]/route.ts')).PATCH;
  });

  it('blocks missing CSRF before forwarding', async () => {
    forwarded.length = 0;
    assert.equal((await PATCH(request({ expectedRevision: 2, name: 'Saved', idempotencyKey: KEY }, false), context)).status, 403);
    assert.equal(forwarded.length, 0);
  });

  it('requires a UUID key and scoped UUIDs', async () => {
    forwarded.length = 0;
    const body = { expectedRevision: 2, name: 'Saved' };
    assert.equal((await PATCH(request(body), context)).status, 422);
    assert.equal((await PATCH(request({ ...body, idempotencyKey: 'bad' }), context)).status, 422);
    assert.equal((await PATCH(request({ ...body, idempotencyKey: KEY }), { params: Promise.resolve({ tenantId: 'bad', eventId: EVENT }) })).status, 422);
    assert.equal(forwarded.length, 0);
  });

  it('forwards key only as header with the original scoped payload', async () => {
    forwarded.length = 0;
    const response = await PATCH(request({ expectedRevision: 2, name: 'Saved', idempotencyKey: KEY }), context);
    assert.equal(response.status, 200);
    assert.equal(forwarded.length, 1);
    assert.match(forwarded[0].path, new RegExp(`tenants/${TENANT}/events/${EVENT}$`));
    assert.equal(forwarded[0].init.method, 'PATCH');
    assert.equal(new Headers(forwarded[0].init.headers).get('Idempotency-Key'), KEY);
    assert.deepEqual(JSON.parse(forwarded[0].init.body as string), { expectedRevision: 2, name: 'Saved' });
  });
});
