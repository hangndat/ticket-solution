import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TicketSummary } from '@ticket/contracts';
import { formatWalletEventStart, formatWalletEventTime, selectHeroTicket, walletEventStartMs } from './wallet-hero-ticket.ts';

const now = Date.parse('2026-11-06T12:00:00.000Z');
function ticket(id: string, eventName: string, startsAt?: string | null, state = 'ACTIVE'): TicketSummary {
  return {
    ticketId: id,
    tenantId: 'tenant',
    eventId: eventName,
    eventName,
    ticketTypeId: 'type',
    sourceId: 'source',
    state,
    credentialVersion: 1,
    gateCredential: { v: 1, kind: 'ticket.gate_credential', jws: 'header.payload.signature' },
    manualEntryCode: 'ABCD-EFGH-JK',
    createdAt: '2026-11-06T11:59:00.000Z',
    startsAt,
  };
}

test('hero follows event start across names and input order, then prefers future over past', () => {
  const lateAlpha = ticket('late', 'Alpha', '2026-11-09T12:00:00.000Z');
  const nearZulu = ticket('near', 'Zulu', '2026-11-07T12:00:00.000Z');
  const past = ticket('past', 'Beta', '2026-11-06T11:00:00.000Z');
  for (const rows of [[lateAlpha, nearZulu, past], [past, nearZulu, lateAlpha]]) {
    assert.equal(selectHeroTicket(rows, false, now), nearZulu);
    const remaining = rows.filter((row) => row.ticketId !== nearZulu.ticketId);
    assert.equal(remaining.length, 2);
    assert.ok(remaining.every((row) => row.ticketId !== nearZulu.ticketId));
  }
});

test('most recently started event wins when no future event exists', () => {
  const older = ticket('older', 'Zulu', '2026-11-04T12:00:00.000Z');
  const recent = ticket('recent', 'Alpha', '2026-11-06T11:00:00.000Z');
  assert.equal(selectHeroTicket([older, recent], false, now), recent);
});

test('same event and instant keep original ticket order, including offline sync', () => {
  const first = ticket('first', 'Zulu', '2026-11-07T12:00:00.000Z');
  const second = ticket('second', 'Zulu', '2026-11-07T12:00:00.000Z');
  assert.equal(selectHeroTicket([first, second], false, now), first);
  assert.equal(selectHeroTicket([second, first], true, now), second);
});

test('used and pending tickets cannot become hero even with earlier dates', () => {
  const used = ticket('used', 'A', '2026-11-06T12:00:00.000Z', 'USED');
  const pending = ticket('pending', 'B', '2026-11-06T12:00:00.000Z', 'PENDING');
  const active = ticket('active', 'C', '2026-11-08T12:00:00.000Z');
  assert.equal(selectHeroTicket([used, pending, active], false, now), active);
  assert.equal(selectHeroTicket([used, pending], false, now), null);
});

test('missing, null and malformed starts never infer a hero from createdAt or demo names', () => {
  const missing = ticket('missing', 'demo-mfest');
  const nil = ticket('nil', 'Alpha', null);
  const invalid = ticket('invalid', 'Zulu', '2026-02-30T12:00:00.000Z');
  assert.equal(selectHeroTicket([missing, nil, invalid], true, now), null);
  assert.equal(walletEventStartMs('not-a-date'), null);
  assert.equal(walletEventStartMs('2026-11-07'), null);
  assert.equal(formatWalletEventStart(null), null);
  assert.ok(formatWalletEventStart('2026-11-07T12:00:00.000Z'));
  assert.match(formatWalletEventTime('2026-11-07T12:00:00.000Z') ?? '', /^\d{2}:\d{2}$/);
});
