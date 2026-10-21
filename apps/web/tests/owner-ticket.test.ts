import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isOwnerTicketPath,
  matchOwnerTicketPath,
  parseMeTicketsResponse,
  parseOwnerTicketDetail,
  resolveOwnerTenantId,
  loadOwnerTicket,
  loadOwnerWallet,
} from '../src/owner-ticket';
import { sanitizePostLoginPath } from '../src/oidc/post-login';

const SAMPLE_ID = '97f77680-4d65-4b6d-baf3-b3f699a006a6';
const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const SAMPLE_PATH = `/t/uat-device/tickets/${SAMPLE_ID}`;

const BASE_TICKET = {
  ticketId: SAMPLE_ID,
  tenantId: TENANT_ID,
  eventId: '22222222-2222-4222-8222-222222222222',
  ticketTypeId: '33333333-3333-4333-8333-333333333333',
  sourceId: '44444444-4444-4444-8444-444444444444',
  state: 'ACTIVE',
  credentialVersion: 1,
  createdAt: '2026-10-18T00:00:00.000Z',
};

const ME_TENANTS_OK = {
  items: [
    {
      tenantId: TENANT_ID,
      slug: 'uat-device',
      name: 'UAT',
      status: 'ACTIVE',
      role: 'Owner',
      tenantPermissions: [],
    },
  ],
};

describe('owner ticket path', () => {
  it('matches buildOwnerTicketLink shape', () => {
    assert.equal(isOwnerTicketPath(SAMPLE_PATH), true);
    assert.deepEqual(matchOwnerTicketPath(SAMPLE_PATH), {
      tenantSlug: 'uat-device',
      ticketId: SAMPLE_ID,
    });
    assert.equal(isOwnerTicketPath('/t/uat-device/events/x'), false);
    assert.equal(isOwnerTicketPath('/t/Bad_Slug/tickets/' + SAMPLE_ID), false);
  });

  it('is allowlisted for post-login return', () => {
    assert.equal(sanitizePostLoginPath(SAMPLE_PATH), SAMPLE_PATH);
    assert.equal(sanitizePostLoginPath(`${SAMPLE_PATH}?x=1`), SAMPLE_PATH);
    assert.equal(sanitizePostLoginPath('/t/evil/events/x'), null);
    assert.equal(
      sanitizePostLoginPath('https://evil.example' + SAMPLE_PATH),
      null,
    );
  });
});

describe('parseMeTicketsResponse', () => {
  it('parses tickets array fail-closed', () => {
    const ok = parseMeTicketsResponse({
      tickets: [{ ...BASE_TICKET, eventName: 'Demo Night' }],
    });
    assert.ok(ok);
    assert.equal(ok!.length, 1);
    assert.equal(ok![0]!.eventName, 'Demo Night');
    assert.equal(parseMeTicketsResponse({ tickets: [{}] }), null);
    assert.equal(parseMeTicketsResponse(null), null);
  });
});

describe('parseOwnerTicketDetail', () => {
  it('accepts TicketSummary shape', () => {
    const parsed = parseOwnerTicketDetail(BASE_TICKET);
    assert.ok(parsed);
    assert.equal(parsed!.state, 'ACTIVE');
    assert.equal(parsed!.tenantId, TENANT_ID);
  });

  it('rejects incomplete bodies', () => {
    assert.equal(parseOwnerTicketDetail({ ticketId: SAMPLE_ID }), null);
    assert.equal(parseOwnerTicketDetail(null), null);
  });
});

describe('resolveOwnerTenantId', () => {
  it('prefers explicit tenantId query', () => {
    assert.deepEqual(
      resolveOwnerTenantId({
        tenantSlug: 'uat-device',
        explicitTenantId: TENANT_ID,
        meTenantsStatus: 401,
        meTenantsBody: null,
      }),
      { status: 'ok', tenantId: TENANT_ID, source: 'query' },
    );
  });

  it('matches slug on me/tenants', () => {
    assert.deepEqual(
      resolveOwnerTenantId({
        tenantSlug: 'uat-device',
        meTenantsStatus: 200,
        meTenantsBody: ME_TENANTS_OK,
      }),
      { status: 'ok', tenantId: TENANT_ID, source: 'me-tenants' },
    );
  });

  it('fails closed when slug missing from membership', () => {
    assert.equal(
      resolveOwnerTenantId({
        tenantSlug: 'uat-device',
        meTenantsStatus: 200,
        meTenantsBody: { items: [] },
      }).status,
      'unresolved',
    );
  });
});

describe('loadOwnerTicket', () => {
  it('returns invalid for bad slug/id without calling fetch', async () => {
    let called = false;
    const result = await loadOwnerTicket({
      tenantSlug: 'Bad_Slug',
      ticketId: SAMPLE_ID,
      accessToken: 'tok',
      fetchImpl: async () => {
        called = true;
        return new Response('{}');
      },
    });
    assert.equal(result.status, 'invalid');
    assert.equal(called, false);
  });

  it('returns unauthenticated when no token', async () => {
    const result = await loadOwnerTicket({
      tenantSlug: 'uat-device',
      ticketId: SAMPLE_ID,
      accessToken: null,
      fetchImpl: async () => {
        throw new Error('should not fetch');
      },
    });
    assert.equal(result.status, 'unauthenticated');
  });

  it('resolves slug via me/tenants then GET by id with tenantId', async () => {
    const calls: string[] = [];
    const ok = await loadOwnerTicket({
      tenantSlug: 'uat-device',
      ticketId: SAMPLE_ID,
      accessToken: 'tok',
      env: { API_BASE_URL: 'http://api.test' } as unknown as NodeJS.ProcessEnv,
      fetchImpl: async (input) => {
        const url = String(input);
        calls.push(url);
        if (url.endsWith('/v1/me/tenants')) {
          return new Response(JSON.stringify(ME_TENANTS_OK), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        assert.ok(url.includes(`/v1/me/tickets/${SAMPLE_ID}`));
        assert.ok(url.includes(`tenantId=${TENANT_ID}`));
        assert.ok(!url.includes('tenantSlug='));
        return new Response(JSON.stringify(BASE_TICKET), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });
    assert.equal(ok.status, 'ok');
    if (ok.status === 'ok') {
      assert.equal(ok.ticket.ticketId, SAMPLE_ID);
    }
    assert.equal(calls.length, 2);
  });

  it('uses explicit tenantId without me/tenants', async () => {
    const otherTenant = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    let tenantsCalled = false;
    const result = await loadOwnerTicket({
      tenantSlug: 'uat-device',
      ticketId: SAMPLE_ID,
      explicitTenantId: otherTenant,
      accessToken: 'tok',
      env: { API_BASE_URL: 'http://api.test' } as unknown as NodeJS.ProcessEnv,
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.endsWith('/v1/me/tenants')) {
          tenantsCalled = true;
          throw new Error('must not call me/tenants when tenantId query set');
        }
        assert.ok(url.includes(`tenantId=${otherTenant}`));
        return new Response(
          JSON.stringify({ ...BASE_TICKET, tenantId: otherTenant }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    });
    assert.equal(result.status, 'ok');
    assert.equal(tenantsCalled, false);
  });

  it('maps Nest 404 and tenant-unresolved', async () => {
    const notFound = await loadOwnerTicket({
      tenantSlug: 'uat-device',
      ticketId: SAMPLE_ID,
      accessToken: 'tok',
      env: { API_BASE_URL: 'http://api.test' } as unknown as NodeJS.ProcessEnv,
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.endsWith('/v1/me/tenants')) {
          return new Response(JSON.stringify(ME_TENANTS_OK), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('{}', { status: 404 });
      },
    });
    assert.equal(notFound.status, 'not-found');

    const unresolved = await loadOwnerTicket({
      tenantSlug: 'uat-device',
      ticketId: SAMPLE_ID,
      accessToken: 'tok',
      env: { API_BASE_URL: 'http://api.test' } as unknown as NodeJS.ProcessEnv,
      fetchImpl: async (input) => {
        if (String(input).endsWith('/v1/me/tenants')) {
          return new Response(JSON.stringify({ items: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        throw new Error('must not call tickets when unresolved');
      },
    });
    assert.equal(unresolved.status, 'tenant-unresolved');
  });
});

describe('loadOwnerWallet', () => {
  it('returns unauthenticated without token', async () => {
    const result = await loadOwnerWallet({
      accessToken: null,
      fetchImpl: async () => {
        throw new Error('should not fetch');
      },
    });
    assert.equal(result.status, 'unauthenticated');
  });

  it('loads aggregate tickets and tenant slugs', async () => {
    const calls: string[] = [];
    const result = await loadOwnerWallet({
      accessToken: 'token',
      env: { API_BASE_URL: 'http://api.test' } as unknown as NodeJS.ProcessEnv,
      fetchImpl: async (input) => {
        const url = String(input);
        calls.push(url);
        if (url.endsWith('/v1/me/tenants')) {
          return new Response(JSON.stringify(ME_TENANTS_OK), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        assert.ok(url.endsWith('/v1/me/tickets'));
        assert.ok(!url.includes('tenantId='));
        return new Response(
          JSON.stringify({
            tickets: [{ ...BASE_TICKET, eventName: 'UAT Event' }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    });
    assert.equal(result.status, 'ok');
    if (result.status === 'ok') {
      assert.equal(result.tickets.length, 1);
      assert.equal(result.tenantSlugById[TENANT_ID.toLowerCase()], 'uat-device');
    }
    assert.equal(calls.length, 2);
  });
});
