import assert from 'node:assert/strict';
import { before, describe, it, mock } from 'node:test';
import { CSRF_COOKIE, CSRF_HEADER } from '../src/bff/csrf-constants';

const origin = 'http://127.0.0.1:3013';
const token = 'tokentokentokentokentokentokentoken12';
const tenantId = '11111111-1111-4111-8111-111111111111';
const eventId = '22222222-2222-4222-8222-222222222222';
const payload = {
  schemaVersion: 1,
  brand: { organizationName: 'Example', primaryColor: '#123456' },
  sections: [],
};

describe('config save BFF route', () => {
  let calls: { path: string; init: RequestInit }[] = [];
  let upstreamStatus = 201;
  let POST: (
    request: Request,
    context: { params: Promise<{ tenantId: string; eventId: string }> },
  ) => Promise<Response>;

  before(async () => {
    mock.module('next/headers', {
      namedExports: {
        cookies: async () => ({
          get: (name: string) =>
            name === CSRF_COOKIE ? { value: token } : undefined,
          set: () => {},
        }),
      },
    });
    const { bffApiError } = await import('../src/bff/api-error.ts');
    mock.module('../src/bff/upstream.ts', {
      namedExports: {
        bffApiError,
        forwardStaffBearer: async (path: string, init: RequestInit) => {
          calls.push({ path, init });
          return new Response(
            JSON.stringify(
              upstreamStatus === 409
                ? { code: 'REVISION_CONFLICT' }
                : { version: 1 },
            ),
            {
              status: upstreamStatus,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        },
      },
    });
    process.env.WEB_PUBLIC_ORIGIN = origin;
    ({ POST } =
      await import('../app/api/bff/tenants/[tenantId]/events/[eventId]/config-versions/route.ts'));
  });

  async function save(body: unknown) {
    return POST(
      new Request(
        `${origin}/api/bff/tenants/${tenantId}/events/${eventId}/config-versions`,
        {
          method: 'POST',
          headers: {
            Origin: origin,
            'Content-Type': 'application/json',
            'Sec-Fetch-Site': 'same-origin',
            [CSRF_HEADER]: token,
            Cookie: `${CSRF_COOKIE}=${token}`,
          },
          body: JSON.stringify(body),
        },
      ),
      { params: Promise.resolve({ tenantId, eventId }) },
    );
  }

  it('requires a non-negative expectedVersion', async () => {
    for (const version of [undefined, -1, 1.5, '1']) {
      calls = [];
      const response = await save({ payload, expectedVersion: version });
      assert.equal(response.status, 422);
      assert.equal(calls.length, 0);
    }
  });

  it('forwards version zero before first save and later versions unchanged', async () => {
    for (const version of [0, 3]) {
      calls = [];
      const response = await save({ payload, expectedVersion: version });
      assert.equal(response.status, 201);
      assert.equal(calls.length, 1);
      assert.deepEqual(JSON.parse(calls[0].init.body as string), {
        payload,
        schemaVersion: 1,
        expectedVersion: version,
      });
    }
  });

  it('passes the upstream 409 REVISION_CONFLICT through', async () => {
    upstreamStatus = 409;
    const response = await save({ payload, expectedVersion: 0 });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, 'REVISION_CONFLICT');
  });
});
