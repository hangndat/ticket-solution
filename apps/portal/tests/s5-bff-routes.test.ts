import assert from 'node:assert/strict';
import { before, describe, it, mock } from 'node:test';
import { CSRF_COOKIE, CSRF_HEADER } from '../src/bff/csrf-constants';

const CSRF = 'tokentokentokentokentokentokentoken12';
const ORIGIN = 'http://127.0.0.1:3013';
const TENANT = '11111111-1111-4111-8111-111111111111';
const MEMBER = '33333333-3333-4333-8333-333333333333';
const EVENT = '22222222-2222-4222-8222-222222222222';

function mutateRequest(path: string, body: unknown) {
  return new Request(`${ORIGIN}${path}`, {
    method: 'PUT',
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

describe('S5 tenant limits and event-assignment BFF', () => {
  const forwarded: { path: string; init: RequestInit }[] = [];
  let GET_limits: (
    request: Request,
    context: { params: Promise<{ tenantId: string }> },
  ) => Promise<Response>;
  let PUT_assign: (
    request: Request,
    context: {
      params: Promise<{ tenantId: string; membershipId: string; eventId: string }>;
    },
  ) => Promise<Response>;

  before(async () => {
    mock.module('next/headers', {
      namedExports: {
        cookies: async () => ({
          get: (name: string) =>
            name === CSRF_COOKIE ? { value: CSRF } : undefined,
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
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        },
      },
    });
    process.env.WEB_PUBLIC_ORIGIN = ORIGIN;
    GET_limits = (
      await import('../app/api/bff/tenants/[tenantId]/limits/route.ts')
    ).GET;
    PUT_assign = (
      await import(
        '../app/api/bff/tenants/[tenantId]/members/[membershipId]/event-assignments/[eventId]/route.ts'
      )
    ).PUT;
  });

  it('GET limits forwards with no query string', async () => {
    forwarded.length = 0;
    const res = await GET_limits(
      new Request(`${ORIGIN}/api/bff/tenants/${TENANT}/limits?foo=1`),
      { params: Promise.resolve({ tenantId: TENANT }) },
    );
    assert.equal(res.status, 200);
    assert.equal(forwarded.length, 1);
    assert.equal(forwarded[0].path, `/v1/tenants/${TENANT}/limits`);
    assert.equal(forwarded[0].init.method, 'GET');
  });

  it('PUT assignment rejects Owner and permission arrays', async () => {
    const ctx = {
      params: Promise.resolve({
        tenantId: TENANT,
        membershipId: MEMBER,
        eventId: EVENT,
      }),
    };
    const owner = await PUT_assign(
      mutateRequest(
        `/api/bff/tenants/${TENANT}/members/${MEMBER}/event-assignments/${EVENT}`,
        { role: 'Owner', reason: 'assign' },
      ),
      ctx,
    );
    assert.equal(owner.status, 422);
    const perms = await PUT_assign(
      mutateRequest(
        `/api/bff/tenants/${TENANT}/members/${MEMBER}/event-assignments/${EVENT}`,
        { role: 'Manager', reason: 'assign', permissions: ['x'] },
      ),
      ctx,
    );
    assert.equal(perms.status, 422);
  });

  it('PUT assignment proxies Manager with reason', async () => {
    forwarded.length = 0;
    const res = await PUT_assign(
      mutateRequest(
        `/api/bff/tenants/${TENANT}/members/${MEMBER}/event-assignments/${EVENT}`,
        { role: 'Manager', reason: 'assign for sample event' },
      ),
      {
        params: Promise.resolve({
          tenantId: TENANT,
          membershipId: MEMBER,
          eventId: EVENT,
        }),
      },
    );
    assert.equal(res.status, 200);
    assert.equal(forwarded.length, 1);
    assert.match(forwarded[0].path, /event-assignments/);
    assert.equal(forwarded[0].init.method, 'PUT');
  });
});
