import assert from 'node:assert/strict';
import { describe, it, mock, before } from 'node:test';
import { CSRF_COOKIE, CSRF_HEADER } from '../src/bff/csrf-constants';

const CSRF = 'tokentokentokentokentokentokentoken12';
const ORIGIN = 'http://127.0.0.1:3013';

function mutateRequest(
  path: string,
  body: unknown,
  opts: { csrf?: boolean; method?: string } = {},
) {
  const headers: Record<string, string> = {
    Origin: ORIGIN,
    'Content-Type': 'application/json',
    'Sec-Fetch-Site': 'same-origin',
  };
  if (opts.csrf) {
    headers[CSRF_HEADER] = CSRF;
    headers.Cookie = `${CSRF_COOKIE}=${CSRF}`;
  }
  return new Request(`${ORIGIN}${path}`, {
    method: opts.method ?? 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('platform mutate BFF routes', () => {
  let forwardCalls: { path: string; init: RequestInit }[] = [];
  let POST_tenants: (req: Request) => Promise<Response>;
  let POST_status: (req: Request, ctx: { params: Promise<{ tenantId: string }> }) => Promise<Response>;
  let PUT_limits: (req: Request, ctx: { params: Promise<{ tenantId: string }> }) => Promise<Response>;
  let POST_grants: (req: Request) => Promise<Response>;

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

    const apiError = await import('../src/bff/api-error.ts');
    mock.module('../src/bff/upstream.ts', {
      namedExports: {
        forwardPlatformBearer: async (path: string, init: RequestInit = {}) => {
          forwardCalls.push({ path, init });
          return new Response(JSON.stringify({ ok: true }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          });
        },
        bffApiError: apiError.bffApiError,
      },
    });

    process.env.WEB_PUBLIC_ORIGIN = ORIGIN;
    forwardCalls = [];
    const tenants = await import('../app/api/bff/platform/tenants/route.ts');
    const status = await import(
      '../app/api/bff/platform/tenants/[tenantId]/status/route.ts'
    );
    const limits = await import(
      '../app/api/bff/platform/tenants/[tenantId]/limits/route.ts'
    );
    const grants = await import('../app/api/bff/platform/support-grants/route.ts');
    POST_tenants = tenants.POST;
    POST_status = status.POST;
    PUT_limits = limits.PUT;
    POST_grants = grants.POST;
  });

  it('POST tenants rejects missing CSRF', async () => {
    const res = await POST_tenants(
      mutateRequest('/api/bff/platform/tenants', {}),
    );
    assert.equal(res.status, 403);
  });

  it('POST tenants returns 422 on invalid body', async () => {
    const res = await POST_tenants(
      mutateRequest('/api/bff/platform/tenants', { idempotencyKey: 'x' }, {
        csrf: true,
      }),
    );
    assert.equal(res.status, 422);
  });

  it('POST tenants proxies valid body upstream', async () => {
    forwardCalls = [];
    const id = '11111111-1111-4111-8111-111111111111';
    const res = await POST_tenants(
      mutateRequest(
        '/api/bff/platform/tenants',
        {
          slug: 'uat',
          name: 'UAT',
          defaultTimezone: 'Asia/Ho_Chi_Minh',
          ownerEmail: 'o@example.com',
          limits: {
            maxEvents: null,
            maxStaff: null,
            emailPerDay: null,
            importRowsPerJob: null,
          },
          flags: { importsEnabled: true, exportsEnabled: true },
          idempotencyKey: id,
        },
        { csrf: true },
      ),
    );
    assert.equal(res.status, 201);
    assert.equal(forwardCalls.length, 1);
    assert.match(forwardCalls[0].path, /platform\/tenants/);
  });

  it('POST status returns 422 without CSRF still 403', async () => {
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const res = await POST_status(
      mutateRequest(`/api/bff/platform/tenants/${tenantId}/status`, {}),
      { params: Promise.resolve({ tenantId }) },
    );
    assert.equal(res.status, 403);
  });

  it('POST status proxies when valid', async () => {
    forwardCalls = [];
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const res = await POST_status(
      mutateRequest(
        `/api/bff/platform/tenants/${tenantId}/status`,
        {
          status: 'SUSPENDED',
          reason: 'ops',
          expectedVersion: 1,
          idempotencyKey: '22222222-2222-4222-8222-222222222222',
        },
        { csrf: true },
      ),
      { params: Promise.resolve({ tenantId }) },
    );
    assert.equal(res.status, 201);
    assert.equal(forwardCalls.length, 1);
  });

  it('PUT limits returns 422 on bad version', async () => {
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const res = await PUT_limits(
      mutateRequest(
        `/api/bff/platform/tenants/${tenantId}/limits`,
        {
          limits: {
            maxEvents: null,
            maxStaff: null,
            emailPerDay: null,
            importRowsPerJob: null,
          },
          flags: { importsEnabled: true, exportsEnabled: true },
          reason: 'ops',
          expectedVersion: 'nope' as unknown as number,
          idempotencyKey: '22222222-2222-4222-8222-222222222222',
        },
        { csrf: true, method: 'PUT' },
      ),
      { params: Promise.resolve({ tenantId }) },
    );
    assert.equal(res.status, 422);
  });

  it('POST support-grants proxies when valid', async () => {
    forwardCalls = [];
    const res = await POST_grants(
      mutateRequest(
        '/api/bff/platform/support-grants',
        {
          tenantId: '11111111-1111-4111-8111-111111111111',
          eventId: '22222222-2222-4222-8222-222222222222',
          scopes: ['cs.read'],
          reason: 'uat',
          expiresAt: '2030-01-01T00:00:00.000Z',
          idempotencyKey: '33333333-3333-4333-8333-333333333333',
        },
        { csrf: true },
      ),
    );
    assert.equal(res.status, 201);
    assert.equal(forwardCalls.length, 1);
  });
});
