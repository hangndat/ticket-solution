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
