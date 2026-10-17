const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  createFailingEmailAdapter,
  createNoopEmailAdapter,
  createMisconfiguredEmailAdapter,
  createSmtpEmailAdapter,
  computeBackoffSeconds,
  isWithinJitterBounds,
  validateTemplateLiterals,
  renderEscapedPreview,
  escapeHtml,
  NotificationError,
  NOTIFICATION_ERROR_CODES,
  DEFAULT_TICKET_ISSUED_TEMPLATE,
  buildCredentialQrJson,
  hashCredentialToken,
  sealCredentialToken,
  openCredentialToken,
} = require('../dist');

test('production SMTP missing is fail-closed (no noop success)', async () => {
  const prod = createSmtpEmailAdapter({
    nodeEnv: 'production',
    smtpUrl: undefined,
  });
  await assert.rejects(
    () =>
      prod.sendTicketIssued({
        tenantId: 't',
        eventId: 'e',
        ticketId: 'ticket',
        toEmail: 'a@example.com',
        requestId: 'r',
        subject: 's',
        text: 't',
        html: '<p>t</p>',
        qrPng: Buffer.from([1, 2, 3]),
        credentialVersion: 1,
        credentialTokenHash: 'x',
      }),
    (error) =>
      error instanceof NotificationError &&
      error.code === NOTIFICATION_ERROR_CODES.SMTP_MISCONFIGURED,
  );

  const mis = createMisconfiguredEmailAdapter();
  await assert.rejects(() => mis.sendTicketIssued({}), /SMTP/);
});

test('explicit noop/failing adapters remain for tests', async () => {
  const ok = createNoopEmailAdapter();
  const result = await ok.sendTicketIssued({
    tenantId: 't',
    eventId: 'e',
    ticketId: 'ticket',
    toEmail: 'a@example.com',
    requestId: 'r',
    subject: 's',
    text: 't',
    html: '<p>t</p>',
    qrPng: Buffer.from([1]),
    credentialVersion: 1,
    credentialTokenHash: 'h',
  });
  assert.match(result.providerRef, /^noop:/);
  assert.equal(result.providerStatus, 'ACCEPTED');

  const bad = createFailingEmailAdapter('boom');
  await assert.rejects(() => bad.sendTicketIssued({}), /boom/);
});

test('template allowlist rejects script and unknown vars; escapes HTML', () => {
  assert.throws(
    () =>
      validateTemplateLiterals(
        'TicketIssued',
        'Hi',
        'body',
        '<script>alert(1)</script>',
      ),
    (error) =>
      error instanceof NotificationError &&
      error.code === NOTIFICATION_ERROR_CODES.TEMPLATE_INVALID,
  );
  assert.throws(
    () =>
      validateTemplateLiterals(
        'TicketIssued',
        'Hi {{evil}}',
        DEFAULT_TICKET_ISSUED_TEMPLATE.bodyText,
        DEFAULT_TICKET_ISSUED_TEMPLATE.bodyHtml,
      ),
    (error) =>
      error instanceof NotificationError &&
      error.code === NOTIFICATION_ERROR_CODES.TEMPLATE_UNSUPPORTED_VARIABLE,
  );
  const preview = renderEscapedPreview(
    'Hello {{eventName}}',
    'x',
    '<p>{{eventName}}</p>',
    { eventName: '<b>Hack</b>' },
  );
  assert.equal(preview.escaped, true);
  assert.equal(preview.subject, 'Hello <b>Hack</b>');
  assert.equal(preview.bodyHtml, `<p>${escapeHtml('<b>Hack</b>')}</p>`);
  assert.equal(preview.bodyHtml.includes('<b>'), false);
});

test('backoff stays within ±20% jitter bounds for attempts 1..8', () => {
  for (let attempt = 1; attempt <= 8; attempt++) {
    for (let i = 0; i < 40; i++) {
      const seconds = computeBackoffSeconds(attempt);
      assert.equal(
        isWithinJitterBounds(seconds, attempt),
        true,
        `attempt=${attempt} seconds=${seconds}`,
      );
    }
  }
  const maxed = computeBackoffSeconds(20, undefined, () => 0.5);
  assert.ok(maxed <= 3600 * 1.2);
});

test('credential seal/open round-trip; QR JSON embeds current token', () => {
  const key = 'unit-test-credential-key';
  const token = 'tok_' + 'a'.repeat(40);
  const sealed = sealCredentialToken(token, key);
  assert.equal(openCredentialToken(sealed.encryptedToken, key), token);
  assert.equal(hashCredentialToken(token), sealed.tokenHash);
  const qr = JSON.parse(
    buildCredentialQrJson({
      ticketId: '11111111-1111-4111-8111-111111111111',
      tenantId: '22222222-2222-4222-8222-222222222222',
      eventId: '33333333-3333-4333-8333-333333333333',
      credentialVersion: 1,
      token,
    }),
  );
  assert.equal(qr.kind, 'ticket.credential');
  assert.equal(qr.token, token);
});
