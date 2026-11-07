const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  hashRedemptionCode,
  readCodeHmacEnvironment,
  IssueError,
  ISSUE_ERROR_CODES,
  codesEqualHmac,
  createFailingEmailAdapter,
  createNoopEmailAdapter,
  listTicketsForOwner,
  getTicketForOwner,
} = require('../dist');

test('CODE_HMAC_PEPPER required and hashes are stable + case-insensitive', () => {
  assert.throws(
    () => readCodeHmacEnvironment({}),
    (error) =>
      error instanceof IssueError &&
      error.code === ISSUE_ERROR_CODES.CODE_HMAC_MISCONFIGURED,
  );
  const cfg = readCodeHmacEnvironment({
    CODE_HMAC_PEPPER: 'unit-test-pepper-16b',
    CODE_HMAC_VERSION: '1',
  });
  const a = hashRedemptionCode(cfg, 'abc-123');
  const b = hashRedemptionCode(cfg, ' ABC-123 ');
  assert.equal(a, b);
  assert.equal(a.length, 64);
  assert.equal(codesEqualHmac(a, b), true);
  assert.equal(codesEqualHmac(a, '0'.repeat(64)), false);
});

test('deleted event metadata is omitted on owner list and detail', async () => {
  const row = {
    id: 'ticket', event_id: 'event', ticket_type_id: 'type', source_id: 'source',
    state: 'ACTIVE', credential_version: 1, manual_entry_code_sealed: null,
    created_at: new Date('2026-01-01T00:00:00Z'), event_name: null,
    event_starts_at: null, event_exists: false,
  };
  const tx = { $queryRaw: async () => [row] };
  const listed = await listTicketsForOwner(tx, 'tenant', 'owner');
  const detail = await getTicketForOwner(tx, 'tenant', 'owner', 'ticket');
  for (const ticket of [listed[0], detail]) {
    assert.equal(Object.hasOwn(ticket, 'eventName'), false);
    assert.equal(Object.hasOwn(ticket, 'startsAt'), false);
  }
});

test('email adapters: noop succeeds, failing throws without touching tickets', async () => {
  const payload = {
    tenantId: 't',
    eventId: 'e',
    ticketId: 'ticket',
    toEmail: 'a@example.com',
    requestId: 'r',
    subject: 's',
    text: 'body',
    html: '<p>body</p>',
    qrPng: Buffer.from([1, 2, 3]),
    credentialVersion: 1,
    credentialTokenHash: 'hash',
  };
  const ok = createNoopEmailAdapter();
  const result = await ok.sendTicketIssued(payload);
  assert.match(result.providerRef, /^noop:/);
  assert.equal(result.providerStatus, 'ACCEPTED');

  const bad = createFailingEmailAdapter('boom');
  await assert.rejects(() => bad.sendTicketIssued(payload), /boom/);
});
