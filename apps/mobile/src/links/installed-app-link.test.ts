import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseInstalledAppLink,
  routeForInstalledAppLink,
} from './installed-app-link.ts';

const ticketId = '11111111-1111-4111-8111-111111111111';

test('ticket link opens the existing ticket screen', () => {
  const href = `/my-tickets/${ticketId}`;
  for (const input of [
    `ticketsolution://tickets/${ticketId}`,
    `vemoki://tickets/${ticketId}`,
    `ticketsolution://tickets/${ticketId}/`,
    `ticketsolution:///tickets/${ticketId}`,
    `tickets/${ticketId}`,
    `/tickets/${ticketId}?from=qr`,
  ]) {
    assert.deepEqual(parseInstalledAppLink(input), {
      kind: 'ticket',
      ticketId,
      href,
    });
    assert.equal(routeForInstalledAppLink(input), href);
  }
});

test('event link opens fixture catalog content by event id', () => {
  for (const input of [
    'ticketsolution://events/demo-fun-fest',
    'vemoki://events/demo-fun-fest',
  ]) {
    const parsed = parseInstalledAppLink(input);
    assert.equal(parsed.kind, 'event');
    if (parsed.kind !== 'event') return;
    assert.equal(parsed.eventId, 'demo-fun-fest');
    assert.equal(parsed.href, '/events/fixture/demo-fun-fest');
    assert.match(parsed.href, /fixture/);
  }
});

test('oauth callback is not rewritten onto a screen', () => {
  for (const input of [
    'ticketsolution://oauth/callback',
    'ticketsolution://oauth/callback?code=abc&state=xyz',
    'vemoki://oauth/callback',
    '/oauth/callback',
  ]) {
    assert.equal(parseInstalledAppLink(input).kind, 'oauth-callback');
    assert.equal(routeForInstalledAppLink(input), null);
  }
});

test('unrelated and invalid links are left untouched', () => {
  assert.equal(
    routeForInstalledAppLink('ticketsolution://redeem'),
    'ticketsolution://redeem',
  );
  assert.equal(parseInstalledAppLink('https://example.com/tickets/x').kind, 'passthrough');
  assert.equal(
    parseInstalledAppLink('ticketsolution://tickets/not-a-uuid').kind,
    'passthrough',
  );
  assert.equal(
    parseInstalledAppLink('ticketsolution://events/demo-fun-fest/extra').kind,
    'passthrough',
  );
  assert.equal(
    parseInstalledAppLink('ticketsolution://oauth/logout').kind,
    'passthrough',
  );
});

test('invitation claim link routes to /claim without fixture fallback', () => {
  const token = 'opaque-claim-token-16chars';
  const tenantId = '22222222-2222-4222-8222-222222222222';
  const eventId = '33333333-3333-4333-8333-333333333333';
  const input = `vemoki://invitations/claim?token=${token}&tenantId=${tenantId}&eventId=${eventId}&tenantSlug=acme&eventSlug=spring`;
  const parsed = parseInstalledAppLink(input);
  assert.equal(parsed.kind, 'invitation-claim');
  if (parsed.kind !== 'invitation-claim') return;
  assert.equal(parsed.token, token);
  assert.equal(parsed.tenantId, tenantId);
  assert.equal(parsed.eventId, eventId);
  assert.match(parsed.href, /^\/claim\?/);
  assert.doesNotMatch(parsed.href, /fixture/);
  assert.equal(routeForInstalledAppLink(input), parsed.href);
});

test('invitation claim with short token is not routed', () => {
  const parsed = parseInstalledAppLink(
    'vemoki://invitations/claim?token=short&tenantId=22222222-2222-4222-8222-222222222222&eventId=33333333-3333-4333-8333-333333333333',
  );
  assert.equal(parsed.kind, 'passthrough');
});

test('uat staff-session deep link routes to /uat/staff-session', () => {
  const jwt =
    'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signaturepaddingvalue';
  const input = `vemoki://uat/staff-session?access_token=${jwt}`;
  const parsed = parseInstalledAppLink(input);
  assert.equal(parsed.kind, 'uat-staff-session');
  if (parsed.kind !== 'uat-staff-session') return;
  assert.equal(parsed.accessToken, jwt);
  assert.match(parsed.href, /^\/uat\/staff-session\?/);
  assert.equal(routeForInstalledAppLink(input), parsed.href);
});

test('uat staff-session rejects non-jwt', () => {
  assert.equal(
    parseInstalledAppLink('vemoki://uat/staff-session?access_token=not-a-jwt')
      .kind,
    'passthrough',
  );
});
