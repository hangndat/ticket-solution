import assert from 'node:assert/strict';
import { before, describe, it, mock } from 'node:test';

const TENANT = '11111111-1111-4111-8111-111111111111';
const EVENT = '22222222-2222-4222-8222-222222222222';
const INVITATION = '44444444-4444-4444-8444-444444444444';

describe('Guest invitations BFF GET', () => {
  const forwarded: { path: string; init: RequestInit }[] = [];
  let GET: (
    request: Request,
    context: { params: Promise<{ tenantId: string; eventId: string }> },
  ) => Promise<Response>;
  const context = {
    params: Promise.resolve({ tenantId: TENANT, eventId: EVENT }),
  };

  before(async () => {
    const { bffApiError } = await import('../src/bff/api-error.ts');
    mock.module('../src/bff/upstream.ts', {
      namedExports: {
        bffApiError,
        forwardStaffBearer: async (path: string, init: RequestInit) => {
          forwarded.push({ path, init });
          return new Response(JSON.stringify({ items: [], nextCursor: null }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        },
      },
    });
    GET = (
      await import(
        '../app/api/bff/tenants/[tenantId]/events/[eventId]/invitations/route.ts'
      )
    ).GET;
  });

  it('forwards exact invitation q with state (G-08 contract)', async () => {
    forwarded.length = 0;
    const url = `http://127.0.0.1:3013/api/bff/tenants/${TENANT}/events/${EVENT}/invitations?limit=20&state=PENDING&q=${INVITATION}`;
    const response = await GET(new Request(url), context);
    assert.equal(response.status, 200);
    assert.equal(forwarded.length, 1);
    assert.equal(forwarded[0].init.method, 'GET');
    const upstream = forwarded[0].path;
    assert.match(upstream, /invitations\?/);
    assert.match(upstream, /limit=20/);
    assert.match(upstream, /state=PENDING/);
    assert.match(upstream, new RegExp(`q=${INVITATION}`));
    assert.doesNotMatch(upstream, /cursor=/);
  });

  it('forwards cursor for paginated list without q', async () => {
    forwarded.length = 0;
    const url = `http://127.0.0.1:3013/api/bff/tenants/${TENANT}/events/${EVENT}/invitations?limit=20&cursor=opaque`;
    const response = await GET(new Request(url), context);
    assert.equal(response.status, 200);
    assert.match(forwarded[0].path, /cursor=opaque/);
    assert.doesNotMatch(forwarded[0].path, /[?&]q=/);
  });
});
