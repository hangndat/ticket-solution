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
  const parsed = parseInstalledAppLink(
    'ticketsolution://events/demo-fun-fest',
  );
  assert.equal(parsed.kind, 'event');
  if (parsed.kind !== 'event') return;
  assert.equal(parsed.eventId, 'demo-fun-fest');
  assert.equal(parsed.href, '/events/fixture/demo-fun-fest');
  assert.match(parsed.href, /fixture/);
});

test('oauth callback is not rewritten onto a screen', () => {
  for (const input of [
    'ticketsolution://oauth/callback',
    'ticketsolution://oauth/callback?code=abc&state=xyz',
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
