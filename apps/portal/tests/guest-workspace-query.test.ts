import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  INVITATION_SEARCH_VALIDATION_MESSAGE,
  TICKET_SEARCH_VALIDATION_MESSAGE,
  buildGuestListQueryPath,
  defaultGuestListKind,
  guestListKindFromHash,
  guestListKindToHash,
  invitationSearchBlocksPagination,
  ticketSearchBlocksPagination,
  validateInvitationIdSearch,
  validateTicketIdSearch,
} from '../src/guests/guest-list-query';

const tenantId = '11111111-1111-4111-8111-111111111111';
const eventId = '22222222-2222-4222-8222-222222222222';
const ticketId = '33333333-3333-4333-8333-333333333333';
const invitationId = '44444444-4444-4444-8444-444444444444';
const cursor = 'cursor-page-2';

describe('guest workspace list query (F01/F02/F04)', () => {
  it('defaults list tab to tickets when cs.lookup is granted', () => {
    assert.equal(
      defaultGuestListKind(['inventory.import', 'cs.lookup']),
      'tickets',
    );
  });

  it('maps F1 hash aliases for list tabs', () => {
    assert.equal(guestListKindFromHash('#tickets'), 'tickets');
    assert.equal(guestListKindFromHash('#requests'), 'redemptions');
    assert.equal(guestListKindToHash('redemptions'), 'requests');
  });

  it('rejects short and non-UUID ticket search before any request', () => {
    const short = validateTicketIdSearch('abc');
    assert.equal(short.ok, false);
    if (!short.ok) {
      assert.equal(short.message, TICKET_SEARCH_VALIDATION_MESSAGE);
    }
    const email = validateTicketIdSearch('user@example.com');
    assert.equal(email.ok, false);
  });

  it('accepts exact UUID ticket id search', () => {
    const ok = validateTicketIdSearch(ticketId);
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.ticketId, ticketId);
  });

  it('does not send cursor when ticket UUID search is active (F01)', () => {
    const path = buildGuestListQueryPath(
      tenantId,
      eventId,
      'tickets',
      cursor,
      '',
      ticketId,
    );
    assert.match(path, /[?&]q=/);
    assert.doesNotMatch(path, /cursor=/);
    assert.equal(ticketSearchBlocksPagination(ticketId), true);
  });

  it('keeps server cursor pagination for unfiltered ticket list', () => {
    const path = buildGuestListQueryPath(
      tenantId,
      eventId,
      'tickets',
      cursor,
      '',
      '',
    );
    assert.match(path, /cursor=cursor-page-2/);
    assert.doesNotMatch(path, /[?&]q=/);
    assert.equal(ticketSearchBlocksPagination(''), false);
  });

  it('rejects short and non-UUID invitation search before any request', () => {
    const short = validateInvitationIdSearch('id');
    assert.equal(short.ok, false);
    if (!short.ok) {
      assert.equal(short.message, INVITATION_SEARCH_VALIDATION_MESSAGE);
    }
    const email = validateInvitationIdSearch('guest@example.com');
    assert.equal(email.ok, false);
  });

  it('accepts exact UUID invitation id search', () => {
    const ok = validateInvitationIdSearch(invitationId);
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.invitationId, invitationId);
  });

  it('does not send cursor when invitation UUID search is active (G-08)', () => {
    const path = buildGuestListQueryPath(
      tenantId,
      eventId,
      'invitations',
      cursor,
      'PENDING',
      invitationId,
    );
    assert.match(path, /[?&]q=/);
    assert.match(path, /state=PENDING/);
    assert.doesNotMatch(path, /cursor=/);
    assert.equal(invitationSearchBlocksPagination(invitationId), true);
  });

  it('keeps server cursor pagination for unfiltered invitation list', () => {
    const path = buildGuestListQueryPath(
      tenantId,
      eventId,
      'invitations',
      cursor,
      '',
      '',
    );
    assert.match(path, /cursor=cursor-page-2/);
    assert.doesNotMatch(path, /[?&]q=/);
    assert.equal(invitationSearchBlocksPagination(''), false);
  });
});
