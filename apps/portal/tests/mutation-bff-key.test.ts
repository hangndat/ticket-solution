import assert from 'node:assert/strict';
import { before, describe, it, mock } from 'node:test';
import { CSRF_COOKIE, CSRF_HEADER } from '../src/bff/csrf-constants';

const ORIGIN = 'http://127.0.0.1:3013';
const TENANT = '11111111-1111-4111-8111-111111111111';
const EVENT = '22222222-2222-4222-8222-222222222222';
const RESOURCE = '33333333-3333-4333-8333-333333333333';
const KEY = '44444444-4444-4444-8444-444444444444';
const CSRF = 'tokentokentokentokentokentokentoken12';

type RouteCase = {
  name: string;
  body: Record<string, unknown>;
  expectedBody?: Record<string, unknown>;
  call: (body: unknown) => Promise<Response>;
};

function request(path: string, body: unknown): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: {
      Origin: ORIGIN,
      'Content-Type': 'application/json',
      'Sec-Fetch-Site': 'same-origin',
      [CSRF_HEADER]: CSRF,
      Cookie: `${CSRF_COOKIE}=${CSRF}`,
    },
    body: JSON.stringify(body),
  });
}

describe('contracted #929 BFF POSTs forward only the client key', () => {
  const forwarded: { path: string; init: RequestInit }[] = [];
  let cases: RouteCase[];

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
          return Response.json({ accepted: true }, { status: 202 });
        },
      },
    });
    process.env.WEB_PUBLIC_ORIGIN = ORIGIN;
    const [exports, approve, deny, resend, retry] = await Promise.all([
      import('../app/api/bff/tenants/[tenantId]/events/[eventId]/exports/route.ts'),
      import('../app/api/bff/tenants/[tenantId]/events/[eventId]/redemptions/[requestId]/approve/route.ts'),
      import('../app/api/bff/tenants/[tenantId]/events/[eventId]/redemptions/[requestId]/deny/route.ts'),
      import('../app/api/bff/tenants/[tenantId]/events/[eventId]/tickets/[ticketId]/resend/route.ts'),
      import('../app/api/bff/tenants/[tenantId]/events/[eventId]/notifications/[notificationId]/retry/route.ts'),
    ]);
    const base = `/api/bff/tenants/${TENANT}/events/${EVENT}`;
    cases = [
      {
        name: 'export', body: { format: 'csv' }, expectedBody: { format: 'csv' },
        call: (body) => exports.POST(request(`${base}/exports`, body), {
          params: Promise.resolve({ tenantId: TENANT, eventId: EVENT }),
        }),
      },
      {
        name: 'approve', body: {},
        call: (body) => approve.POST(request(`${base}/redemptions/${RESOURCE}/approve`, body), {
          params: Promise.resolve({ tenantId: TENANT, eventId: EVENT, requestId: RESOURCE }),
        }),
      },
      {
        name: 'deny', body: { reason: 'UAT' }, expectedBody: { reason: 'UAT' },
        call: (body) => deny.POST(request(`${base}/redemptions/${RESOURCE}/deny`, body), {
          params: Promise.resolve({ tenantId: TENANT, eventId: EVENT, requestId: RESOURCE }),
        }),
      },
      {
        name: 'CS resend', body: { reason: 'UAT' }, expectedBody: { reason: 'UAT' },
        call: (body) => resend.POST(request(`${base}/tickets/${RESOURCE}/resend`, body), {
          params: Promise.resolve({ tenantId: TENANT, eventId: EVENT, ticketId: RESOURCE }),
        }),
      },
      {
        name: 'notification retry', body: { reason: 'UAT' }, expectedBody: { reason: 'UAT' },
        call: (body) => retry.POST(request(`${base}/notifications/${RESOURCE}/retry`, body), {
          params: Promise.resolve({ tenantId: TENANT, eventId: EVENT, notificationId: RESOURCE }),
        }),
      },
    ];
  });

  it('rejects missing, malformed and wrong-type keys without forwarding', async () => {
    for (const route of cases) {
      for (const key of [undefined, 'bad-key', 42]) {
        forwarded.length = 0;
        const response = await route.call({ ...route.body, idempotencyKey: key });
        assert.equal(response.status, 422, `${route.name}: ${String(key)}`);
        assert.equal((await response.json()).code, 'IDEMPOTENCY_KEY_REQUIRED');
        assert.equal(forwarded.length, 0, route.name);
      }
    }
  });

  it('forwards the exact client key as a header and strips it from the payload', async () => {
    for (const route of cases) {
      forwarded.length = 0;
      const response = await route.call({ ...route.body, idempotencyKey: KEY });
      assert.equal(response.status, 202, route.name);
      assert.equal(forwarded.length, 1, route.name);
      assert.equal(new Headers(forwarded[0].init.headers).get('Idempotency-Key'), KEY);
      if (route.expectedBody) {
        assert.deepEqual(JSON.parse(forwarded[0].init.body as string), route.expectedBody);
      } else {
        assert.equal(forwarded[0].init.body, undefined);
      }
    }
  });
});
