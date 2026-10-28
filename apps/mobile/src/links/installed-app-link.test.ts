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
    'ticketsolution://events/demo-mfest',
    'vemoki://events/demo-mfest',
  ]) {
    const parsed = parseInstalledAppLink(input);
    assert.equal(parsed.kind, 'event');
    if (parsed.kind !== 'event') return;
    assert.equal(parsed.eventId, 'demo-mfest');
    assert.equal(parsed.href, '/events/fixture/demo-mfest');
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

test('redeem deep link routes to global attendee entry', () => {
  for (const input of [
    'ticketsolution://redeem',
    'vemoki://redeem',
    '/redeem',
    'redeem',
  ]) {
    const parsed = parseInstalledAppLink(input);
    assert.equal(parsed.kind, 'redeem-entry');
    if (parsed.kind !== 'redeem-entry') return;
    assert.equal(parsed.href, '/(tabs)/redeem');
    assert.equal(routeForInstalledAppLink(input), '/(tabs)/redeem');
  }
});

test('redeem deep link preserves code query on global route', () => {
  const code = 'SPRING-ADMIT-01';
  const input = `vemoki://redeem?code=${encodeURIComponent(code)}`;
  const parsed = parseInstalledAppLink(input);
  assert.equal(parsed.kind, 'redeem-entry');
  if (parsed.kind !== 'redeem-entry') return;
  assert.equal(
    parsed.href,
    `/(tabs)/redeem?code=${encodeURIComponent(code)}`,
  );
  assert.equal(routeForInstalledAppLink(input), parsed.href);
});

test('unrelated and invalid links are left untouched', () => {
  assert.equal(parseInstalledAppLink('https://example.com/tickets/x').kind, 'passthrough');
  assert.equal(
    parseInstalledAppLink('ticketsolution://tickets/not-a-uuid').kind,
    'passthrough',
  );
  assert.equal(
    parseInstalledAppLink('ticketsolution://events/demo-mfest/extra').kind,
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

test('membership invite opens web bridge (not native claim)', () => {
  const token = 'a'.repeat(32);
  for (const input of [
    `vemoki://invite?token=${token}`,
    `/invite?token=${token}`,
    `https://app.vemoki.com/invite#token=${encodeURIComponent(token)}`,
  ]) {
    const parsed = parseInstalledAppLink(input);
    assert.equal(parsed.kind, 'membership-invite');
    if (parsed.kind !== 'membership-invite') return;
    assert.equal(parsed.token, token);
    assert.match(parsed.href, /^\/membership-invite\?token=/);
    assert.doesNotMatch(parsed.href, /^\/claim/);
    assert.equal(routeForInstalledAppLink(input), parsed.href);
  }
});

test('membership invite without token still routes to bridge', () => {
  const parsed = parseInstalledAppLink('vemoki://invite');
  assert.equal(parsed.kind, 'membership-invite');
  if (parsed.kind !== 'membership-invite') return;
  assert.equal(parsed.token, '');
  assert.equal(parsed.href, '/membership-invite');
});

test('staff deep link opens soft-access (O02 deny / tab gate)', () => {
  for (const input of [
    'vemoki://staff',
    'ticketsolution://staff',
    '/staff',
    'staff',
  ]) {
    const parsed = parseInstalledAppLink(input);
    assert.equal(parsed.kind, 'staff-access');
    if (parsed.kind !== 'staff-access') return;
    assert.equal(parsed.href, '/staff-access');
    assert.equal(routeForInstalledAppLink(input), '/staff-access');
  }
});

test('uat session deep link rewrites to /uat/session', () => {
  const token = 'staff-uat-token';
  const input = `vemoki://uat/session?access_token=${token}`;
  const parsed = parseInstalledAppLink(input);
  assert.equal(parsed.kind, 'uat-session');
  if (parsed.kind !== 'uat-session') return;
  assert.equal(parsed.href, `/uat/session?access_token=${token}`);
  assert.equal(routeForInstalledAppLink(input), parsed.href);
});
