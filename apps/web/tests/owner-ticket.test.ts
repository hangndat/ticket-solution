import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  findTicketById,
  isTicketSummary,
  parseMeTicketsResponse,
  resolveOwnerTenantId,
} from '../src/owner-ticket/load';
import {
  isOwnerTicketParams,
  ownerTicketAuthHref,
  ownerTicketPath,
} from '../src/owner-ticket/paths';

const TICKET_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('owner ticket paths', () => {
  it('builds email-contract path', () => {
    assert.equal(
      ownerTicketPath('uat-device', TICKET_ID),
      `/t/uat-device/tickets/${TICKET_ID}`,
    );
  });

  it('validates slug + UUID', () => {
    assert.equal(isOwnerTicketParams('uat-device', TICKET_ID), true);
    assert.equal(isOwnerTicketParams('Bad_Slug', TICKET_ID), false);
    assert.equal(isOwnerTicketParams('uat-device', 'not-a-uuid'), false);
  });

  it('auth next returns to ticket path', () => {
    const href = ownerTicketAuthHref('uat-device', TICKET_ID);
    assert.ok(href.startsWith('/auth?next='));
    assert.ok(href.includes(encodeURIComponent(`/t/uat-device/tickets/${TICKET_ID}`)));
  });
});

describe('owner ticket load helpers', () => {
  it('parses me tickets and finds by id', () => {
    const ticket = {
      ticketId: TICKET_ID,
      tenantId: TENANT_ID,
      eventId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      ticketTypeId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      sourceId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      state: 'ACTIVE',
      credentialVersion: 1,
      createdAt: '2026-10-18T00:00:00.000Z',
    };
    assert.equal(isTicketSummary(ticket), true);
    const list = parseMeTicketsResponse(200, { tickets: [ticket] });
    assert.ok(list);
    assert.equal(findTicketById(list.tickets, TICKET_ID)?.state, 'ACTIVE');
    assert.equal(findTicketById(list.tickets, TENANT_ID), null);
  });

  it('resolves tenantId from query or me/tenants slug', () => {
    assert.deepEqual(
      resolveOwnerTenantId({
        tenantSlug: 'uat-device',
        explicitTenantId: TENANT_ID,
        meTenantsStatus: 401,
        meTenantsBody: null,
      }),
      { status: 'ok', tenantId: TENANT_ID, source: 'query' },
    );

    assert.deepEqual(
      resolveOwnerTenantId({
        tenantSlug: 'uat-device',
        meTenantsStatus: 200,
        meTenantsBody: {
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
        },
      }),
      { status: 'ok', tenantId: TENANT_ID, source: 'me-tenants' },
    );

    assert.equal(
      resolveOwnerTenantId({
        tenantSlug: 'uat-device',
        meTenantsStatus: 200,
        meTenantsBody: { items: [] },
      }).status,
      'unresolved',
    );

    assert.equal(
      resolveOwnerTenantId({
        tenantSlug: 'uat-device',
        meTenantsStatus: 401,
        meTenantsBody: null,
      }).status,
      'unauthorized',
    );
  });
});
