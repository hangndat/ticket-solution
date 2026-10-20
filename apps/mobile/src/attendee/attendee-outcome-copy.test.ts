import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TicketSummary } from '@ticket/contracts';
import {
  attendeeWalletCopy,
  presentRedeemDecision,
  presentTicketRow,
  ticketGateHint,
  ticketStateLabelVi,
} from './attendee-outcome-copy.ts';

const sampleTicket: TicketSummary = {
  ticketId: '11111111-1111-4111-8111-111111111111',
  tenantId: '22222222-2222-4222-8222-222222222222',
  eventId: 'demo-mfest',
  ticketTypeId: '33333333-3333-4333-8333-333333333333',
  sourceId: '44444444-4444-4444-8444-444444444444',
  state: 'ACTIVE',
  credentialVersion: 3,
  createdAt: '2026-10-18T00:00:00.000Z',
};

test('ticketStateLabelVi maps known states to Vietnamese', () => {
  assert.equal(ticketStateLabelVi('ACTIVE'), 'Còn hiệu lực');
  assert.equal(ticketStateLabelVi('USED'), 'Đã dùng');
  assert.equal(ticketStateLabelVi('REVOKED'), 'Đã thu hồi');
});

test('presentTicketRow puts event name and status above UUID/credential', () => {
  const row = presentTicketRow(sampleTicket);
  assert.equal(row.eventTitle, 'MFest · Demo');
  assert.equal(row.statusLabel, 'Còn hiệu lực');
  assert.match(row.accessibilityLabel, /MFest/);
  assert.equal(row.ticketId, sampleTicket.ticketId);
  assert.match(row.credentialLine, /3/);
  assert.doesNotMatch(row.eventTitle, /v3|credential/i);
});

test('presentTicketRow falls back when event not in demo catalog', () => {
  const row = presentTicketRow({
    ...sampleTicket,
    eventId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  });
  assert.equal(row.eventTitle, 'Sự kiện');
  assert.match(row.eventIdLine, /aaaaaaaa/);
});

test('presentTicketRow prefers API eventName over demo catalog', () => {
  const row = presentTicketRow({
    ...sampleTicket,
    eventId: 'demo-mfest',
    eventName: 'Tên từ máy chủ',
  });
  assert.equal(row.eventTitle, 'Tên từ máy chủ');
});

test('presentRedeemDecision issued never leads with raw ticket UUID only', () => {
  const view = presentRedeemDecision({
    kind: 'issued',
    ticketId: sampleTicket.ticketId,
    replayed: false,
  });
  assert.match(view.title, /vé/i);
  assert.match(view.detail, /Vé của tôi|QR/i);
  assert.ok(view.secondary?.includes(sampleTicket.ticketId));
  assert.equal(view.tone, 'admit');
});

test('presentRedeemDecision unknown and pending are assertive and not admit', () => {
  const unknown = presentRedeemDecision({
    kind: 'unknown',
    idempotencyKey: 'idem-1',
    message: 'x',
  });
  assert.equal(unknown.tone, 'unknown');
  assert.equal(unknown.assertive, true);
  assert.match(unknown.detail, /Chưa hiện vé|không giả định/i);

  const pending = presentRedeemDecision({
    kind: 'pending',
    requestId: 'req-1',
    operationId: 'op-1',
    eventId: 'evt-1',
    replayed: false,
    message: 'waiting',
  });
  assert.match(pending.title, /chưa phải vé/i);
  assert.equal(pending.tone, 'unknown');
  assert.equal(pending.assertive, true);
});

test('presentRedeemDecision auth codes use plain VI without IdP jargon', () => {
  const unauth = presentRedeemDecision({
    kind: 'denied',
    code: 'UNAUTHENTICATED',
    message: 'Keycloak required',
  });
  assert.equal(unauth.title, 'Cần đăng nhập');
  assert.doesNotMatch(unauth.detail, /Keycloak|Nest|BFF/i);

  const email = presentRedeemDecision({
    kind: 'denied',
    code: 'EMAIL_NOT_VERIFIED',
    message: 'verify',
  });
  assert.equal(email.title, 'Cần xác minh email');
});

test('presentRedeemDecision stale asks reload + reconsent', () => {
  const stale = presentRedeemDecision({
    kind: 'stale',
    code: 'FORM_VERSION_STALE',
    message: 'stale',
  });
  assert.match(stale.title, /Biểu mẫu|điều khoản/i);
  assert.match(stale.detail, /Tải lại|đồng ý/i);
});

test('attendeeWalletCopy avoids Keycloak / Nest on guest chrome', () => {
  assert.doesNotMatch(attendeeWalletCopy.signedOutBody, /Keycloak|Nest|BFF|\/v1\//i);
  assert.match(attendeeWalletCopy.offlineBannerTitle, /chưa kết nối/i);
});

test('ticketGateHint marks demo and non-active states (AC-T1)', () => {
  assert.equal(
    ticketGateHint('ACTIVE', { demo: true }),
    attendeeWalletCopy.demoNotForGate,
  );
  assert.equal(ticketGateHint('REVOKED', { demo: false }), attendeeWalletCopy.revokedHint);
  assert.equal(ticketGateHint('USED', { demo: false }), attendeeWalletCopy.usedHint);
  assert.equal(ticketGateHint('ACTIVE', { demo: false }), null);
});
