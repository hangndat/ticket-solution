import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isOwnerTicketPath,
  matchOwnerTicketPath,
  parseOwnerTicketDetail,
  loadOwnerTicket,
} from '../src/owner-ticket';
import { sanitizePostLoginPath } from '../src/oidc/post-login';

const SAMPLE_ID = '97f77680-4d65-4b6d-baf3-b3f699a006a6';
const SAMPLE_PATH = `/t/uat-device/tickets/${SAMPLE_ID}`;

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
    assert.equal(
      sanitizePostLoginPath(`${SAMPLE_PATH}?x=1`),
      SAMPLE_PATH,
    );
    assert.equal(sanitizePostLoginPath('/t/evil/events/x'), null);
    assert.equal(sanitizePostLoginPath('https://evil.example' + SAMPLE_PATH), null);
  });
});

describe('parseOwnerTicketDetail', () => {
  it('accepts TicketSummary shape and optional tenantSlug', () => {
    const parsed = parseOwnerTicketDetail({
      ticketId: SAMPLE_ID,
      tenantId: '11111111-1111-4111-8111-111111111111',
      eventId: '22222222-2222-4222-8222-222222222222',
      ticketTypeId: '33333333-3333-4333-8333-333333333333',
      sourceId: '44444444-4444-4444-8444-444444444444',
      state: 'ACTIVE',
      credentialVersion: 1,
      createdAt: '2026-10-18T00:00:00.000Z',
      tenantSlug: 'UAT-Device',
    });
    assert.ok(parsed);
    assert.equal(parsed!.tenantSlug, 'uat-device');
    assert.equal(parsed!.state, 'ACTIVE');
  });

  it('rejects incomplete bodies', () => {
    assert.equal(parseOwnerTicketDetail({ ticketId: SAMPLE_ID }), null);
    assert.equal(parseOwnerTicketDetail(null), null);
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

  it('maps Nest statuses and enforces slug match', async () => {
    const baseTicket = {
      ticketId: SAMPLE_ID,
      tenantId: '11111111-1111-4111-8111-111111111111',
      eventId: '22222222-2222-4222-8222-222222222222',
      ticketTypeId: '33333333-3333-4333-8333-333333333333',
      sourceId: '44444444-4444-4444-8444-444444444444',
      state: 'ACTIVE',
      credentialVersion: 1,
      createdAt: '2026-10-18T00:00:00.000Z',
    };

    const notFound = await loadOwnerTicket({
      tenantSlug: 'uat-device',
      ticketId: SAMPLE_ID,
      accessToken: 'tok',
      fetchImpl: async () => new Response('{}', { status: 404 }),
    });
    assert.equal(notFound.status, 'not-found');

    const mismatch = await loadOwnerTicket({
      tenantSlug: 'uat-device',
      ticketId: SAMPLE_ID,
      accessToken: 'tok',
      fetchImpl: async () =>
        new Response(
          JSON.stringify({ ...baseTicket, tenantSlug: 'other-org' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    });
    assert.equal(mismatch.status, 'not-found');

    const ok = await loadOwnerTicket({
      tenantSlug: 'uat-device',
      ticketId: SAMPLE_ID,
      accessToken: 'tok',
      env: { API_BASE_URL: 'http://api.test' } as unknown as NodeJS.ProcessEnv,
      fetchImpl: async (input) => {
        const url = String(input);
        assert.ok(url.includes(`/v1/me/tickets/${SAMPLE_ID}`));
        assert.ok(url.includes('tenantSlug=uat-device'));
        return new Response(
          JSON.stringify({ ...baseTicket, tenantSlug: 'uat-device' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    });
    assert.equal(ok.status, 'ok');
    if (ok.status === 'ok') {
      assert.equal(ok.ticket.ticketId, SAMPLE_ID);
    }
  });
});
