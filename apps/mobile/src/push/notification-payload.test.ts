import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  notificationResponseId,
  parsePushNotificationData,
} from './notification-payload.ts';

const TICKET = '11111111-1111-4111-8111-111111111111';
const EVENT = '22222222-2222-4222-8222-222222222222';
const TENANT = '33333333-3333-4333-8333-333333333333';

test('TicketIssued requires opaque ticketId and allowlisted version', () => {
  const ok = parsePushNotificationData({
    kind: 'TicketIssued',
    payloadVersion: 1,
    ticketId: TICKET,
    eventId: EVENT,
    tenantId: TENANT,
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.ticketId, TICKET);
    assert.equal(ok.kind, 'TicketIssued');
  }

  const missing = parsePushNotificationData({
    kind: 'TicketIssued',
    payloadVersion: 1,
  });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.reason, 'missing-route-refs');

  const badVersion = parsePushNotificationData({
    kind: 'TicketIssued',
    payloadVersion: 99,
    ticketId: TICKET,
  });
  assert.equal(badVersion.ok, false);
  if (!badVersion.ok) assert.equal(badVersion.reason, 'version-unsupported');
});

test('event kinds require published slug pair — never eventId alone', () => {
  const ok = parsePushNotificationData({
    kind: 'EventChanged',
    payloadVersion: 1,
    eventId: EVENT,
    tenantSlug: 'acme',
    eventSlug: 'spring-fest',
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.tenantSlug, 'acme');
    assert.equal(ok.eventSlug, 'spring-fest');
  }

  const idOnly = parsePushNotificationData({
    kind: 'EventReminder',
    payloadVersion: 1,
    eventId: EVENT,
  });
  assert.equal(idOnly.ok, false);
  if (!idOnly.ok) assert.equal(idOnly.reason, 'missing-route-refs');
});

test('rejects unsupported kind and forged UUID refs', () => {
  const kind = parsePushNotificationData({
    kind: 'MarketingBlast',
    payloadVersion: 1,
  });
  assert.equal(kind.ok, false);
  if (!kind.ok) assert.equal(kind.reason, 'kind-unsupported');

  const forged = parsePushNotificationData({
    kind: 'TicketIssued',
    payloadVersion: 1,
    ticketId: 'not-a-uuid',
  });
  assert.equal(forged.ok, false);
  if (!forged.ok) assert.equal(forged.reason, 'invalid-ref');
});

test('response id is stable for dedupe', () => {
  const a = notificationResponseId({
    identifier: 'n1',
    date: 100,
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
  });
  const b = notificationResponseId({
    identifier: 'n1',
    date: 100,
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
  });
  const c = notificationResponseId({
    identifier: 'n1',
    date: 101,
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
  });
  assert.equal(a, b);
  assert.notEqual(a, c);
});
